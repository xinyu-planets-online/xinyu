import { useStreaming } from 'zen-ai-chat-ui'
import { putMessage, putConversation, putAttachment } from '@/db/chatRepository'

export function useChatStream({ addNode }) {
    const streaming = useStreaming()

    function buildHistory(conv, userNodeId) {
        const history = []
        let cur = userNodeId
        const guard = new Set()
        while (cur && conv.nodes[cur] && !guard.has(cur)) {
            guard.add(cur)
            const n = conv.nodes[cur]
            let content = n.content || ''
            const atts = n.attachments || []
            if (atts.length) {
                const lines = atts.map(a => `[附件: ${a.name}] ${a.summary}`).join('\n')
                content = content ? `${content}\n\n${lines}` : lines
            }
            if (content) history.unshift({ role: n.role, content })
            cur = n.parentId
        }
        return history
    }

    async function generateAssistant({
        userNodeId,
        provider,
        model,
        client,
        conversation,
    }) {
        if (!client) throw new Error('llm-hub-config 尚未就绪')
        if (!conversation?.nodes[userNodeId]) return

        const history = buildHistory(conversation, userNodeId)

        const assistant = streaming.createAssistant()
        assistant.parentId = userNodeId
        assistant.createdAt = Date.now()
        assistant.attachments = []
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
            streaming.append(assistant, {
                type: 'error',
                delta: err?.message || '请求失败',
            })
        } finally {
            await putMessage({ ...assistant, conversationId: conversation.id })
            await putConversation(conversation)
        }
    }

    async function send({ text, files = [], provider, model, client, conversation }) {
        if (!text?.trim() && !files.length) return
        const userNode = await addNode({ role: 'user', content: text || '' })
        if (!userNode) return

        if (files.length) {
            userNode.attachments = files
            for (const f of files) {
                await putAttachment({ ...f, messageId: userNode.id })
            }
            await putConversation(conversation)
        }

        await generateAssistant({
            userNodeId: userNode.id,
            provider,
            model,
            client,
            conversation,
        })
    }

    async function regenerate({ assistantNodeId, provider, model, client, conversation }) {
        const node = conversation?.nodes[assistantNodeId]
        if (!node || node.role !== 'assistant') return
        await generateAssistant({
            userNodeId: node.parentId,
            provider,
            model,
            client,
            conversation,
        })
    }

    return { streaming, send, generateAssistant, regenerate }
}