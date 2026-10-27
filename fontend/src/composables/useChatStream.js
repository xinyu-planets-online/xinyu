import { useStreaming } from 'zen-ai-chat-ui'
import { putMessage, putConversation, putAttachment } from '@/db/chatRepository'

function isImageUnsupportedError(err) {
    const msg = String(err?.message || err || '').toLowerCase()
    if (!msg) return false
    if (msg.includes('mmproj')) return true
    if (msg.includes('image') && (msg.includes('not support') || msg.includes('unsupport'))) return true
    if (msg.includes('vision') && (msg.includes('not support') || msg.includes('unsupport'))) return true
    return false
}

export function useChatStream({ addNode }) {
    const streaming = useStreaming()

    function buildHistory(conv, userNodeId) {
        const history = []
        let cur = userNodeId
        const guard = new Set()
        while (cur && conv.nodes[cur] && !guard.has(cur)) {
            guard.add(cur)
            const n = conv.nodes[cur]

            const textParts = []
            if (n.content) textParts.push(n.content)
            for (const a of n.attachments || []) {
                if (a.summary) textParts.push(`[附件: ${a.name}]\n${a.summary}`)
            }

            const images = n.images || []
            if (images.length) {
                const content = []
                if (textParts.length) {
                    content.push({ type: 'text', text: textParts.join('\n\n') })
                }
                for (const img of images) {
                    if (img?.dataUrl) {
                        content.push({ type: 'image_url', image_url: { url: img.dataUrl } })
                    }
                }
                history.unshift({ role: n.role, content })
            } else if (textParts.length) {
                history.unshift({ role: n.role, content: textParts.join('\n\n') })
            }

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
        userSystemPrompt,
    }) {
        if (!client) {
            return { ok: false, error: new Error('llm-hub-config 尚未就绪') }
        }
        if (!conversation?.nodes[userNodeId]) {
            return { ok: false, error: new Error('节点不存在') }
        }

        const history = buildHistory(conversation, userNodeId)

        const messages = []
        const sys = (userSystemPrompt || '').trim()
        if (sys) messages.push({ role: 'system', content: sys })
        messages.push(...history)

        const assistant = streaming.createAssistant()
        assistant.parentId = userNodeId
        assistant.createdAt = Date.now()
        assistant.attachments = []
        conversation.nodes[assistant.id] = assistant
        conversation.currentLeafId = assistant.id
        conversation.updatedAt = Date.now()

        try {
            const stream = client.chatStream({ provider, model, messages })
            for await (const chunk of stream) {
                streaming.append(assistant, { type: 'content', delta: chunk.delta })
            }
            streaming.append(assistant, { type: 'done', delta: '' })
            return { ok: true, assistantId: assistant.id }
        } catch (err) {
            const isImageError = isImageUnsupportedError(err)
            streaming.append(assistant, {
                type: 'error',
                delta: isImageError
                    ? '当前模型不支持图片输入。开启 OCR 后会改用图片中的文字重发。'
                    : (err?.message || '请求失败'),
            })
            assistant.isImageUnsupported = isImageError
            return { ok: false, isImageError, error: err, assistantId: assistant.id }
        } finally {
            await putMessage({ ...assistant, conversationId: conversation.id })
            await putConversation(conversation)
        }
    }

    async function send({
        text,
        files = [],
        images = [],
        provider,
        model,
        client,
        conversation,
        userSystemPrompt,
    }) {
        if (!text?.trim() && !files.length && !images.length) {
            return { ok: false, error: new Error('空消息') }
        }

        const userNode = await addNode({ role: 'user', content: text || '' })
        if (!userNode) return { ok: false, error: new Error('节点创建失败') }

        if (files.length) {
            userNode.attachments = files
            for (const f of files) {
                await putAttachment({ ...f, messageId: userNode.id })
            }
        }

        if (images.length) {
            userNode.images = images
        }

        await putConversation(conversation)

        const result = await generateAssistant({
            userNodeId: userNode.id,
            provider,
            model,
            client,
            conversation,
            userSystemPrompt,
        })

        return { ...result, userNodeId: userNode.id }
    }

    async function regenerate({
        assistantNodeId,
        provider,
        model,
        client,
        conversation,
        userSystemPrompt,
    }) {
        const node = conversation?.nodes[assistantNodeId]
        if (!node || node.role !== 'assistant') {
            return { ok: false, error: new Error('节点无效') }
        }
        return generateAssistant({
            userNodeId: node.parentId,
            provider,
            model,
            client,
            conversation,
            userSystemPrompt,
        })
    }

    return { streaming, send, generateAssistant, regenerate }
}