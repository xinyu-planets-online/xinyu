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
    const directive = `# TTS 语音输出控制

你的回复会被转换为语音播放。严格遵守以下格式规则：

1. 每次回复必须以 <TTS>{"emotion":"...","weight":0.0,"lang":"..."}</TTS> 开头，且仅出现一次
2. emotion 取值必须是以下之一：happy / angry / sad / fear / disgust / low / surprised / calm
3. weight 为 0-1 之间的数字，表示情绪强度
4. lang 取值：ZH / EN / JA / AR / ES，必须匹配正文语言
5. <TTS> 标签内容不会展示给用户，只用于语音合成
6. 标签后紧接正文，正文里不要提及 TTS、语音、情绪参数等字样
7. 语速放缓，句子简短，适合朗读
8. 使用自然口语，避免 Markdown 符号、代码块、表格等不适合朗读的内容

示例：
<TTS>{"emotion":"calm","weight":0.6,"lang":"ZH"}</TTS>
好的，我们慢慢来。先做三次深呼吸。吸气，慢慢数到四。`

    const base = (basePrompt || '').trim()
    return base ? `${base}\n\n${directive}` : directive
}

function buildVector(emotion, weight) {
    const v = {}
    for (const k of EMOTION_KEYS) v[k] = 0
    if (emotion in v) v[emotion] = weight
    return v
}

const PRESET_API = '/tts/preset'
const GENERATE_API = '/tts/generate'

const presetCache = new Map()

async function loadPresetParams(name) {
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

    async function buildPromptAudio(voice) {
        if (voice.type === 'preset') {
            const cached = await loadPresetParams(voice.name)
            if (!cached.prompt_audio) throw new Error('预设没有可用的参考音频')
            return { kind: 'field', value: cached.prompt_audio }
        }
        if (voice.type === 'custom') {
            const rec = await getVoice(voice.id)
            if (!rec?.audioBlob) throw new Error('自定义音色丢失，请重新添加')
            return { kind: 'file', value: rec.audioBlob, filename: (voice.name || 'voice') + '.wav' }
        }
        throw new Error('未知音色类型')
    }

    async function speak(text, meta, voice) {
        if (!text) return
        const s = settings.value
        if (!s.enabled) return
        if (!voice || !voice.type) {
            error.value = '尚未选择音色'
            return
        }

        cleanup()
        error.value = ''
        loading.value = true

        try {
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
            blobUrl = URL.createObjectURL(blob)
            audioEl = new Audio(blobUrl)
            audioEl.onended = () => { cleanup() }
            audioEl.onerror = () => {
                error.value = 'TTS 播放失败'
                cleanup()
            }

            playing.value = true
            await audioEl.play()
        } catch (e) {
            error.value = e?.message || String(e)
            console.warn('[tts] 失败', e)
            playing.value = false
        } finally {
            loading.value = false
        }
    }

    function stop() {
        cleanup()
    }

    return { playing, loading, error, speak, stop }
}