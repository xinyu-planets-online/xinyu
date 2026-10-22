import Dexie from 'dexie'
import db from './index'

// ============ 会话 ============
export async function listConversations() {
    return db.conversations.orderBy('updatedAt').reverse().toArray()
}

export async function putConversation(conv) {
    return db.conversations.put({
        id: conv.id,
        title: conv.title || '未命名对话',
        updatedAt: conv.updatedAt || Date.now(),
        currentLeafId: conv.currentLeafId ?? null,
    })
}

export async function deleteConversation(id) {
    await db.transaction('rw', db.conversations, db.messages, db.attachments, async () => {
        await db.messages.where('conversationId').equals(id).delete()
        await db.attachments.where('conversationId').equals(id).delete()
        await db.conversations.delete(id)
    })
}

// ============ 消息 ============
export async function listMessages(conversationId) {
    return db.messages
        .where('[conversationId+createdAt]')
        .between([conversationId, Dexie.minKey], [conversationId, Dexie.maxKey])
        .toArray()
}

export async function putMessage(msg) {
    return db.messages.put({
        id: msg.id,
        conversationId: msg.conversationId,
        parentId: msg.parentId ?? null,
        role: msg.role,
        content: msg.content || '',
        status: msg.status || 'done',
        createdAt: msg.createdAt || Date.now(),
    })
}

// ============ 附件摘要 ============
export async function putAttachment(att) {
    return db.attachments.put({
        id: att.id,
        conversationId: att.conversationId,
        messageId: att.messageId ?? null,
        name: att.name || '',
        size: att.size || 0,
        type: att.type || '',
        summary: att.summary || '',
        createdAt: att.createdAt || Date.now(),
    })
}

export async function listAttachments(conversationId) {
    return db.attachments.where('conversationId').equals(conversationId).toArray()
}

// ============ 导入导出 ============
export async function exportAll() {
    const [conversations, messages, attachments] = await Promise.all([
        db.conversations.toArray(),
        db.messages.toArray(),
        db.attachments.toArray(),
    ])
    return { conversations, messages, attachments }
}

export async function importAll({ conversations = [], messages = [], attachments = [] }) {
    await db.transaction('rw', db.conversations, db.messages, db.attachments, async () => {
        if (conversations.length) await db.conversations.bulkPut(conversations)
        if (messages.length) await db.messages.bulkPut(messages)
        if (attachments.length) await db.attachments.bulkPut(attachments)
    })
}