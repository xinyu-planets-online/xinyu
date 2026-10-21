import { useStreaming, uid } from 'zen-ai-chat-ui'

export function useChatStream(messages) {
    const streaming = useStreaming()

    async function send({ text, provider, model, client, onAfter }) {
        if (!text?.trim()) return

        messages.value.push({
            id: uid('u'),
            role: 'user',
            content: text,
            status: 'done',
        })

        const assistant = streaming.createAssistant()
        messages.value.push(assistant)

        const history = messages.value
            .filter(m => m.role !== 'assistant' || m.content !== '')
            .map(m => ({ role: m.role, content: m.content }))

        try {
            if (!client) throw new Error('llm-hub-config 尚未就绪')
            const stream = client.chatStream({ provider, model, messages: history })
            for await (const chunk of stream) {
                streaming.append(assistant, { type: 'content', delta: chunk.delta })
            }
            streaming.append(assistant, { type: 'done', delta: '' })
        } catch (err) {
            console.error('[chatStream] 失败:', err)
            streaming.append(assistant, { type: 'error', delta: err?.message || '请求失败' })
        } finally {
            onAfter?.()
        }
    }

    return { streaming, send }
}