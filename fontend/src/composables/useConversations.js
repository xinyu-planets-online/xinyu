import { ref, computed } from 'vue'
import { uid } from 'zen-ai-chat-ui'

const STORAGE_KEY = 'chat-conversations'
const STORAGE_VERSION = 2

export function useConversations({ showNotice, onConversationSwitch } = {}) {
    const conversations = ref([])
    const activeConversationId = ref('')
    const selectMode = ref(false)
    const selectedIds = ref([])

    const activeConversation = computed(() =>
        conversations.value.find(c => c.id === activeConversationId.value)
    )

    // 当前路径（用于 ChatContainer）
    const messages = computed(() => {
        const conv = activeConversation.value
        if (!conv || !conv.currentLeafId) return []
        const path = []
        let cur = conv.currentLeafId
        const guard = new Set()
        while (cur && conv.nodes[cur] && !guard.has(cur)) {
            guard.add(cur)
            path.unshift(conv.nodes[cur])
            cur = conv.nodes[cur].parentId
        }
        return path
    })

    function makeTitleFromText(text) {
        const t = text.trim().replace(/\s+/g, ' ')
        return t.length > 22 ? t.slice(0, 22) + '…' : t
    }

    function createConversation() {
        if (selectMode.value) cancelSelectMode()
        const id = uid('conv')
        const conv = { id, title: '新对话', updatedAt: Date.now(), nodes: {}, currentLeafId: null }
        conversations.value.unshift(conv)
        activeConversationId.value = id
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
    }

    function closeConversation(id) {
        const idx = conversations.value.findIndex(c => c.id === id)
        if (idx < 0) return
        conversations.value.splice(idx, 1)
        if (activeConversationId.value === id) {
            const next = conversations.value[0]
            onConversationSwitch?.()
            activeConversationId.value = next?.id || ''
        }
        persist()
    }

    // ============ 节点操作 ============
    function addNode({ role, content = '', parentId, id, status = 'done', ...extra }) {
        const conv = activeConversation.value
        if (!conv) return null
        const node = {
            id: id || uid(role === 'user' ? 'u' : 'a'),
            parentId: parentId !== undefined ? parentId : conv.currentLeafId,
            role,
            content,
            status,
            createdAt: Date.now(),
            ...extra,
        }
        conv.nodes[node.id] = node
        conv.currentLeafId = node.id
        if (conv.title === '新对话' && role === 'user' && content) {
            conv.title = makeTitleFromText(content)
        }
        conv.updatedAt = Date.now()
        return node
    }

    // 编辑 user 消息：产生兄弟节点
    function editUserMessage(nodeId, newContent) {
        const conv = activeConversation.value
        const old = conv?.nodes[nodeId]
        if (!old || old.role !== 'user') return null
        return addNode({
            role: 'user',
            content: newContent,
            parentId: old.parentId,
        })
    }

    // 撤回：当前路径截断到该节点的父节点
    function revertToNode(nodeId) {
        const conv = activeConversation.value
        const node = conv?.nodes[nodeId]
        if (!node) return
        conv.currentLeafId = node.parentId ?? null
        conv.updatedAt = Date.now()
    }

    // 切换分支：点击某节点 → 沿"最新后代"一路到叶子
    function switchToNode(nodeId) {
        const conv = activeConversation.value
        if (!conv?.nodes[nodeId]) return
        let cur = nodeId
        const guard = new Set()
        while (true) {
            if (guard.has(cur)) break
            guard.add(cur)
            const children = Object.values(conv.nodes).filter(n => n.parentId === cur)
            if (!children.length) break
            children.sort((a, b) => b.createdAt - a.createdAt)
            cur = children[0].id
        }
        conv.currentLeafId = cur
        conv.updatedAt = Date.now()
    }

    // 兄弟节点（用于显示分支页码）
    function getSiblings(nodeId) {
        const conv = activeConversation.value
        const node = conv?.nodes[nodeId]
        if (!node) return []
        return Object.values(conv.nodes)
            .filter(n => n.parentId === node.parentId)
            .sort((a, b) => a.createdAt - b.createdAt)
    }

    // ============ 持久化 ============
    let persistTimer = null
    function persist() {
        clearTimeout(persistTimer)
        persistTimer = setTimeout(() => {
            try {
                const data = conversations.value.map(c => ({
                    id: c.id, title: c.title, updatedAt: c.updatedAt,
                    nodes: c.nodes, currentLeafId: c.currentLeafId,
                }))
                localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, conversations: data }))
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
            const parsed = JSON.parse(raw)
            let convList
            if (Array.isArray(parsed)) convList = parsed.map(migrateLegacy)
            else if (parsed?.conversations) convList = parsed.conversations.map(migrateNodeFormat)
            else return false
            if (!convList.length) return false

            conversations.value = convList
            const savedActive = localStorage.getItem(STORAGE_KEY + ':active')
            const target = conversations.value.find(c => c.id === savedActive) || conversations.value[0]
            activeConversationId.value = target.id
            return true
        } catch (e) {
            console.warn('[loadConversations] 读取失败', e)
            return false
        }
    }

    function migrateLegacy(c) {
        const nodes = {}
        let parentId = null, leafId = null
            ; (c.messages || []).forEach(m => {
                const node = {
                    id: m.id || uid(m.role === 'user' ? 'u' : 'a'),
                    parentId, role: m.role,
                    content: m.content || '', status: m.status || 'done',
                    createdAt: m.createdAt || Date.now(),
                }
                nodes[node.id] = node
                parentId = node.id
                leafId = node.id
            })
        return { id: c.id, title: c.title || '未命名对话', updatedAt: c.updatedAt || Date.now(), nodes, currentLeafId: leafId }
    }

    function migrateNodeFormat(c) {
        const nodes = {}
        Object.entries(c.nodes || {}).forEach(([id, n]) => {
            nodes[id] = {
                id, parentId: n.parentId ?? null, role: n.role,
                content: n.content || '', status: n.status || 'done',
                createdAt: n.createdAt || Date.now(),
            }
        })
        return { id: c.id, title: c.title || '未命名对话', updatedAt: c.updatedAt || Date.now(), nodes, currentLeafId: c.currentLeafId || null }
    }

    // ============ 选择模式 ============
    function enterSelectMode() {
        if (!conversations.value.length) { showNotice?.('当前没有可选择的对话'); return }
        selectMode.value = true
        selectedIds.value = []
    }
    function cancelSelectMode() { selectMode.value = false; selectedIds.value = [] }
    function toggleSelect(id) {
        const i = selectedIds.value.indexOf(id)
        i >= 0 ? selectedIds.value.splice(i, 1) : selectedIds.value.push(id)
    }
    function toggleSelectAll() {
        selectedIds.value = selectedIds.value.length === conversations.value.length
            ? [] : conversations.value.map(c => c.id)
    }

    // ============ 导入导出 ============
    function isEmptyConversation(c) {
        const nodes = Object.values(c?.nodes || {})
        if (!nodes.length) return true
        return nodes.every(n => !n.content || (typeof n.content === 'string' && !n.content.trim()))
    }

    function exportConversations(list) {
        try {
            const source = Array.isArray(list) ? list : conversations.value
            const target = source.filter(c => !isEmptyConversation(c))
            const ignored = source.length - target.length
            if (!target.length) { showNotice?.('没有可导出的对话（空对话已自动忽略）'); return false }

            const activeInTarget = target.some(c => c.id === activeConversationId.value)
            const payload = {
                version: STORAGE_VERSION,
                exportedAt: new Date().toISOString(),
                activeConversationId: activeInTarget ? activeConversationId.value : '',
                conversations: target.map(c => ({
                    id: c.id, title: c.title, updatedAt: c.updatedAt,
                    nodes: c.nodes, currentLeafId: c.currentLeafId,
                })),
            }
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
            a.href = url; a.download = `chat-backup-${ts}.json`
            document.body.appendChild(a); a.click(); document.body.removeChild(a)
            URL.revokeObjectURL(url)
            showNotice?.(`已导出 ${target.length} 个对话${ignored ? `，忽略 ${ignored} 个空对话` : ''}`)
            return true
        } catch (e) {
            console.error('[export] 失败', e)
            showNotice?.('导出失败：' + (e?.message || '未知错误'))
            return false
        }
    }

    function exportAllConversations() { exportConversations() }
    function exportSelected() {
        const list = conversations.value.filter(c => selectedIds.value.includes(c.id))
        if (!list.length) { showNotice?.('请先勾选要导出的对话'); return }
        if (exportConversations(list)) cancelSelectMode()
    }

    async function handleImport(file) {
        if (!file) return
        try {
            const text = await file.text()
            const data = JSON.parse(text)
            let convList
            if (Array.isArray(data)) convList = data.map(migrateLegacy)
            else if (data?.conversations) convList = data.conversations.map(migrateNodeFormat)
            else throw new Error('文件格式不正确')

            const existingIds = new Set(conversations.value.map(c => c.id))
            let added = 0, skipped = 0
            for (const c of convList) {
                if (!c || typeof c.id !== 'string') { skipped++; continue }
                if (isEmptyConversation(c)) { skipped++; continue }
                if (existingIds.has(c.id)) { skipped++; continue }
                conversations.value.push(c); existingIds.add(c.id); added++
            }
            conversations.value.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
            if (!conversations.value.find(c => c.id === activeConversationId.value)) {
                const first = conversations.value[0]
                if (first) { onConversationSwitch?.(); activeConversationId.value = first.id }
            }
            persist()
            showNotice?.(added === 0
                ? `导入完成：没有新对话（${skipped} 个为空、已存在或无效）`
                : `导入完成：新增 ${added} 个${skipped ? `，跳过 ${skipped} 个` : ''}`)
        } catch (e) {
            console.error('[import] 失败', e)
            showNotice?.('导入失败：' + (e?.message || '未知错误'))
        }
    }

    return {
        conversations, activeConversationId, activeConversation,
        messages, selectMode, selectedIds,
        createConversation, switchConversation, closeConversation,
        addNode, editUserMessage, revertToNode, switchToNode, getSiblings,
        enterSelectMode, cancelSelectMode, toggleSelect, toggleSelectAll,
        exportAllConversations, exportSelected, handleImport,
        persist, loadConversations,
    }
}