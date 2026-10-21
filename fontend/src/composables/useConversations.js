import { ref, computed, watch } from 'vue'
import { uid } from 'zen-ai-chat-ui'

const STORAGE_KEY = 'chat-conversations'

export function useConversations({ showNotice, onConversationSwitch } = {}) {
    const messages = ref([])
    const conversations = ref([])
    const activeConversationId = ref('')
    const selectMode = ref(false)
    const selectedIds = ref([])

    const activeConversation = computed(() =>
        conversations.value.find(c => c.id === activeConversationId.value)
    )

    function makeTitleFromText(text) {
        const t = text.trim().replace(/\s+/g, ' ')
        return t.length > 22 ? t.slice(0, 22) + '…' : t
    }

    function createConversation() {
        if (selectMode.value) cancelSelectMode()
        const id = uid('conv')
        const conv = {
            id,
            title: '新对话',
            updatedAt: Date.now(),
            messages: [],
        }
        conversations.value.unshift(conv)
        activeConversationId.value = id
        messages.value = conv.messages
        onConversationSwitch?.()
        persist()
        return conv
    }

    function switchConversation(id) {
        if (id === activeConversationId.value) return
        const conv = conversations.value.find(c => c.id === id)
        if (!conv) return

        onConversationSwitch?.()
        activeConversationId.value = id
        messages.value = conv.messages
    }

    function closeConversation(id) {
        const idx = conversations.value.findIndex(c => c.id === id)
        if (idx < 0) return
        conversations.value.splice(idx, 1)

        if (activeConversationId.value === id) {
            const next = conversations.value[0]
            if (next) {
                onConversationSwitch?.()
                activeConversationId.value = next.id
                messages.value = next.messages
            } else {
                onConversationSwitch?.()
                activeConversationId.value = ''
                messages.value = []
            }
        }
        persist()
    }

    // 自动生成标题
    watch(
        () => messages.value.length,
        () => {
            const conv = activeConversation.value
            if (!conv || conv.title !== '新对话') return
            const firstUser = messages.value.find(m => m.role === 'user' && m.content)
            if (firstUser) {
                conv.title = makeTitleFromText(firstUser.content)
                conv.updatedAt = Date.now()
                persist()
            }
        }
    )

    let persistTimer = null
    function persist() {
        clearTimeout(persistTimer)
        persistTimer = setTimeout(() => {
            try {
                const data = conversations.value.map(c => ({
                    id: c.id,
                    title: c.title,
                    updatedAt: c.updatedAt,
                    messages: c.messages,
                }))
                localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
                localStorage.setItem(STORAGE_KEY + ':active', activeConversationId.value)
            } catch (e) {
                console.warn('[persist] 保存失败', e)
                showNotice?.('保存失败：浏览器存储空间可能已满')
            }
        }, 300)
    }

    function loadConversations() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY)
            if (!raw) return false
            const data = JSON.parse(raw)
            if (!Array.isArray(data) || data.length === 0) return false

            conversations.value = data.map(c => ({
                id: c.id,
                title: c.title || '未命名对话',
                updatedAt: c.updatedAt || Date.now(),
                messages: Array.isArray(c.messages) ? c.messages : [],
            }))

            const savedActive = localStorage.getItem(STORAGE_KEY + ':active')
            const target =
                conversations.value.find(c => c.id === savedActive) || conversations.value[0]
            activeConversationId.value = target.id
            messages.value = target.messages
            return true
        } catch (e) {
            console.warn('[loadConversations] 读取失败', e)
            return false
        }
    }

    // ================= 选择模式 =================
    function enterSelectMode() {
        if (!conversations.value.length) {
            showNotice?.('当前没有可选择的对话')
            return
        }
        selectMode.value = true
        selectedIds.value = []
    }

    function cancelSelectMode() {
        selectMode.value = false
        selectedIds.value = []
    }

    function toggleSelect(id) {
        const idx = selectedIds.value.indexOf(id)
        if (idx >= 0) selectedIds.value.splice(idx, 1)
        else selectedIds.value.push(id)
    }

    function toggleSelectAll() {
        if (selectedIds.value.length === conversations.value.length) {
            selectedIds.value = []
        } else {
            selectedIds.value = conversations.value.map(c => c.id)
        }
    }

    // ================= 导入导出 =================
    function isEmptyConversation(c) {
        if (!c || !Array.isArray(c.messages) || c.messages.length === 0) return true
        return c.messages.every(m => {
            if (!m) return true
            const content = m.content
            if (!content) return true
            return typeof content === 'string' && content.trim() === ''
        })
    }

    function exportConversations(list) {
        try {
            const source = Array.isArray(list) ? list : conversations.value
            const target = source.filter(c => !isEmptyConversation(c))
            const ignored = source.length - target.length

            if (!target.length) {
                showNotice?.('没有可导出的对话（空对话已自动忽略）')
                return false
            }

            const activeInTarget = target.some(c => c.id === activeConversationId.value)
            const payload = {
                version: 1,
                exportedAt: new Date().toISOString(),
                activeConversationId: activeInTarget ? activeConversationId.value : '',
                conversations: target.map(c => ({
                    id: c.id,
                    title: c.title,
                    updatedAt: c.updatedAt,
                    messages: c.messages,
                })),
            }
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
            a.href = url
            a.download = `chat-backup-${ts}.json`
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
            showNotice?.(`已导出 ${target.length} 个对话${ignored ? `，忽略 ${ignored} 个空对话` : ''}`)
            return true
        } catch (e) {
            console.error('[export] 失败', e)
            showNotice?.('导出失败：' + (e?.message || '未知错误'))
            return false
        }
    }

    function exportAllConversations() {
        exportConversations()
    }

    function exportSelected() {
        const list = conversations.value.filter(c => selectedIds.value.includes(c.id))
        if (!list.length) {
            showNotice?.('请先勾选要导出的对话')
            return
        }
        if (exportConversations(list)) cancelSelectMode()
    }

    async function handleImport(file) {
        if (!file) return
        try {
            const text = await file.text()
            const data = JSON.parse(text)
            if (!data || !Array.isArray(data.conversations)) {
                throw new Error('文件格式不正确')
            }

            const existingIds = new Set(conversations.value.map(c => c.id))
            let added = 0
            let skipped = 0

            for (const c of data.conversations) {
                if (!c || typeof c.id !== 'string' || !Array.isArray(c.messages)) {
                    skipped++
                    continue
                }
                if (isEmptyConversation(c)) {
                    skipped++
                    continue
                }
                if (existingIds.has(c.id)) {
                    skipped++
                    continue
                }
                conversations.value.push({
                    id: c.id,
                    title: typeof c.title === 'string' && c.title ? c.title : '未命名对话',
                    updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
                    messages: c.messages,
                })
                existingIds.add(c.id)
                added++
            }

            conversations.value.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

            if (!conversations.value.find(c => c.id === activeConversationId.value)) {
                const first = conversations.value[0]
                if (first) {
                    onConversationSwitch?.()
                    activeConversationId.value = first.id
                    messages.value = first.messages
                }
            }

            persist()
            if (added === 0) {
                showNotice?.(`导入完成：没有新对话（${skipped} 个为空、已存在或无效）`)
            } else {
                showNotice?.(`导入完成：新增 ${added} 个${skipped ? `，跳过 ${skipped} 个` : ''}`)
            }
        } catch (e) {
            console.error('[import] 失败', e)
            showNotice?.('导入失败：' + (e?.message || '未知错误'))
        }
    }

    return {
        messages,
        conversations,
        activeConversationId,
        activeConversation,
        selectMode,
        selectedIds,
        createConversation,
        switchConversation,
        closeConversation,
        enterSelectMode,
        cancelSelectMode,
        toggleSelect,
        toggleSelectAll,
        exportAllConversations,
        exportSelected,
        handleImport,
        persist,
        loadConversations,
    }
}