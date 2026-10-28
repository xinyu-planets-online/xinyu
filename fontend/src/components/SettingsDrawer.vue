<script setup>
import { ref, computed, watch, shallowRef, onMounted } from 'vue'
import { createClient } from '@inteye/llm-hub'
import * as allProviders from '@inteye/llm-hub/providers'
import { createCustomProvider } from '@inteye/llm-hub/providers'
import { encryptPayload, decryptPayload } from '@/utils/securePayload'
import LoginModal from '@/components/LoginModal.vue'
import { exportAll, importAll, listConversations } from '@/db/chatRepository'

const props = defineProps({
    showSettings: { type: Boolean, default: false },
    currentProvider: { type: String, default: '' },
    currentModel: { type: String, default: '' },
    models: { type: Array, default: () => [] },
    themeMode: { type: String, default: 'auto' },
    userSystemPrompt: { type: String, default: '' },
})

const emit = defineEmits([
    'close', 'update:themeMode', 'update:userSystemPrompt',
    'switch-model', 'remove-model', 'add-model',
    'data-imported', 'data-cleared',
])

const CANDIDATE_NAMES = [
    'openai', 'anthropic', 'gemini', 'deepseek', 'qwen', 'zhipu',
    'moonshot', 'groq', 'minimax', 'mistral', 'baichuan', 'yi',
    'step', 'stepfun', 'xai', 'ollama', 'lmstudio', 'localai',
]

const DISPLAY_NAME = {
    openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Gemini',
    deepseek: 'DeepSeek', qwen: '通义千问', zhipu: '智谱 GLM',
    moonshot: 'Moonshot', groq: 'Groq', minimax: 'MiniMax',
    mistral: 'Mistral', baichuan: '百川', yi: '零一万物',
    step: '阶跃星辰', stepfun: '阶跃星辰', xai: 'xAI',
    ollama: 'Ollama', lmstudio: 'LM Studio', localai: 'LocalAI',
}

const BUILTIN_ADAPTERS = {}
const BUILTIN = []
for (const name of CANDIDATE_NAMES) {
    const adapter = allProviders[name]
    if (adapter && typeof adapter === 'object') {
        BUILTIN_ADAPTERS[name] = adapter
        if (!BUILTIN.includes(name)) BUILTIN.push(name)
    }
}

const BUILTIN_MODELS = {
    openai: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-4o', 'gpt-4o-mini'],
    anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    gemini: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash'],
    deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash', 'deepseek-chat', 'deepseek-reasoner'],
    qwen: ['qwen3.7-max', 'qwen3.7-plus', 'qwen3.6-plus', 'qwen3.6-flash'],
    zhipu: ['glm-5.1', 'glm-5', 'glm-5-turbo', 'glm-4.7', 'glm-4.6'],
    moonshot: ['kimi-k2.6', 'kimi-k2.5', 'kimi-k2-thinking', 'moonshot-v1-128k'],
    groq: ['groq/compound', 'groq/compound-mini', 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'],
    minimax: ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed', 'MiniMax-M2.5'],
    mistral: ['mistral-medium-3-5', 'mistral-large-2512', 'mistral-small-2603'],
    baichuan: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan3-Turbo-128k'],
    yi: ['yi-large', 'yi-medium', 'yi-medium-200k', 'yi-spark'],
    step: ['step-1-8k', 'step-1-32k', 'step-1-128k', 'step-2-16k'],
    xai: ['grok-4.3', 'grok-4.3-latest', 'grok-4.1-fast'],
    ollama: ['llama3.2', 'qwen2.5-coder:7b', 'deepseek-r1:8b'],
    lmstudio: ['local-model'],
    localai: ['local-model'],
}

const NO_KEY_REQUIRED = ['ollama', 'lmstudio', 'localai']

// ============ 自定义端点持久化 ============
const CUSTOM_ENDPOINTS_STORAGE_KEY = 'llm-hub-custom-endpoints'

function loadCustomEndpoints() {
    try {
        const raw = localStorage.getItem(CUSTOM_ENDPOINTS_STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch { return [] }
}

function persistCustomEndpoints() {
    try {
        localStorage.setItem(CUSTOM_ENDPOINTS_STORAGE_KEY, JSON.stringify(customEndpoints.value))
    } catch { }
}

// 每个端点: { name, displayName, baseURL, apiKey, protocol, model }
const customEndpoints = ref(loadCustomEndpoints())

// ============ Client 创建（多自定义端点） ============
const clientRef = shallowRef(null)

async function buildClient() {
    const providers = []

    for (const name of BUILTIN) {
        const p = BUILTIN_ADAPTERS[name]
        if (p) providers.push(p)
    }

    for (const ep of customEndpoints.value) {
        const adapter = createCustomProvider({
            protocol: ep.protocol || 'openai',
            name: ep.name,
            displayName: ep.displayName || ep.name,
            defaultBaseUrl: ep.baseURL,
            models: ep.model
                ? [{ id: ep.model, name: ep.model, supportsStreaming: true }]
                : [],
        })
        providers.push(adapter)
    }

    const newClient = createClient({ storage: 'localStorage', providers })

    for (const ep of customEndpoints.value) {
        // 本地端点也传入一个非空占位 Key，避免被判定为“无 access”
        const effectiveApiKey = ep.apiKey?.trim() || 'local-no-key'

        await newClient.configure(ep.name, {
            apiKey: effectiveApiKey,
            baseUrl: ep.baseURL,
            protocol: ep.protocol || 'openai',
            defaultModel: ep.model || '',
        })
    }

    clientRef.value = newClient
}

onMounted(async () => {
    await buildClient()
})

function getClient() { return clientRef.value }
defineExpose({ getClient })

function isBuiltin(id) { return BUILTIN.includes(id) }

function displayName(id) {
    if (isBuiltin(id)) return DISPLAY_NAME[id] || id
    const ep = customEndpoints.value.find(e => e.name === id)
    return ep ? (ep.displayName || ep.name) : id
}

function needsKey(provider) {
    if (!provider) return true
    if (customEndpoints.value.some(e => e.name === provider)) return false
    return !NO_KEY_REQUIRED.includes(provider)
}

const view = ref('main')
const activeTab = ref('model')
const tabs = [
    { key: 'model', label: '模型' },
    { key: 'prompt', label: '提示词' },
    { key: 'cloud', label: '云备份' },
    { key: 'appearance', label: '外观' },
]
function switchTab(key) { activeTab.value = key; view.value = 'main' }
function enterAdvanced() { view.value = 'advanced' }
function backToMain() { view.value = 'main' }

watch(() => props.showSettings, v => { if (v) view.value = 'main' })

// ============ 模型拉取 ============
const remoteModels = ref([])
const modelsLoading = ref(false)
const modelsError = ref('')

async function fetchBuiltinModels(provider) {
    if (!provider) return
    modelsLoading.value = true
    modelsError.value = ''
    remoteModels.value = []
    try {
        if (typeof clientRef.value?.fetchModels === 'function') {
            const raw = await clientRef.value.fetchModels(provider)
            const list = (Array.isArray(raw) ? raw : [])
                .map(m => {
                    if (typeof m === 'string') return m
                    if (m && m.id) return m.id
                    if (m && m.name) return m.name
                    return ''
                }).filter(Boolean)
            if (list.length) { remoteModels.value = list; return }
        }
    } catch (e) {
        modelsError.value = '远端不可用，已使用内置列表'
    } finally {
        modelsLoading.value = false
    }
    remoteModels.value = BUILTIN_MODELS[provider] || []
    if (!remoteModels.value.length) modelsError.value = '该 Provider 暂无预置模型，请手动输入'
}

async function fetchCustomModels() {
    const baseURL = form.value.baseURL.trim().replace(/\/+$/, '')
    const apiKey = form.value.apiKey.trim()
    if (!baseURL) { modelsError.value = '先填 Base URL'; return }
    modelsLoading.value = true
    modelsError.value = ''
    remoteModels.value = []
    try {
        const res = await fetch(`${baseURL}/models`, {
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        const list = (data.data || []).map(m => m.id).filter(Boolean)
        if (!list.length) throw new Error('返回空列表')
        remoteModels.value = list
    } catch (e) {
        modelsError.value = e?.message || '拉取失败，可手动输入模型名'
    } finally {
        modelsLoading.value = false
    }
}

// ============ 表单 ============
const formOpen = ref(false)
const editingItem = ref(null)
const formError = ref('')
const formBusy = ref(false)
const testResult = ref('')
const testOk = ref(false)
const showKey = ref(false)

const form = ref({
    kind: 'builtin',
    provider: '',
    model: '',
    apiKey: '',
    baseURL: '',
    protocol: 'openai',
    customName: '',
    displayName: '',
})

const availableModels = computed(() => remoteModels.value)

watch(() => form.value.provider, async (id) => {
    if (!id || form.value.kind !== 'builtin') return
    await fetchBuiltinModels(id)
    if (!form.value.model && remoteModels.value.length) form.value.model = remoteModels.value[0]
})

function resetForm() {
    formError.value = ''
    testResult.value = ''
    testOk.value = false
    showKey.value = false
    remoteModels.value = []
    modelsError.value = ''
}

function openAdd() {
    formOpen.value = true
    editingItem.value = null
    form.value = {
        kind: 'builtin', provider: '', model: '',
        apiKey: '', baseURL: '', protocol: 'openai',
        customName: '', displayName: '',
    }
    resetForm()
}

function openAddCustom() {
    formOpen.value = true
    editingItem.value = null
    form.value = {
        kind: 'custom',
        provider: '',
        model: '',
        apiKey: '',
        baseURL: '',
        protocol: 'openai',
        customName: `custom-${Date.now()}`,
        displayName: '',
    }
    resetForm()
}

function openEdit(item) {
    formOpen.value = true
    editingItem.value = item

    const isCustomEndpoint = customEndpoints.value.some(e => e.name === item.provider)
    if (isCustomEndpoint) {
        const ep = customEndpoints.value.find(e => e.name === item.provider)
        form.value = {
            kind: 'custom',
            provider: ep.displayName || '',
            model: ep.model,
            apiKey: ep.apiKey || '',
            baseURL: ep.baseURL,
            protocol: ep.protocol || 'openai',
            customName: ep.name,
            displayName: ep.displayName || '',
        }
        resetForm()
        return
    }

    form.value = {
        kind: 'builtin',
        provider: item.provider,
        model: item.model,
        apiKey: '', baseURL: '', protocol: 'openai',
        customName: '', displayName: '',
    }
    resetForm()
    if (item.provider) fetchBuiltinModels(item.provider)
}

function cancelForm() {
    formOpen.value = false
    editingItem.value = null
    resetForm()
}

function switchKind(kind) {
    if (form.value.kind === kind) return
    form.value.kind = kind
    form.value.provider = ''
    form.value.model = ''
    form.value.baseURL = ''
    form.value.protocol = 'openai'
    form.value.customName = kind === 'custom' ? `custom-${Date.now()}` : ''
    form.value.displayName = ''
    resetForm()
}

async function saveForm() {
    formError.value = ''
    const kind = form.value.kind
    const model = form.value.model.trim()
    const apiKey = form.value.apiKey.trim()
    const baseURL = form.value.baseURL.trim().replace(/\/+$/, '')
    const protocol = form.value.protocol || 'openai'

    if (!model) { formError.value = '请选择或填写模型'; return }

    formBusy.value = true
    try {
        if (kind === 'custom') {
            if (!baseURL) { formError.value = '请填写 Base URL'; return }

            const endpointData = {
                name: form.value.customName,
                displayName: form.value.provider.trim() || '自定义端点',
                baseURL,
                apiKey,
                protocol,
                model,
            }

            const existingIdx = customEndpoints.value.findIndex(e => e.name === endpointData.name)
            if (existingIdx >= 0) {
                customEndpoints.value[existingIdx] = {
                    ...customEndpoints.value[existingIdx],
                    ...endpointData,
                    name: customEndpoints.value[existingIdx].name,
                }
            } else {
                if (customEndpoints.value.some(e => e.name === endpointData.name)) {
                    endpointData.name = `${endpointData.name}-${Date.now()}`
                }
                customEndpoints.value.push(endpointData)
            }

            persistCustomEndpoints()
            await buildClient()

            emit('add-model', {
                provider: endpointData.name,
                displayName: endpointData.displayName,
                model: endpointData.model,
                label: endpointData.displayName,
                baseURL: endpointData.baseURL,
                protocol: endpointData.protocol,
            })
        } else {
            const provider = form.value.provider.trim()
            if (!provider) { formError.value = '请选择 Provider'; return }
            const payload = { defaultModel: model }
            if (apiKey) payload.apiKey = apiKey
            await clientRef.value.configure(provider, payload)

            emit('add-model', {
                provider,
                displayName: displayName(provider),
                model,
                label: displayName(provider),
            })
        }

        formOpen.value = false
        editingItem.value = null
    } catch (e) {
        console.error('[save] 失败', e)
        formError.value = e?.message || '保存失败'
    } finally {
        formBusy.value = false
    }
}

async function testCurrent() {
    testResult.value = ''
    testOk.value = false
    const kind = form.value.kind
    const model = form.value.model.trim()
    const apiKey = form.value.apiKey.trim()
    const baseURL = form.value.baseURL.trim().replace(/\/+$/, '')
    const protocol = form.value.protocol || 'openai'

    if (!model) { testResult.value = '先选择模型'; return }
    if (kind === 'builtin') { testResult.value = '内置 Provider 请保存后直接发消息验证'; return }
    if (!baseURL) { testResult.value = '先填 Base URL'; return }

    try {
        const path = protocol === 'anthropic' ? '/messages' : '/chat/completions'
        const res = await fetch(`${baseURL}${path}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
        })
        if (res.ok) { testResult.value = '连接成功'; testOk.value = true }
        else {
            const text = await res.text().catch(() => '')
            testResult.value = `HTTP ${res.status} ${String(text).slice(0, 120)}`
        }
    } catch (e) {
        testResult.value = e?.message || '无法连接'
    }
}

function onSwitchModel(item) {
    emit('switch-model', { provider: item.provider, model: item.model })
}

function onRemoveModel(item) {
    if (window.confirm(`移除「${displayName(item.provider)} / ${item.model}」？`)) {
        emit('remove-model', item.id)
    }
}

async function onRemoveCustomEndpoint(ep) {
    if (!window.confirm(`移除自定义端点「${ep.displayName || ep.name}」？`)) return
    customEndpoints.value = customEndpoints.value.filter(e => e.name !== ep.name)
    persistCustomEndpoints()
    await buildClient()
    emit('remove-model', ep.name)
}

// 提示词 & 外观
const promptDraft = ref(props.userSystemPrompt)
watch(() => props.userSystemPrompt, v => { promptDraft.value = v })
let promptTimer = null
function onPromptInput() {
    clearTimeout(promptTimer)
    promptTimer = setTimeout(() => { emit('update:userSystemPrompt', promptDraft.value) }, 300)
}

const themeOptions = [
    { value: 'auto', label: '跟随系统', desc: '自动匹配系统外观' },
    { value: 'light', label: '浅色', desc: '始终使用浅色主题' },
    { value: 'dark', label: '深色', desc: '始终使用深色主题' },
]
function selectTheme(v) { emit('update:themeMode', v) }

// ============ 云备份（新增，独立于 useConversations 的导出导入流程） ============
// 约束：
// 1. 切到 cloud tab 时按需检测登录；未登录强引导登录；任何 401 都弹登录框
// 2. PUT / DELETE 前先拉 /v1/chat-data/info 并展示为确认提示；PUT 面板允许填写 custom_summary
// 3. 加密密码独立于账户密码，不写入任何持久化存储；上传 / 拉取成功后清空，关闭抽屉或切走 tab 也清空
// 4. 删除服务器备份 / 清空浏览器数据：两条路径互斥，各自独立二次确认

const CLOUD_INFO_URL = '/v1/chat-data/info'
const CLOUD_DATA_URL = '/v1/chat-data'
const ACTIVE_KEY = 'chat-active-id'

const cloudStatus = ref('idle')         // idle | checking | logged-in | logged-out | error
const cloudInfo = ref(null)             // /v1/chat-data/info 响应体
const cloudLocalStats = ref(null)       // 上传面板打开时统计的本地数据量
const cloudPassword = ref('')
const showCloudPassword = ref(false)
const cloudSummaryDraft = ref('')
const cloudBusy = ref(false)
const cloudMsg = ref('')
const cloudMsgType = ref('')            // success | error
const cloudAction = ref(null)           // null | 'upload' | 'delete' | 'wipe-local'
const loginModalOpen = ref(false)

function fmtTime(iso) {
    if (!iso) return '未知'
    try { return new Date(iso).toLocaleString() } catch { return iso }
}

function resetCloudMsg() { cloudMsg.value = ''; cloudMsgType.value = '' }

// 切到 cloud tab 按需检测；切走清空一次性状态
watch(activeTab, (v) => {
    if (v === 'cloud') {
        if (cloudStatus.value === 'idle') checkCloudAuth()
    } else {
        cloudPassword.value = ''
        showCloudPassword.value = false
        cloudSummaryDraft.value = ''
        cloudAction.value = null
        cloudLocalStats.value = null
    }
})

// 关闭抽屉清空密码与一次性状态
watch(() => props.showSettings, (v) => {
    if (!v) {
        cloudPassword.value = ''
        showCloudPassword.value = false
        cloudSummaryDraft.value = ''
        cloudAction.value = null
        cloudLocalStats.value = null
        resetCloudMsg()
    } else if (activeTab.value === 'cloud' && cloudStatus.value === 'idle') {
        checkCloudAuth()
    }
})

async function fetchCloudInfo() {
    try {
        const r = await fetch(CLOUD_INFO_URL, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })

        if (r.status === 401) return { ok: false, status: 401, reason: 'unauthorized' }
        if (!r.ok) return { ok: false, status: r.status, reason: 'http' }

        // 被重定向到登录页 / 其他路径：最终 URL 与请求路径不一致
        try {
            const expected = new URL(CLOUD_INFO_URL, location.origin)
            const finalUrl = new URL(r.url, location.origin)
            if (finalUrl.pathname !== expected.pathname) {
                return { ok: false, status: 401, reason: 'redirected' }
            }
        } catch {
            return { ok: false, status: 401, reason: 'redirected' }
        }

        const ct = (r.headers.get('Content-Type') || '').toLowerCase()
        if (!ct.includes('application/json')) {
            return { ok: false, status: 401, reason: 'not-json' }
        }

        let info
        try { info = await r.json() } catch { return { ok: false, status: 401, reason: 'bad-json' } }

        if (!info || typeof info !== 'object' || typeof info.exists !== 'boolean') {
            return { ok: false, status: 401, reason: 'bad-shape' }
        }

        return { ok: true, status: r.status, info }
    } catch (e) {
        return { ok: false, status: 0, reason: 'network', message: e?.message || '网络错误' }
    }
}

async function checkCloudAuth() {
    cloudStatus.value = 'checking'
    resetCloudMsg()
    const res = await fetchCloudInfo()
    if (res.ok) {
        cloudStatus.value = 'logged-in'
        cloudInfo.value = res.info
        return
    }
    cloudInfo.value = null
    if (res.reason === 'network' || res.reason === 'http') {
        cloudStatus.value = 'error'
        cloudMsg.value = res.message || `检测失败：HTTP ${res.status}`
        cloudMsgType.value = 'error'
        return
    }
    // unauthorized / redirected / not-json / bad-json / bad-shape 一律视为未登录
    cloudStatus.value = 'logged-out'
}

function openLogin() { loginModalOpen.value = true }

function onLoginChanged(state) {
    if (state === 'logged-in') {
        cloudStatus.value = 'logged-in'
        cloudMsg.value = '登录成功'
        cloudMsgType.value = 'success'
        fetchCloudInfo().then(res => { if (res.ok) cloudInfo.value = res.info })
    } else {
        cloudInfo.value = null
        checkCloudAuth()
    }
}

function handle401() {
    cloudStatus.value = 'logged-out'
    cloudInfo.value = null
    cloudMsg.value = '登录已过期，请重新登录'
    cloudMsgType.value = 'error'
    loginModalOpen.value = true
}

function cancelAction() {
    cloudAction.value = null
    cloudLocalStats.value = null
}

// 计算本地可上传的非空对话数（与陈述 2.2 空会话判定一致）
async function computeLocalStats() {
    cloudLocalStats.value = null
    try {
        const all = await exportAll()
        const msgsByConv = new Map()
        for (const m of all.messages) {
            if (!msgsByConv.has(m.conversationId)) msgsByConv.set(m.conversationId, [])
            msgsByConv.get(m.conversationId).push(m)
        }
        let count = 0, messageCount = 0
        for (const c of all.conversations) {
            const arr = msgsByConv.get(c.id) || []
            if (!arr.length) continue
            if (!arr.some(m => m.content && String(m.content).trim())) continue
            count++
            messageCount += arr.length
        }
        cloudLocalStats.value = { count, messageCount }
    } catch {
        cloudLocalStats.value = null
    }
}

// 构建上传 payload（复用陈述 2.2 空会话过滤，全程只读三表）
async function buildCloudPayload() {
    const all = await exportAll()
    const msgsByConv = new Map()
    for (const m of all.messages) {
        if (!msgsByConv.has(m.conversationId)) msgsByConv.set(m.conversationId, [])
        msgsByConv.get(m.conversationId).push(m)
    }
    const nonEmpty = all.conversations.filter(c => {
        const arr = msgsByConv.get(c.id) || []
        if (!arr.length) return false
        return arr.some(m => m.content && String(m.content).trim())
    })
    const nonEmptyIds = new Set(nonEmpty.map(c => c.id))
    return {
        version: 3,
        exportedAt: new Date().toISOString(),
        activeConversationId: '',
        conversations: nonEmpty,
        messages: all.messages.filter(m => nonEmptyIds.has(m.conversationId)),
        attachments: all.attachments.filter(a => nonEmptyIds.has(a.conversationId)),
    }
}

// 导入 payload（与 useConversations.handleImport 的去重规则一致：仅按 conversation.id）
async function importCloudPayload(data) {
    if (!data || !Array.isArray(data.conversations)) throw new Error('数据格式不正确')
    const existing = new Set((await listConversations()).map(c => c.id))
    const convs = data.conversations.filter(c => c?.id && !existing.has(c.id))
    const convIds = new Set(convs.map(c => c.id))
    const msgs = (data.messages || []).filter(m => m?.id && convIds.has(m.conversationId))
    const atts = (data.attachments || []).filter(a => a?.id && convIds.has(a.conversationId))
    if (!convs.length) return { added: 0, skipped: data.conversations.length }
    await importAll({ conversations: convs, messages: msgs, attachments: atts })
    return { added: convs.length, skipped: data.conversations.length - convs.length }
}

// -------- 上传：先拉 info 展示为确认提示 --------
async function startUpload() {
    resetCloudMsg()
    if (cloudStatus.value !== 'logged-in') { cloudMsg.value = '请先登录'; cloudMsgType.value = 'error'; return }
    if (!cloudPassword.value) { cloudMsg.value = '请先输入加密密码'; cloudMsgType.value = 'error'; return }

    cloudBusy.value = true
    try {
        const [infoRes] = await Promise.all([fetchCloudInfo(), computeLocalStats()])
        if (!infoRes.ok) {
            if (infoRes.reason === 'network' || infoRes.reason === 'http') {
                cloudMsg.value = infoRes.message || `获取云端状态失败：HTTP ${infoRes.status}`
                cloudMsgType.value = 'error'
                return
            }
            handle401()
            return
        }
        cloudInfo.value = infoRes.info
        cloudSummaryDraft.value = infoRes.info?.custom_summary || ''
        cloudAction.value = 'upload'
    } finally {
        cloudBusy.value = false
    }
}

async function confirmUpload() {
    resetCloudMsg()
    if (!cloudPassword.value) { cloudMsg.value = '请先输入加密密码'; cloudMsgType.value = 'error'; return }
    cloudBusy.value = true
    try {
        const payload = await buildCloudPayload()
        if (!payload.conversations.length) {
            cloudMsg.value = '没有可导出的对话（空对话已自动忽略）'
            cloudMsgType.value = 'error'
            cancelAction()
            return
        }
        const cipher = encryptPayload(payload, cloudPassword.value)
        const r = await fetch(CLOUD_DATA_URL, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payload_version: 'v1',
                cipher_payload: cipher,
                custom_summary: (cloudSummaryDraft.value || '').slice(0, 300) || null,
            }),
        })
        if (r.status === 401) { handle401(); return }
        if (r.status === 403) { cloudMsg.value = '同源校验失败'; cloudMsgType.value = 'error'; return }
        if (r.status === 400) {
            const d = await r.json().catch(() => null)
            cloudMsg.value = d?.message || '请求参数不合法'
            cloudMsgType.value = 'error'
            return
        }
        if (!r.ok) { cloudMsg.value = `上传失败：HTTP ${r.status}`; cloudMsgType.value = 'error'; return }

        // 200 也要校验是否被重定向到登录页
        const ct = (r.headers.get('Content-Type') || '').toLowerCase()
        if (!ct.includes('application/json')) { handle401(); return }
        const resp = await r.json().catch(() => null)
        if (!resp || typeof resp !== 'object') { handle401(); return }

        cloudMsg.value = `已上传：${payload.conversations.length} 个对话` +
            (resp?.updated_at ? `，${fmtTime(resp.updated_at)}` : '')
    } finally {
        cloudBusy.value = false
    }
}

// -------- 拉取并导入 --------
async function pullFromCloud() {
    resetCloudMsg()
    if (cloudStatus.value !== 'logged-in') { cloudMsg.value = '请先登录'; cloudMsgType.value = 'error'; return }
    if (!cloudPassword.value) { cloudMsg.value = '请先输入加密密码'; cloudMsgType.value = 'error'; return }

    cloudBusy.value = true
    try {
        const r = await fetch(CLOUD_DATA_URL, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
        if (r.status === 401) { handle401(); return }
        if (!r.ok) { cloudMsg.value = `拉取失败：HTTP ${r.status}`; cloudMsgType.value = 'error'; return }

        try {
            const expected = new URL(CLOUD_DATA_URL, location.origin)
            const finalUrl = new URL(r.url, location.origin)
            if (finalUrl.pathname !== expected.pathname) { handle401(); return }
        } catch { handle401(); return }

        const ct = (r.headers.get('Content-Type') || '').toLowerCase()
        if (!ct.includes('application/json')) { handle401(); return }

        const data = await r.json().catch(() => null)
        if (!data || typeof data !== 'object' || typeof data.exists !== 'boolean') {
            handle401()
            return
        }
        if (!data.exists || !data.cipher_payload) {
            cloudMsg.value = '云端无备份'
            cloudMsgType.value = 'error'
            return
        }
        let payload
        try {
            payload = decryptPayload(data.cipher_payload, cloudPassword.value)
        } catch (e) {
            cloudMsg.value = e?.message || '解密失败'
            cloudMsgType.value = 'error'
            return
        }
        const result = await importCloudPayload(payload)
        cloudMsg.value = result.added > 0
            ? `已导入：新增 ${result.added} 个，跳过 ${result.skipped} 个`
            : `无新对话（${result.skipped} 个已存在或无效）`
        cloudMsgType.value = 'success'
        if (result.added > 0) emit('data-imported')
        cloudPassword.value = ''
        showCloudPassword.value = false
    } finally {
        cloudBusy.value = false
    }
}

// -------- 删除服务器备份：先拉 info 展示为确认提示 --------
async function startDeleteServer() {
    resetCloudMsg()
    if (cloudStatus.value !== 'logged-in') { cloudMsg.value = '请先登录'; cloudMsgType.value = 'error'; return }

    cloudBusy.value = true
    try {
        const infoRes = await fetchCloudInfo()
        if (!infoRes.ok) {
            if (infoRes.reason === 'network' || infoRes.reason === 'http') {
                cloudMsg.value = infoRes.message || `获取云端状态失败：HTTP ${infoRes.status}`
                cloudMsgType.value = 'error'
                return
            }
            handle401()
            return
        }
        cloudInfo.value = infoRes.info
        if (!infoRes.info?.exists) {
            cloudMsg.value = '云端无备份可删除'
            cloudMsgType.value = 'error'
            return
        }
        cloudAction.value = 'delete'
    } finally {
        cloudBusy.value = false
    }
}

async function confirmDeleteServer() {
    resetCloudMsg()
    cloudBusy.value = true
    try {
        const r = await fetch(CLOUD_DATA_URL, { method: 'DELETE', credentials: 'include' })
        if (r.status === 204) {
            cloudMsg.value = '服务器备份已删除'
            cloudMsgType.value = 'success'
            cancelAction()
            fetchCloudInfo().then(res => { if (res.ok) cloudInfo.value = res.info })
            return
        }
        if (r.status === 401) { handle401(); return }
        if (r.status === 403) { cloudMsg.value = '同源校验失败'; cloudMsgType.value = 'error'; return }
        if (r.ok) {
            // 约定成功是 204；200/其他 2xx 大概率是被重定向到登录页
            handle401()
            return
        }
        cloudMsg.value = `删除失败：HTTP ${r.status}`
        cloudMsgType.value = 'error'
    } finally {
        cloudBusy.value = false
    }
}

// -------- 清空浏览器数据（本地操作，无需密码、无需 info） --------
function startWipeLocal() {
    resetCloudMsg()
    cloudAction.value = 'wipe-local'
}

async function confirmWipeLocal() {
    resetCloudMsg()
    cloudBusy.value = true
    try {
        await new Promise((resolve, reject) => {
            const req = indexedDB.open('ChatAppDB')
            req.onsuccess = () => {
                const db = req.result
                const tx = db.transaction(['conversations', 'messages', 'attachments'], 'readwrite')
                tx.objectStore('conversations').clear()
                tx.objectStore('messages').clear()
                tx.objectStore('attachments').clear()
                tx.oncomplete = () => { db.close(); resolve() }
                tx.onerror = () => reject(tx.error || new Error('事务失败'))
                tx.onabort = () => reject(new Error('事务中止'))
            }
            req.onerror = () => reject(req.error || new Error('无法打开 IndexedDB'))
        })
        try { localStorage.removeItem(ACTIVE_KEY) } catch { }
        cancelAction()
        cloudMsg.value = '浏览器数据已清空，建议刷新页面'
        cloudMsgType.value = 'success'
        emit('data-cleared')
    } catch (e) {
        cloudMsg.value = '清空失败：' + (e?.message || '未知错误')
        cloudMsgType.value = 'error'
    } finally {
        cloudBusy.value = false
    }
}
</script>

<template>
    <Teleport to="body">
        <transition name="settings">
            <div v-if="showSettings" class="settings-mask" :class="{ 'is-advanced': view === 'advanced' }"
                @click.self="$emit('close')">
                <div class="settings-panel" :class="{ 'is-advanced': view === 'advanced' }" role="dialog"
                    aria-modal="true">
                    <header class="settings-header">
                        <div class="settings-header-left">
                            <button v-if="view === 'advanced'" class="header-back" aria-label="返回" @click="backToMain">
                                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                    <path d="M11 4L6 9l5 5" stroke="currentColor" stroke-width="1.6"
                                        stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                            </button>
                            <h2 class="settings-title">{{ view === 'advanced' ? '高级配置' : '设置' }}</h2>
                        </div>
                        <button class="settings-close" aria-label="关闭" @click="$emit('close')">
                            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" stroke-width="1.6"
                                    stroke-linecap="round" />
                            </svg>
                        </button>
                    </header>

                    <template v-if="view === 'main'">
                        <nav class="settings-tabs" role="tablist">
                            <button v-for="t in tabs" :key="t.key" class="settings-tab"
                                :class="{ active: activeTab === t.key }" role="tab" :aria-selected="activeTab === t.key"
                                @click="switchTab(t.key)">{{ t.label }}</button>
                        </nav>

                        <div class="settings-body">
                            <section v-if="activeTab === 'model'" class="tab-pane">
                                <header class="pane-head">
                                    <h3 class="pane-title">模型</h3>
                                    <p class="pane-desc">点击切换，右侧编辑或移除</p>
                                </header>

                                <div v-if="models.length" class="model-list">
                                    <div v-for="item in models" :key="item.id" class="model-item"
                                        :class="{ active: item.provider === currentProvider && item.model === currentModel }">
                                        <button class="model-item-main" @click="onSwitchModel(item)">
                                            <span class="model-provider">{{ displayName(item.provider) }}</span>
                                            <span class="model-sep">/</span>
                                            <span class="model-name">{{ item.model }}</span>
                                            <span
                                                v-if="item.provider === currentProvider && item.model === currentModel"
                                                class="model-badge">使用中</span>
                                        </button>
                                        <div class="model-item-actions">
                                            <button class="icon-btn" title="编辑" @click.stop="openEdit(item)"><svg
                                                    viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                    <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor"
                                                        stroke-width="1.4" stroke-linejoin="round" />
                                                </svg></button>
                                            <button class="icon-btn danger" title="移除"
                                                @click.stop="onRemoveModel(item)"><svg viewBox="0 0 16 16" fill="none"
                                                    aria-hidden="true">
                                                    <path
                                                        d="M3.5 4.5h9M6.5 4.5V3a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1.5M5 4.5l.5 8a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l.5-8"
                                                        stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                                                        stroke-linejoin="round" />
                                                </svg></button>
                                        </div>
                                    </div>
                                </div>

                                <div v-else-if="!formOpen" class="empty-state">
                                    <p class="empty-text">还没有添加模型</p>
                                    <p class="empty-hint">点击下方“添加模型”或“添加自定义端点”开始</p>
                                </div>

                                <div class="custom-endpoints-section">
                                    <header class="pane-head" style="margin-top: 0.5rem;">
                                        <h4 class="pane-title" style="font-size: 0.875rem;">自定义端点</h4>
                                        <p class="pane-desc">可添加多个 OpenAI / Anthropic 兼容端点</p>
                                    </header>

                                    <div v-if="customEndpoints.length" class="custom-endpoint-list">
                                        <div v-for="ep in customEndpoints" :key="ep.name" class="custom-endpoint-item">
                                            <div class="custom-endpoint-info">
                                                <span class="custom-endpoint-name">{{ ep.displayName || ep.name
                                                }}</span>
                                                <span class="custom-endpoint-url">{{ ep.baseURL }}</span>
                                                <span class="custom-endpoint-model">{{ ep.model }}</span>
                                            </div>
                                            <div class="custom-endpoint-actions">
                                                <button class="icon-btn" title="编辑"
                                                    @click="openEdit({ provider: ep.name, model: ep.model })">
                                                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                        <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor"
                                                            stroke-width="1.4" stroke-linejoin="round" />
                                                    </svg>
                                                </button>
                                                <button class="icon-btn danger" title="移除"
                                                    @click="onRemoveCustomEndpoint(ep)">
                                                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                        <path
                                                            d="M3.5 4.5h9M6.5 4.5V3a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1.5M5 4.5l.5 8a.5.5 0 00.5.5h4a.5.5 0 00.5-.5l.5-8"
                                                            stroke="currentColor" stroke-width="1.4"
                                                            stroke-linecap="round" stroke-linejoin="round" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <p v-else class="empty-hint" style="font-size: 0.75rem;">尚未添加自定义端点</p>
                                </div>

                                <form v-if="formOpen" class="add-form" @submit.prevent="saveForm">
                                    <div class="add-form-head">
                                        <span class="add-form-title">{{ editingItem ? '编辑' : '添加' }}{{
                                            form.kind === 'custom' ? '自定义端点' : '模型' }}</span>
                                        <button type="button" class="add-form-close" aria-label="关闭"
                                            @click="cancelForm">
                                            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4"
                                                    stroke-linecap="round" />
                                            </svg>
                                        </button>
                                    </div>

                                    <div v-if="!editingItem" class="segmented">
                                        <button type="button" class="segment"
                                            :class="{ active: form.kind === 'builtin' }"
                                            @click="switchKind('builtin')">内置 Provider</button>
                                        <button type="button" class="segment"
                                            :class="{ active: form.kind === 'custom' }"
                                            @click="switchKind('custom')">自定义端点</button>
                                    </div>

                                    <template v-if="form.kind === 'builtin'">
                                        <label class="field">
                                            <span class="field-label">Provider <span class="req">*</span></span>
                                            <select v-model="form.provider" class="field-select">
                                                <option value="" disabled>请选择</option>
                                                <option v-for="p in BUILTIN" :key="p" :value="p">{{ displayName(p) }}
                                                </option>
                                            </select>
                                        </label>
                                        <label class="field">
                                            <span class="field-label">模型 <span class="req">*</span>
                                                <span v-if="modelsLoading" class="field-hint-inline">（拉取中…）</span>
                                                <span v-else-if="modelsError" class="field-hint-inline">（{{ modelsError
                                                }}）</span>
                                            </span>
                                            <div v-if="availableModels.length" class="field-row">
                                                <select v-model="form.model" class="field-select">
                                                    <option value="" disabled>请选择模型</option>
                                                    <option v-for="m in availableModels" :key="m" :value="m">{{ m }}
                                                    </option>
                                                </select>
                                            </div>
                                            <div v-else class="field-row">
                                                <input v-model="form.model" class="field-input"
                                                    :placeholder="modelsLoading ? '拉取中…' : '输入模型名'" autocomplete="off"
                                                    spellcheck="false" />
                                            </div>
                                        </label>
                                    </template>

                                    <template v-else>
                                        <label class="field">
                                            <span class="field-label">显示名称 <span
                                                    class="opt">（选填，留空显示“自定义端点”）</span></span>
                                            <input v-model="form.displayName" class="field-input"
                                                placeholder="例如：我的本地代理" autocomplete="off" spellcheck="false" />
                                        </label>
                                        <label class="field">
                                            <span class="field-label">Base URL <span class="req">*</span></span>
                                            <input v-model="form.baseURL" class="field-input"
                                                placeholder="https://your-endpoint.com/v1" autocomplete="off"
                                                spellcheck="false" />
                                        </label>
                                        <label class="field">
                                            <span class="field-label">协议 <span class="req">*</span></span>
                                            <select v-model="form.protocol" class="field-select">
                                                <option value="openai">OpenAI 兼容（/chat/completions）</option>
                                                <option value="anthropic">Anthropic 兼容（/messages）</option>
                                            </select>
                                        </label>
                                        <label class="field">
                                            <span class="field-label">模型 <span class="req">*</span>
                                                <span v-if="modelsLoading" class="field-hint-inline">（拉取中…）</span>
                                                <span v-else-if="modelsError" class="field-hint-inline">（{{ modelsError
                                                }}）</span>
                                            </span>
                                            <div class="field-row">
                                                <select v-if="availableModels.length" v-model="form.model"
                                                    class="field-select">
                                                    <option value="" disabled>请选择模型</option>
                                                    <option v-for="m in availableModels" :key="m" :value="m">{{ m }}
                                                    </option>
                                                </select>
                                                <input v-else v-model="form.model" class="field-input"
                                                    :placeholder="modelsLoading ? '拉取中…' : '输入模型名'" autocomplete="off"
                                                    spellcheck="false" />
                                                <button type="button" class="field-toggle"
                                                    @click="fetchCustomModels">拉取模型</button>
                                            </div>
                                        </label>
                                    </template>

                                    <label class="field">
                                        <span class="field-label">API Key
                                            <span v-if="form.kind === 'custom'" class="opt">（选填）</span>
                                            <span v-else-if="needsKey(form.provider)" class="req">*</span>
                                            <span v-else class="opt">（选填）</span>
                                            <span v-if="editingItem" class="field-hint-inline">（留空表示不修改）</span>
                                        </span>
                                        <div class="field-row">
                                            <input v-model="form.apiKey" class="field-input"
                                                :type="showKey ? 'text' : 'password'" placeholder="sk-..."
                                                autocomplete="off" spellcheck="false" />
                                            <button type="button" class="field-toggle" @click="showKey = !showKey">{{
                                                showKey ? '隐藏' : '显示' }}</button>
                                        </div>
                                    </label>

                                    <p v-if="formError" class="form-error">{{ formError }}</p>

                                    <div v-if="form.kind === 'custom'" class="test-row">
                                        <button type="button" class="btn-ghost" @click="testCurrent">测试连接</button>
                                        <span v-if="testResult" class="test-result" :class="{ ok: testOk }">{{
                                            testResult }}</span>
                                    </div>

                                    <div class="add-form-actions">
                                        <button type="button" class="btn-ghost" @click="cancelForm">取消</button>
                                        <button type="submit" class="btn-primary" :disabled="formBusy">
                                            {{ formBusy ? '保存中…' : '保存' }}
                                        </button>
                                    </div>
                                </form>

                                <div v-if="!formOpen" class="bottom-actions">
                                    <button class="add-model-btn" @click="openAdd">
                                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6"
                                                stroke-linecap="round" />
                                        </svg>
                                        添加内置模型
                                    </button>
                                    <button class="add-model-btn" @click="openAddCustom">
                                        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                            <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.6"
                                                stroke-linecap="round" />
                                        </svg>
                                        添加自定义端点
                                    </button>
                                </div>

                                <button class="advanced-btn" @click="enterAdvanced">高级配置（Token Plan / 调试台）</button>
                                <p class="model-hint">API Key 仅保存在本机浏览器，不会上传。</p>
                            </section>

                            <section v-if="activeTab === 'prompt'" class="tab-pane">
                                <header class="pane-head">
                                    <h3 class="pane-title">用户级系统提示词</h3>
                                    <p class="pane-desc">对所有对话生效，用于定义你的偏好，例如称呼、回答风格、语言</p>
                                </header>
                                <textarea v-model="promptDraft" class="prompt-input" rows="10"
                                    placeholder="例如：请称呼我为小王，回答尽量详细，优先使用中文。" @input="onPromptInput" />
                                <div class="note">
                                    <p>应用级提示词由开发者维护，不可在此修改。会话级提示词在对话树中单独设置。</p>
                                    <p>三层提示词会在每次请求时合并为一条系统消息发送给模型。</p>
                                </div>
                            </section>

                            <section v-if="activeTab === 'cloud'" class="tab-pane">
                                <header class="pane-head">
                                    <h3 class="pane-title">云备份</h3>
                                    <p class="pane-desc">
                                        上传复用现有导出流程（空会话自动剔除）→ gzip 压缩 → AES 加密 → 放入
                                        <code>cipher_payload</code>。拉取后按现有导入规则（conversation.id 去重）写回本地。
                                    </p>
                                </header>

                                <div class="cloud-auth">
                                    <template v-if="cloudStatus === 'checking'">
                                        <span class="cloud-dot"></span>检测登录状态…
                                    </template>
                                    <template v-else-if="cloudStatus === 'logged-in'">
                                        <span class="cloud-dot ok"></span>已登录
                                        <button type="button" class="cloud-link" @click="openLogin">账户</button>
                                    </template>
                                    <template v-else-if="cloudStatus === 'logged-out'">
                                        <span class="cloud-dot warn"></span>未登录
                                    </template>
                                    <template v-else>
                                        <span class="cloud-dot err"></span>状态未知
                                        <button type="button" class="cloud-link" @click="checkCloudAuth">重试</button>
                                    </template>
                                </div>

                                <div v-if="cloudStatus === 'logged-out'" class="cloud-login-guide">
                                    <p class="cloud-login-title">云备份需要登录后使用</p>
                                    <p class="cloud-login-desc">
                                        登录后可以上传、拉取、删除服务器上的加密备份。加密密码与账户密码相互独立，登录后在上传面板里单独输入。
                                    </p>
                                    <button type="button" class="btn-primary" @click="openLogin">立即登录</button>
                                </div>

                                <div v-else-if="cloudStatus === 'error'" class="cloud-login-guide">
                                    <p class="cloud-login-title">无法获取云端状态</p>
                                    <p class="cloud-login-desc">请检查网络或稍后重试。</p>
                                    <button type="button" class="btn-ghost" @click="checkCloudAuth">重试</button>
                                </div>

                                <template v-else-if="cloudStatus === 'logged-in'">
                                    <div class="cloud-info-summary">
                                        <template v-if="cloudInfo?.exists">
                                            <span class="cloud-badge ok">云端已有备份</span>
                                            <span>上次上传：{{ fmtTime(cloudInfo.updated_at) }}</span>
                                            <span v-if="cloudInfo.custom_summary">备注：{{ cloudInfo.custom_summary
                                            }}</span>
                                            <span v-if="cloudInfo.payload_version">版本：{{
                                                cloudInfo.payload_version }}</span>
                                        </template>
                                        <template v-else-if="cloudInfo">
                                            <span class="cloud-badge empty">云端暂无备份</span>
                                        </template>
                                        <template v-else>
                                            <span class="cloud-badge empty">尚未获取云端状态</span>
                                        </template>
                                        <button type="button" class="cloud-link" :disabled="cloudBusy"
                                            @click="checkCloudAuth">刷新</button>
                                    </div>

                                    <label class="field">
                                        <span class="field-label">
                                            加密密码 <span class="req">*</span>
                                            <span class="opt">（独立于账户密码；仅内存使用，不写入任何存储；上传 / 拉取成功或关闭抽屉后自动清除）</span>
                                        </span>
                                        <div class="field-row">
                                            <input v-model="cloudPassword"
                                                :type="showCloudPassword ? 'text' : 'password'" class="field-input"
                                                placeholder="加解密时输入" autocomplete="off" spellcheck="false" />
                                            <button type="button" class="field-toggle"
                                                @click="showCloudPassword = !showCloudPassword">
                                                {{ showCloudPassword ? '隐藏' : '显示' }}
                                            </button>
                                            <button type="button" class="field-toggle" :disabled="!cloudPassword"
                                                @click="cloudPassword = ''">清空</button>
                                        </div>
                                    </label>

                                    <div v-if="!cloudAction" class="cloud-actions">
                                        <button type="button" class="btn-primary" :disabled="cloudBusy"
                                            @click="startUpload">
                                            {{ cloudBusy ? '处理中…' : '上传到云端' }}
                                        </button>
                                        <button type="button" class="btn-ghost" :disabled="cloudBusy"
                                            @click="pullFromCloud">
                                            拉取并导入
                                        </button>
                                    </div>

                                    <div v-if="cloudAction === 'upload'" class="cloud-confirm">
                                        <p class="cloud-confirm-title">确认上传</p>
                                        <div class="cloud-info-block">
                                            <template v-if="cloudInfo?.exists">
                                                <p class="cloud-warn-line">⚠️ 云端已有备份，本次上传将覆盖</p>
                                                <p>上次上传：{{ fmtTime(cloudInfo.updated_at) }}</p>
                                                <p v-if="cloudInfo.custom_summary">上次备注：{{ cloudInfo.custom_summary
                                                }}</p>
                                                <p v-if="cloudInfo.payload_version">上次版本：{{
                                                    cloudInfo.payload_version }}</p>
                                            </template>
                                            <template v-else>
                                                <p>云端暂无备份，本次将新建。</p>
                                            </template>
                                            <p v-if="cloudLocalStats">
                                                本地可上传：{{ cloudLocalStats.count }} 个对话 / {{
                                                    cloudLocalStats.messageCount }} 条消息（空对话已忽略）
                                            </p>
                                        </div>
                                        <label class="field">
                                            <span class="field-label">备注 <span class="opt">（可选，≤300
                                                    字）</span></span>
                                            <input v-model="cloudSummaryDraft" class="field-input" maxlength="300"
                                                placeholder="例如：2026-10 全量备份" autocomplete="off" spellcheck="false" />
                                        </label>
                                        <div class="cloud-confirm-actions">
                                            <button type="button" class="btn-ghost" :disabled="cloudBusy"
                                                @click="cancelAction">取消</button>
                                            <button type="button" class="btn-primary" :disabled="cloudBusy"
                                                @click="confirmUpload">
                                                {{ cloudBusy ? '上传中…' : '确认上传' }}
                                            </button>
                                        </div>
                                    </div>

                                    <div v-if="cloudAction === 'delete'" class="cloud-confirm danger">
                                        <p class="cloud-confirm-title">确认删除服务器备份</p>
                                        <div class="cloud-info-block">
                                            <template v-if="cloudInfo?.exists">
                                                <p>将要删除的云端备份：</p>
                                                <p>上次上传：{{ fmtTime(cloudInfo.updated_at) }}</p>
                                                <p v-if="cloudInfo.custom_summary">备注：{{ cloudInfo.custom_summary }}
                                                </p>
                                                <p v-if="cloudInfo.payload_version">版本：{{
                                                    cloudInfo.payload_version }}</p>
                                            </template>
                                            <p v-else>云端无备份可删除。</p>
                                            <p class="danger-hint">物理删除，不可恢复；不影响浏览器本地对话。</p>
                                        </div>
                                        <div class="cloud-confirm-actions">
                                            <button type="button" class="btn-ghost" :disabled="cloudBusy"
                                                @click="cancelAction">取消</button>
                                            <button type="button" class="btn-danger"
                                                :disabled="cloudBusy || !cloudInfo?.exists"
                                                @click="confirmDeleteServer">
                                                {{ cloudBusy ? '删除中…' : '确认删除' }}
                                            </button>
                                        </div>
                                    </div>

                                    <div v-if="cloudAction === 'wipe-local'" class="cloud-confirm danger">
                                        <p class="cloud-confirm-title">确认清空浏览器数据</p>
                                        <div class="cloud-info-block">
                                            <p>将清空本地 IndexedDB 中的全部对话、消息与附件摘要。</p>
                                            <p class="danger-hint">
                                                此操作不可恢复；<strong>不影响云端备份</strong>。若尚未上传备份，清空后数据将无法找回。
                                            </p>
                                        </div>
                                        <div class="cloud-confirm-actions">
                                            <button type="button" class="btn-ghost" :disabled="cloudBusy"
                                                @click="cancelAction">取消</button>
                                            <button type="button" class="btn-danger" :disabled="cloudBusy"
                                                @click="confirmWipeLocal">
                                                {{ cloudBusy ? '清空中…' : '确认清空' }}
                                            </button>
                                        </div>
                                    </div>

                                    <div v-if="!cloudAction" class="cloud-danger">
                                        <h4 class="danger-title">危险操作</h4>
                                        <div class="danger-row">
                                            <div class="danger-info">
                                                <p class="danger-name">删除服务器备份</p>
                                                <p class="danger-desc">物理删除云端密文，不可恢复；不影响浏览器本地对话。</p>
                                            </div>
                                            <button type="button" class="btn-ghost danger" :disabled="cloudBusy"
                                                @click="startDeleteServer">
                                                删除
                                            </button>
                                        </div>
                                        <div class="danger-row">
                                            <div class="danger-info">
                                                <p class="danger-name">清空浏览器数据</p>
                                                <p class="danger-desc">清空本地 IndexedDB 中所有对话、消息与附件摘要，不可恢复；不影响云端备份。
                                                </p>
                                            </div>
                                            <button type="button" class="btn-ghost danger" :disabled="cloudBusy"
                                                @click="startWipeLocal">
                                                清空
                                            </button>
                                        </div>
                                    </div>
                                </template>

                                <p v-if="cloudMsg" class="cloud-msg" :class="cloudMsgType">{{ cloudMsg }}</p>

                                <div class="note">
                                    <p>加密密码与账户密码相互独立，请牢记，一经丢失无法找回</p>
                                </div>

                                <LoginModal :show="loginModalOpen" probe-url="/v1/chat-data/info"
                                    @close="loginModalOpen = false" @changed="onLoginChanged" />
                            </section>

                            <section v-if="activeTab === 'appearance'" class="tab-pane">
                                <header class="pane-head">
                                    <h3 class="pane-title">主题</h3>
                                    <p class="pane-desc">选择界面配色方案</p>
                                </header>
                                <div class="theme-list">
                                    <button v-for="opt in themeOptions" :key="opt.value" class="theme-option"
                                        :class="{ active: themeMode === opt.value }" @click="selectTheme(opt.value)">
                                        <span class="theme-preview" :data-theme-preview="opt.value" />
                                        <span class="theme-text">
                                            <span class="theme-label">{{ opt.label }}</span>
                                            <span class="theme-desc">{{ opt.desc }}</span>
                                        </span>
                                        <span class="theme-check">
                                            <svg v-if="themeMode === opt.value" viewBox="0 0 16 16" fill="none"
                                                aria-hidden="true">
                                                <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" stroke-width="1.6"
                                                    stroke-linecap="round" stroke-linejoin="round" />
                                            </svg>
                                        </span>
                                    </button>
                                </div>
                            </section>
                        </div>
                    </template>

                    <div v-else class="settings-body advanced-body">
                        <llm-hub-config storage="localStorage" locale="zh" />
                    </div>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
/* 原有样式全部保留 */
.custom-endpoints-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--acu-border);
}

.custom-endpoint-list {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.custom-endpoint-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.625rem;
}

.custom-endpoint-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    min-width: 0;
}

.custom-endpoint-name {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--acu-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.custom-endpoint-url {
    font-size: 0.6875rem;
    color: var(--acu-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.custom-endpoint-model {
    font-size: 0.6875rem;
    color: var(--acu-primary);
}

.custom-endpoint-actions {
    display: flex;
    gap: 0.125rem;
    flex: 0 0 auto;
}

.bottom-actions {
    display: flex;
    gap: 0.5rem;
}

.bottom-actions .add-model-btn {
    flex: 1;
}

.settings-mask {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
    transition: padding 0.2s ease;
}

.settings-mask.is-advanced {
    padding: 0;
}

.settings-panel {
    width: min(52rem, 100%);
    height: min(85vh, 44rem);
    display: flex;
    flex-direction: column;
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 1rem;
    box-shadow: var(--acu-shadow-lg);
    overflow: hidden;
    transition: width 0.2s ease, height 0.2s ease, border-radius 0.2s ease;
}

.settings-panel.is-advanced {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    border-radius: 0;
    border: none;
}

.settings-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1.125rem 1.5rem;
    border-bottom: 1px solid var(--acu-border);
}

.settings-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.header-back {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-secondary);
    background: transparent;
    border: 1px solid var(--acu-border);
    border-radius: 0.4375rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.header-back svg {
    width: 1rem;
    height: 1rem;
}

.header-back:hover {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-color: var(--acu-primary-soft);
}

.settings-title {
    margin: 0;
    font-size: 1.0625rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--acu-text);
    white-space: nowrap;
}

.settings-close {
    flex: 0 0 auto;
    width: 2rem;
    height: 2rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: transparent;
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.settings-close svg {
    width: 1.125em;
    height: 1.125em;
}

.settings-close:hover {
    color: var(--acu-text);
    background: var(--acu-surface-2);
    border-color: var(--acu-border-strong);
}

.settings-tabs {
    flex: 0 0 auto;
    display: flex;
    gap: 0.25rem;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--acu-border);
}

.settings-tab {
    position: relative;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--acu-text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: color 0.15s ease;
}

.settings-tab:hover {
    color: var(--acu-text-secondary);
}

.settings-tab.active {
    color: var(--acu-primary);
}

.settings-tab.active::after {
    content: '';
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: -1px;
    height: 2px;
    background: var(--acu-primary);
    border-radius: 2px 2px 0 0;
}

.settings-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 1.5rem;
    scrollbar-width: thin;
    scrollbar-color: var(--acu-border-strong) transparent;
}

.settings-body::-webkit-scrollbar {
    width: 0.375rem;
}

.settings-body::-webkit-scrollbar-thumb {
    background: var(--acu-border-strong);
    border-radius: 999rem;
}

.advanced-body {
    padding: 2rem;
}

.advanced-body>* {
    display: block;
    width: 100%;
    min-width: 0;
}

.tab-pane {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.pane-head {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.pane-title {
    margin: 0;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--acu-text);
}

.pane-desc {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--acu-text-muted);
}

.model-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.model-item {
    display: flex;
    align-items: stretch;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.75rem;
    transition: border-color 0.15s ease, background 0.15s ease;
}

.model-item:hover {
    border-color: var(--acu-border-strong);
}

.model-item.active {
    border-color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.model-item-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.875rem 1rem;
    font-size: 0.8125rem;
    color: var(--acu-text);
    background: transparent;
    border: none;
    text-align: left;
    cursor: pointer;
    border-radius: 0.75rem 0 0 0.75rem;
}

.model-provider {
    padding: 0.125rem 0.4375rem;
    font-size: 0.75rem;
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-radius: 0.25rem;
}

.model-item.active .model-provider {
    background: var(--acu-primary-soft-hover);
}

.model-sep {
    color: var(--acu-text-muted);
}

.model-name {
    color: var(--acu-text);
    word-break: break-all;
}

.model-badge {
    margin-left: auto;
    padding: 0.0625rem 0.4375rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--acu-primary);
    background: var(--acu-primary-soft-hover);
    border-radius: 999rem;
}

.model-item-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding-right: 0.375rem;
}

.icon-btn {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.icon-btn svg {
    width: 0.875rem;
    height: 0.875rem;
}

.icon-btn:hover {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.icon-btn.danger:hover {
    color: var(--acu-error);
    background: var(--acu-error-soft);
}

.add-form {
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
    padding: 1rem 1.125rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.75rem;
}

.add-form-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
}

.add-form-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--acu-text);
}

.add-form-close {
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
}

.add-form-close svg {
    width: 0.875rem;
    height: 0.875rem;
}

.add-form-close:hover {
    color: var(--acu-error);
    background: var(--acu-error-soft);
}

.segmented {
    display: flex;
    padding: 0.1875rem;
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    gap: 0.1875rem;
}

.segment {
    flex: 1 1 0;
    padding: 0.5rem 0.75rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
    background: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
}

.segment.active {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.segment:hover:not(.active) {
    color: var(--acu-text);
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.field-label {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
}

.req {
    color: var(--acu-error);
    font-weight: 600;
}

.opt {
    color: var(--acu-text-muted);
    font-weight: 400;
}

.field-hint-inline {
    color: var(--acu-text-muted);
    font-weight: 400;
}

.field-input,
.field-select {
    width: 100%;
    box-sizing: border-box;
    height: 2.375rem;
    padding: 0 0.75rem;
    font-family: inherit;
    font-size: 0.8125rem;
    color: var(--acu-text);
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-select {
    appearance: none;
    padding-right: 2rem;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none'%3E%3Cpath d='M4 6l4 4 4-4' stroke='%23888' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.625rem center;
    background-size: 1rem;
    cursor: pointer;
}

.field-input:focus,
.field-select:focus {
    border-color: var(--acu-primary);
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.field-input:disabled,
.field-select:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.field-row {
    display: flex;
    gap: 0.5rem;
}

.field-row .field-input {
    flex: 1 1 auto;
}

.field-toggle {
    flex: 0 0 auto;
    height: 2.375rem;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    color: var(--acu-text-secondary);
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    cursor: pointer;
    white-space: nowrap;
}

.field-toggle:hover {
    color: var(--acu-primary);
    border-color: var(--acu-primary);
}

.form-error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--acu-error);
}

.test-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
}

.test-result {
    font-size: 0.75rem;
    color: var(--acu-error);
    word-break: break-all;
}

.test-result.ok {
    color: var(--acu-success);
}

.add-form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.25rem;
}

.btn-primary,
.btn-ghost {
    height: 2.25rem;
    padding: 0 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.btn-primary {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border: 1px solid var(--acu-primary);
}

.btn-primary:hover {
    background: var(--acu-primary-hover);
    border-color: var(--acu-primary-hover);
}

.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.btn-ghost {
    color: var(--acu-text-secondary);
    background: transparent;
    border: 1px solid var(--acu-border);
}

.btn-ghost:hover {
    color: var(--acu-text);
    background: var(--acu-surface);
    border-color: var(--acu-border-strong);
}

.add-model-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.875rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
    background: transparent;
    border: 1px dashed var(--acu-border-strong);
    border-radius: 0.75rem;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.add-model-btn svg {
    width: 0.875rem;
    height: 0.875rem;
}

.add-model-btn:hover {
    color: var(--acu-primary);
    border-color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.advanced-btn {
    align-self: flex-start;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
    background: transparent;
    border: 1px solid var(--acu-border);
    border-radius: 0.375rem;
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease;
}

.advanced-btn:hover {
    color: var(--acu-primary);
    border-color: var(--acu-primary);
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1.5rem 1rem;
    text-align: center;
}

.empty-text {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--acu-text);
}

.empty-hint {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--acu-text-muted);
}

.model-hint {
    margin: 0;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
}

.prompt-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.875rem 1.125rem;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.7;
    color: var(--acu-text);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.75rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.prompt-input:focus {
    border-color: var(--acu-primary);
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.prompt-input::placeholder {
    color: var(--acu-text-muted);
}

.note {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem 1.125rem;
    background: var(--acu-surface);
    border-radius: 0.75rem;
}

.note p {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.65;
    color: var(--acu-text-muted);
}

.theme-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.theme-option {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.875rem 1.125rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.75rem;
    cursor: pointer;
    text-align: left;
    transition: border-color 0.15s ease, background 0.15s ease;
}

.theme-option:hover {
    border-color: var(--acu-border-strong);
}

.theme-option.active {
    border-color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.theme-preview {
    flex: 0 0 auto;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.5rem;
    border: 1px solid var(--acu-border);
}

.theme-preview[data-theme-preview='light'] {
    background: #f8f0e4;
}

.theme-preview[data-theme-preview='dark'] {
    background: #15181d;
}

.theme-preview[data-theme-preview='auto'] {
    background: linear-gradient(135deg, #f8f0e4 0 50%, #15181d 50% 100%);
}

.theme-text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
}

.theme-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--acu-text);
}

.theme-desc {
    font-size: 0.75rem;
    color: var(--acu-text-muted);
}

.theme-check {
    flex: 0 0 auto;
    width: 1.25rem;
    height: 1.25rem;
    display: grid;
    place-items: center;
    color: var(--acu-primary);
}

.theme-check svg {
    width: 1rem;
    height: 1rem;
}

.settings-enter-active,
.settings-leave-active {
    transition: opacity 0.2s ease;
}

.settings-enter-active .settings-panel,
.settings-leave-active .settings-panel {
    transition: transform 0.2s ease, opacity 0.2s ease;
}

.settings-enter-from,
.settings-leave-to {
    opacity: 0;
}

.settings-enter-from .settings-panel,
.settings-leave-to .settings-panel {
    opacity: 0;
    transform: scale(0.97);
}

@media (max-width: 48rem) {
    .settings-mask {
        padding: 0;
    }

    .settings-mask.is-advanced {
        padding: 0;
    }

    .settings-panel {
        width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        border: none;
    }

    .settings-header,
    .settings-tabs,
    .settings-body {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .advanced-body {
        padding: 1rem;
    }
}

@media (prefers-reduced-motion: reduce) {

    .settings-enter-active,
    .settings-leave-active,
    .settings-enter-active .settings-panel,
    .settings-leave-active .settings-panel {
        transition: none;
    }
}

/* ============ 云备份（新增） ============ */
.cloud-auth {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.8125rem;
    color: var(--acu-text-secondary);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
}

.cloud-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--acu-border-strong);
}

.cloud-dot.ok {
    background: var(--acu-success);
}

.cloud-dot.warn {
    background: var(--acu-error);
}

.cloud-dot.err {
    background: var(--acu-warning, var(--acu-error));
}

.cloud-link {
    padding: 0;
    margin-left: auto;
    font-size: 0.75rem;
    color: var(--acu-primary);
    background: transparent;
    border: none;
    cursor: pointer;
}

.cloud-link:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.cloud-link:hover:not(:disabled) {
    text-decoration: underline;
}

.cloud-login-guide {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.125rem;
    background: var(--acu-surface);
    border: 1px dashed var(--acu-border-strong);
    border-radius: 0.75rem;
}

.cloud-login-title {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--acu-text);
}

.cloud-login-desc {
    margin: 0;
    font-size: 0.75rem;
    line-height: 1.65;
    color: var(--acu-text-muted);
}

.cloud-login-guide>.btn-primary,
.cloud-login-guide>.btn-ghost {
    align-self: flex-start;
}

.cloud-info-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.75rem;
    color: var(--acu-text-secondary);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
}

.cloud-badge {
    padding: 0.0625rem 0.4375rem;
    border-radius: 999rem;
    font-size: 0.6875rem;
    font-weight: 500;
}

.cloud-badge.ok {
    color: var(--acu-success);
    background: var(--acu-success-soft, rgba(46, 160, 67, 0.12));
}

.cloud-badge.empty {
    color: var(--acu-text-muted);
    background: var(--acu-surface-2);
}

.cloud-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.cloud-confirm {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border-strong);
    border-radius: 0.5rem;
}

.cloud-confirm.danger {
    border-color: var(--acu-error);
    background: var(--acu-error-soft);
}

.cloud-confirm-title {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--acu-text);
}

.cloud-info-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.625rem 0.75rem;
    font-size: 0.75rem;
    line-height: 1.6;
    color: var(--acu-text-secondary);
    background: var(--acu-bg);
    border-radius: 0.375rem;
}

.cloud-info-block p {
    margin: 0;
}

.cloud-warn-line {
    color: var(--acu-error);
    font-weight: 600;
}

.danger-hint {
    color: var(--acu-error);
    font-weight: 500;
}

.cloud-confirm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.cloud-danger {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem 1rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    margin-top: 0.5rem;
}

.danger-title {
    margin: 0;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--acu-error);
}

.danger-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid var(--acu-border);
}

.danger-row:first-of-type {
    border-top: none;
    padding-top: 0;
}

.danger-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.danger-name {
    margin: 0;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--acu-text);
}

.danger-desc {
    margin: 0;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
    line-height: 1.55;
}

.btn-ghost.danger {
    color: var(--acu-error);
    border-color: var(--acu-error);
}

.btn-ghost.danger:hover {
    background: var(--acu-error-soft);
    color: var(--acu-error);
}

.btn-danger {
    height: 2.25rem;
    padding: 0 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #fff;
    background: var(--acu-error);
    border: 1px solid var(--acu-error);
    border-radius: 0.5rem;
    cursor: pointer;
}

.btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.cloud-msg {
    margin: 0;
    font-size: 0.75rem;
    word-break: break-all;
}

.cloud-msg.success {
    color: var(--acu-success);
}

.cloud-msg.error {
    color: var(--acu-error);
}
</style>