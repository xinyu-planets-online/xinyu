import { ref, computed, watch, onUnmounted } from 'vue'
import { useSpeechRecognition } from '@vueuse/core'

export function useVoiceInput({ lang = 'zh-CN', onFinalText } = {}) {
    const accumulatedFinal = ref('')
    const baseText = ref('')

    const {
        isSupported,
        isListening,
        isFinal,
        result,
        error,
        start,
        stop,
    } = useSpeechRecognition({
        lang,
        continuous: true,
        interimResults: true,
    })

    watch(isFinal, (final) => {
        if (!final) return
        const text = (result.value || '').trim()
        if (!text) return
        accumulatedFinal.value += text
    })

    const interimText = computed(() => {
        if (isFinal.value) return ''
        return (result.value || '').trim()
    })

    const previewText = computed(() => {
        const parts = [baseText.value, accumulatedFinal.value, interimText.value]
            .map(s => (s || '').trim())
            .filter(Boolean)
        return parts.join('')
    })

    function begin(existingText = '') {
        if (!isSupported.value) return
        baseText.value = existingText
        accumulatedFinal.value = ''
        start()
    }

    function finish() {
        stop()
        const text = previewText.value
        if (text) onFinalText?.(text)
        return text
    }

    function cancel() {
        stop()
        accumulatedFinal.value = ''
        baseText.value = ''
    }

    const errorMessage = computed(() => {
        if (!error.value) return ''
        const map = {
            'no-speech': '未检测到语音输入',
            aborted: '录音已取消',
            'audio-capture': '麦克风访问失败',
            network: '网络连接问题',
            'not-allowed': '麦克风权限被拒绝，请手动授权',
        }
        return map[error.value.error] || '语音识别出错'
    })

    onUnmounted(() => {
        if (isListening.value) stop()
    })

    return {
        isSupported,
        isListening,
        isFinal,
        previewText,
        interimText,
        errorMessage,
        begin,
        finish,
        cancel,
    }
}