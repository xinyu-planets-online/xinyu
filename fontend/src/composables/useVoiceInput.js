import { ref, onUnmounted } from 'vue'

const SpeechRecognitionCtor =
    typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null

const ERROR_MAP = {
    'audio-capture': '麦克风访问失败',
    'network': '网络连接问题',
    'not-allowed': '麦克风权限被拒绝，请手动授权',
    'service-not-allowed': '语音服务被禁止',
}

const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture'])

/**
 * 轻量封装 Web Speech API。
 * 每次 begin 都创建全新实例并清空内部缓冲，避免下次输入残留上一次的识别结果。
 * 暴露 previewText / interimText / isListening / errorMessage 供 UI 使用。
 */
export function useVoiceInput({ lang = 'zh-CN', onFinalText } = {}) {
    const isSupported = ref(!!SpeechRecognitionCtor)
    const isListening = ref(false)
    const previewText = ref('')
    const interimText = ref('')
    const errorMessage = ref('')

    let recognition = null
    let wanted = false          // 用户是否希望继续录音（用于自动重启）
    let confirmed = ''          // 本次已确认的文本
    let interim = ''            // 当前识别中的临时文本
    let base = ''               // 本次开始前的输入框内容

    function publish() {
        const parts = [base, confirmed, interim]
            .map(s => (s || '').trim())
            .filter(Boolean)
        previewText.value = parts.join('')
        interimText.value = interim
    }

    function resetBuffers() {
        confirmed = ''
        interim = ''
        base = ''
        previewText.value = ''
        interimText.value = ''
    }

    function createRecognition() {
        const r = new SpeechRecognitionCtor()
        r.lang = lang
        r.continuous = true
        r.interimResults = true

        r.onstart = () => {
            if (recognition === r) isListening.value = true
        }

        r.onresult = (event) => {
            if (recognition !== r) return
            let finalChunk = ''
            let interimChunk = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const res = event.results[i]
                if (!res) continue
                const text = res[0]?.transcript || ''
                if (res.isFinal) finalChunk += text
                else interimChunk += text
            }
            if (finalChunk) confirmed += finalChunk
            interim = interimChunk
            publish()
        }

        r.onerror = (e) => {
            if (recognition !== r) return
            const code = e?.error
            if (code === 'aborted' || code === 'no-speech') return
            errorMessage.value = ERROR_MAP[code] || '语音识别出错'
            if (FATAL_ERRORS.has(code)) wanted = false
        }

        r.onend = () => {
            if (recognition !== r) return
            isListening.value = false
            if (wanted) {
                // 浏览器在静音超时后会自动 end，自动重启以保持连续
                setTimeout(() => {
                    if (recognition === r && wanted) {
                        try { r.start() } catch { }
                    }
                }, 120)
            }
        }

        return r
    }

    function begin(existingText = '') {
        if (!isSupported.value) return
        // 彻底清掉旧实例，避免它的 onresult/onend 污染新会话
        if (recognition) {
            const old = recognition
            recognition = null
            try { old.abort() } catch { }
        }
        resetBuffers()
        base = existingText || ''
        errorMessage.value = ''
        publish()

        const r = createRecognition()
        recognition = r
        wanted = true
        try {
            r.start()
        } catch (e) {
            errorMessage.value = e?.message || '语音启动失败'
            wanted = false
        }
    }

    function stop() {
        wanted = false
        if (recognition) {
            try { recognition.stop() } catch { }
        }
    }

    function finish() {
        // 先取快照，再清理；abort 不等待最后一次 final，但快照已包含 interim
        const text = previewText.value
        wanted = false
        const r = recognition
        recognition = null
        if (r) {
            try { r.abort() } catch { }
        }
        isListening.value = false
        resetBuffers()
        if (text) onFinalText?.(text)
        return text
    }

    function cancel() {
        wanted = false
        const r = recognition
        recognition = null
        if (r) {
            try { r.abort() } catch { }
        }
        isListening.value = false
        resetBuffers()
    }

    onUnmounted(() => {
        cancel()
    })

    return {
        isSupported,
        isListening,
        previewText,
        interimText,
        errorMessage,
        begin,
        finish,
        stop,
        cancel,
    }
}