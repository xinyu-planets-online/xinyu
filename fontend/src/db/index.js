import Dexie from 'dexie'

const db = new Dexie('ChatAppDB')

db.version(1).stores({
    conversations: 'id, title, updatedAt, currentLeafId',
    messages: 'id, conversationId, parentId, role, createdAt, [conversationId+createdAt]',
    attachments: 'id, conversationId, messageId, name, size, createdAt',
})

export default db