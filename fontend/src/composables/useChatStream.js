import { useStreaming } from 'zen-ai-chat-ui'

export function useChatStream({ addNode, persist }) {
    const streaming = useStreaming()

    // 从 user 节点回溯得到历史（包含该 user 节点自身）
    function buildHistory(conv, userNodeId) {
        const history = []
        let cur = userNodeId
        const guard = new Set()
        while (cur && conv.nodes[cur] && !guard.has(cur)) {
            guard.add(cur)
            const n = conv.nodes[cur]
            history.unshift({ role: n.role, content: n.content })
            cur = n.parentId
        }
        return history.filter(m => m.role !== 'assistant' || m.content)
    }

    // 从指定 user 节点开始生成 assistant
    async function generateAssistant({ userNodeId, provider, model, client, conversation }) {
        if (!client) throw new Error('llm-hub-config 尚未就绪')
        if (!conversation?.nodes[userNodeId]) return

        const history = buildHistory(conversation, userNodeId)

        const assistant = streaming.createAssistant()
        assistant.parentId = userNodeId
        assistant.createdAt = Date.now()
        conversation.nodes[assistant.id] = assistant
        conversation.currentLeafId = assistant.id
        conversation.updatedAt = Date.now()

        try {
            const stream = client.chatStream({ provider, model, messages: history })
            for await (const chunk of stream) {
                streaming.append(assistant, { type: 'content', delta: chunk.delta })
            }
            streaming.append(assistant, { type: 'done', delta: '' })
        } catch (err) {
            console.error('[chatStream] 失败:', err)
            streaming.append(assistant, { type: 'error', delta: err?.message || '请求失败' })
        } finally {
            persist?.()
        }
    }

    // 用户发新消息
    async function send({ text, provider, model, client, conversation }) {
        if (!text?.trim()) return
        const userNode = addNode({ role: 'user', content: text })
        if (!userNode) return
        await generateAssistant({
            userNodeId: userNode.id,
            provider, model, client, conversation,
        })
    }

    // 重新生成某条 assistant 回答（基于其 parentId 对应的 user 节点）
    async function regenerate({ assistantNodeId, provider, model, client, conversation }) {
        const node = conversation?.nodes[assistantNodeId]
        if (!node || node.role !== 'assistant') return
        await generateAssistant({
            userNodeId: node.parentId,
            provider, model, client, conversation,
        })
    }

    return { streaming, send, generateAssistant, regenerate }
}