import { ref, computed } from 'vue'
import { uid } from 'zen-ai-chat-ui'
import {
    listConversations,
    putConversation,
    deleteConversation,
    listMessages,
    putMessage,
    listAttachments,
    exportAll,
    importAll,
} from '@/db/chatRepository'

const ACTIVE_KEY = 'chat-active-id'

export function useConversations({ showNotice, onConversationSwitch } = {}) {
    const conversations = ref([])
    const activeConversationId = ref('')
    const selectMode = ref(false)
    const selectedIds = ref([])

    const activeConversation = computed(() =>
        conversations.value.find(c => c.id === activeConversationId.value)
    )

    const messages = computed(() => {
        const conv = activeConversation.value
        if (!conv || !conv.loaded || !conv.currentLeafId) return []
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

    async function ensureLoaded(conv) {
        if (!conv || conv.loaded) return
        const [rows, atts] = await Promise.all([
            listMessages(conv.id),
            listAttachments(conv.id),
        ])
        const nodes = {}
        for (const r of rows) {
            nodes[r.id] = {
                id: r.id,
                parentId: r.parentId,
                role: r.role,
                content: r.content,
                status: r.status,
                createdAt: r.createdAt,
                attachments: [],
            }
        }
        for (const a of atts) {
            if (a.messageId && nodes[a.messageId]) {
                nodes[a.messageId].attachments.push(a)
            }
        }
        conv.nodes = nodes
        conv.attachments = atts
        conv.loaded = true
    }

    function rememberActive(id) {
        try {
            if (id) localStorage.setItem(ACTIVE_KEY, id)
            else localStorage.removeItem(ACTIVE_KEY)
        } catch { }
    }

    async function loadConversations() {
        const list = await listConversations()
        if (!list.length) return false
        conversations.value = list.map(c => ({
            id: c.id,
            title: c.title,
            updatedAt: c.updatedAt,
            currentLeafId: c.currentLeafId,
            nodes: {},
            attachments: [],
            loaded: false,
        }))
        let savedActive = ''
        try {
            savedActive = localStorage.getItem(ACTIVE_KEY) || ''
        } catch { }
        const target =
            conversations.value.find(c => c.id === savedActive) || conversations.value[0]
        activeConversationId.value = target.id
        rememberActive(target.id)
        await ensureLoaded(target)
        return true
    }

    function makeTitleFromText(text) {
        const t = text.trim().replace(/\s+/g, ' ')
        return t.length > 22 ? t.slice(0, 22) + '…' : t
    }

    async function createConversation() {
        if (selectMode.value) cancelSelectMode()
        const id = uid('conv')
        const conv = {
            id,
            title: '新对话',
            updatedAt: Date.now(),
            currentLeafId: null,
            nodes: {},
            attachments: [],
            loaded: true,
        }
        conversations.value.unshift(conv)
        activeConversationId.value = id
        rememberActive(id)
        onConversationSwitch?.()
        await putConversation(conv)
        return conv
    }

    async function switchConversation(id) {
        if (id === activeConversationId.value) return
        const conv = conversations.value.find(c => c.id === id)
        if (!conv) return
        onConversationSwitch?.()
        activeConversationId.value = id
        rememberActive(id)
        await ensureLoaded(conv)
    }

    async function closeConversation(id) {
        const idx = conversations.value.findIndex(c => c.id === id)
        if (idx < 0) return
        conversations.value.splice(idx, 1)
        if (activeConversationId.value === id) {
            const next = conversations.value[0]
            onConversationSwitch?.()
            activeConversationId.value = next?.id || ''
            rememberActive(activeConversationId.value)
            if (next) await ensureLoaded(next)
        }
        await deleteConversation(id)
    }

    async function addNode({ role, content = '', parentId, id, status = 'done', ...extra }) {
        const conv = activeConversation.value
        if (!conv) return null
        const node = {
            id: id || uid(role === 'user' ? 'u' : 'a'),
            parentId: parentId !== undefined ? parentId : conv.currentLeafId,
            role,
            content,
            status,
            createdAt: Date.now(),
            attachments: [],
            ...extra,
        }
        conv.nodes[node.id] = node
        conv.currentLeafId = node.id
        if (conv.title === '新对话' && role === 'user' && content) {
            conv.title = makeTitleFromText(content)
        }
        conv.updatedAt = Date.now()
        await putMessage({ ...node, conversationId: conv.id })
        await putConversation(conv)
        return node
    }

    async function editUserMessage(nodeId, newContent) {
        const conv = activeConversation.value
        const old = conv?.nodes[nodeId]
        if (!old || old.role !== 'user') return null
        return addNode({
            role: 'user',
            content: newContent,
            parentId: old.parentId,
        })
    }

    async function revertToNode(nodeId) {
        const conv = activeConversation.value
        const node = conv?.nodes[nodeId]
        if (!node) return
        conv.currentLeafId = node.parentId ?? null
        conv.updatedAt = Date.now()
        await putConversation(conv)
    }

    async function switchToNode(nodeId) {
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
        await putConversation(conv)
    }

    function getSiblings(nodeId) {
        const conv = activeConversation.value
        const node = conv?.nodes[nodeId]
        if (!node) return []
        return Object.values(conv.nodes)
            .filter(n => n.parentId === node.parentId)
            .sort((a, b) => a.createdAt - b.createdAt)
    }

    // ============ 选择模式 ============
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
        const i = selectedIds.value.indexOf(id)
        if (i >= 0) selectedIds.value.splice(i, 1)
        else selectedIds.value.push(id)
    }
    function toggleSelectAll() {
        selectedIds.value =
            selectedIds.value.length === conversations.value.length
                ? []
                : conversations.value.map(c => c.id)
    }

    // ============ 导入导出 ============
    async function exportConversations(list) {
        try {
            const all = await exportAll()
            const ids = new Set((list || conversations.value).map(c => c.id))
            const convs = all.conversations.filter(c => ids.has(c.id))
            const msgs = all.messages.filter(m => ids.has(m.conversationId))
            const atts = all.attachments.filter(a => ids.has(a.conversationId))

            const msgsByConv = new Map()
            for (const m of msgs) {
                if (!msgsByConv.has(m.conversationId)) msgsByConv.set(m.conversationId, [])
                msgsByConv.get(m.conversationId).push(m)
            }

            const nonEmpty = convs.filter(c => {
                const arr = msgsByConv.get(c.id) || []
                if (!arr.length) return false
                return arr.some(m => m.content && String(m.content).trim())
            })
            const nonEmptyIds = new Set(nonEmpty.map(c => c.id))
            const ignored = convs.length - nonEmpty.length

            if (!nonEmpty.length) {
                showNotice?.('没有可导出的对话（空对话已自动忽略）')
                return false
            }

            const payload = {
                version: 3,
                exportedAt: new Date().toISOString(),
                activeConversationId: nonEmptyIds.has(activeConversationId.value)
                    ? activeConversationId.value
                    : '',
                conversations: nonEmpty,
                messages: msgs.filter(m => nonEmptyIds.has(m.conversationId)),
                attachments: atts.filter(a => nonEmptyIds.has(a.conversationId)),
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
            showNotice?.(
                `已导出 ${nonEmpty.length} 个对话${ignored ? `，忽略 ${ignored} 个空对话` : ''}`
            )
            return true
        } catch (e) {
            console.error('[export] 失败', e)
            showNotice?.('导出失败：' + (e?.message || '未知错误'))
            return false
        }
    }

    function exportAllConversations() {
        return exportConversations()
    }

    async function exportSelected() {
        const list = conversations.value.filter(c => selectedIds.value.includes(c.id))
        if (!list.length) {
            showNotice?.('请先勾选要导出的对话')
            return
        }
        const ok = await exportConversations(list)
        if (ok) cancelSelectMode()
    }

    async function handleImport(file) {
        if (!file) return
        try {
            const data = JSON.parse(await file.text())
            if (!data || !Array.isArray(data.conversations)) {
                throw new Error('文件格式不正确')
            }
            const existing = new Set((await listConversations()).map(c => c.id))
            const convs = data.conversations.filter(c => c?.id && !existing.has(c.id))
            const convIds = new Set(convs.map(c => c.id))
            const msgs = (data.messages || []).filter(
                m => m?.id && convIds.has(m.conversationId)
            )
            const atts = (data.attachments || []).filter(
                a => a?.id && convIds.has(a.conversationId)
            )
            if (!convs.length) {
                showNotice?.('导入完成：没有新对话')
                return
            }
            await importAll({ conversations: convs, messages: msgs, attachments: atts })
            await loadConversations()
            showNotice?.(`导入完成：新增 ${convs.length} 个对话`)
        } catch (e) {
            console.error('[import] 失败', e)
            showNotice?.('导入失败：' + (e?.message || '未知错误'))
        }
    }

    return {
        conversations,
        activeConversationId,
        activeConversation,
        messages,
        selectMode,
        selectedIds,
        createConversation,
        switchConversation,
        closeConversation,
        addNode,
        editUserMessage,
        revertToNode,
        switchToNode,
        getSiblings,
        enterSelectMode,
        cancelSelectMode,
        toggleSelect,
        toggleSelectAll,
        exportAllConversations,
        exportSelected,
        handleImport,
        loadConversations,
    }
}