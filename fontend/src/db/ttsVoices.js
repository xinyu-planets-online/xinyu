import Dexie from 'dexie'

const ttsDb = new Dexie('TtsAppDB')

ttsDb.version(1).stores({
    voices: 'id, name, createdAt',
})

export async function listVoices() {
    return ttsDb.voices.orderBy('createdAt').reverse().toArray()
}

export async function addVoice({ name, audioBlob, mime }) {
    const id = 'v-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
    await ttsDb.voices.add({
        id,
        name,
        audioBlob,
        mime: mime || '',
        createdAt: Date.now(),
    })
    return id
}

export async function deleteVoice(id) {
    await ttsDb.voices.delete(id)
}

export async function getVoice(id) {
    return ttsDb.voices.get(id)
}