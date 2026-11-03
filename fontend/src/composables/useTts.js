import { ref } from 'vue'
import { getVoice } from '@/db/ttsVoices'

const TTS_BLOCK_RE = /<TTS>[\s\S]*?<\/TTS>/gi
const TTS_OPEN_UNCLOSED_RE = /<TTS>[\s\S]*$/i
const TTS_META_RE = /<TTS>\s*(\{[\s\S]*?\})\s*<\/TTS>/i

const DEFAULT_META = { emotion: 'happy', weight: 0.7, lang: 'ZH' }
const EMOTION_KEYS = ['happy', 'angry', 'sad', 'fear', 'disgust', 'low', 'surprised', 'calm']

export function stripTtsMarkers(text) {
    if (!text) return ''
    return text
        .replace(TTS_BLOCK_RE, '')
        .replace(TTS_OPEN_UNCLOSED_RE, '')
        .trim()
}

export function extractTtsMeta(text) {
    const m = TTS_META_RE.exec(text || '')
    if (!m) return { ...DEFAULT_META }
    try {
        const p = JSON.parse(m[1])
        const emotion = EMOTION_KEYS.includes(p.emotion) ? p.emotion : DEFAULT_META.emotion
        const rawWeight = typeof p.weight === 'number' ? p.weight : DEFAULT_META.weight
        const weight = Math.max(0, Math.min(1, rawWeight))
        const lang = typeof p.lang === 'string' && p.lang ? p.lang : DEFAULT_META.lang
        return { emotion, weight, lang }
    } catch {
        return { ...DEFAULT_META }
    }
}

export function buildTtsSystemPrompt(basePrompt) {
    const directive = `每次回复开头必须加一次标签：<TTS>{"emotion":"calm","weight":0.6,"lang":"ZH"}</TTS>
emotion∈{happy,angry,sad,fear,disgust,low,surprised,calm}；weight∈[0,1]；lang∈{ZH,EN,JA,AR,ES}。
标签后直接写正文，正文不要提标签、语音、情绪。句子短，口语化，不用 Markdown、代码块、表格。
标签内容用户不可见。`

    const base = (basePrompt || '').trim()
    return base ? `${base}\n\n${directive}` : directive
}

function buildVector(emotion, weight) {
    const v = {}
    for (const k of EMOTION_KEYS) v[k] = 0
    if (emotion in v) v[emotion] = weight
    return v
}

const GENERATE_API = '/tts/generate'
const PRESET_API = '/tts/preset'

const presetCache = new Map()

async function loadPresetParams(name) {
    if (!name || typeof name !== 'string') {
        throw new Error('预设名称为空，请在设置里重新选择音色')
    }
    if (presetCache.has(name)) return presetCache.get(name)
    const r = await fetch(`${PRESET_API}/load`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    })
    if (!r.ok) throw new Error(`加载预设失败 HTTP ${r.status}`)
    const data = await r.json()
    presetCache.set(name, data)
    return data
}

export function clearPresetCache() {
    presetCache.clear()
}

async function buildPromptAudio(voice) {
    if (!voice || !voice.type) {
        throw new Error('未选择音色，请在设置里选择一个预设或自定义音色')
    }
    if (voice.type === 'preset') {
        if (!voice.name || typeof voice.name !== 'string') {
            throw new Error('预设音色名称丢失，请在设置里重新选择')
        }
        const cached = await loadPresetParams(voice.name)
        if (!cached.prompt_audio) throw new Error('预设没有可用的参考音频')
        return { kind: 'field', value: cached.prompt_audio }
    }
    if (voice.type === 'custom') {
        if (!voice.id) throw new Error('自定义音色 ID 丢失，请在设置里重新选择')
        const rec = await getVoice(voice.id)
        if (!rec?.audioBlob) throw new Error('自定义音色丢失，请重新添加')
        return { kind: 'file', value: rec.audioBlob, filename: (voice.name || 'voice') + '.wav' }
    }
    throw new Error('未知音色类型')
}

export function useTts(settings) {
    const playing = ref(false)
    const loading = ref(false)
    const error = ref('')

    let audioEl = null
    let blobUrl = null

    function cleanup() {
        if (audioEl) {
            try { audioEl.pause() } catch { }
            audioEl.onended = null
            audioEl.onerror = null
            audioEl = null
        }
        if (blobUrl) {
            URL.revokeObjectURL(blobUrl)
            blobUrl = null
        }
        playing.value = false
    }

    async function synthesize(text, meta, voice) {
        if (!text) throw new Error('空文本')
        if (!voice || !voice.type) throw new Error('尚未选择音色')

        const m = meta || DEFAULT_META
        const vec = buildVector(m.emotion, m.weight)
        const promptAudio = await buildPromptAudio(voice)

        const fd = new FormData()
        fd.append('text', text)
        if (promptAudio.kind === 'file') {
            fd.append('prompt_audio', promptAudio.value, promptAudio.filename)
        } else {
            fd.append('prompt_audio', promptAudio.value)
        }
        fd.append('lang', m.lang)
        fd.append('emo_control', '使用情感向量控制')
        fd.append('emo_weight', String(m.weight))
        fd.append('emo_vector', JSON.stringify(vec))

        const resp = await fetch(GENERATE_API, { method: 'POST', body: fd })
        if (!resp.ok) {
            const txt = await resp.text().catch(() => '')
            throw new Error(`TTS ${resp.status}: ${txt.slice(0, 200)}`)
        }
        const blob = await resp.blob()
        return { url: URL.createObjectURL(blob), blob }
    }

    function playUrl(url) {
        return new Promise((resolve) => {
            const localEl = new Audio(url)
            localEl.onended = () => {
                try { URL.revokeObjectURL(url) } catch { }
                if (audioEl === localEl) {
                    audioEl = null
                    playing.value = false
                }
                resolve()
            }
            localEl.onerror = () => {
                try { URL.revokeObjectURL(url) } catch { }
                if (audioEl === localEl) {
                    audioEl = null
                    playing.value = false
                    error.value = 'TTS 播放失败'
                }
                resolve()
            }
            audioEl = localEl
            playing.value = true
            localEl.play().catch(() => {
                try { URL.revokeObjectURL(url) } catch { }
                if (audioEl === localEl) {
                    audioEl = null
                    playing.value = false
                }
                resolve()
            })
        })
    }

    async function speak(text, meta, voice) {
        if (!settings.value.enabled) return
        cleanup()
        error.value = ''
        loading.value = true
        try {
            const { url } = await synthesize(text, meta, voice)
            loading.value = false
            await playUrl(url)
        } catch (e) {
            error.value = e?.message || String(e)
            console.warn('[tts] 失败', e)
        } finally {
            loading.value = false
        }
    }

    function stop() {
        cleanup()
    }

    return { playing, loading, error, synthesize, playUrl, speak, stop }
}