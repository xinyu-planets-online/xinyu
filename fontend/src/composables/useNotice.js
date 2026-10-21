import { ref } from 'vue'

export function useNotice() {
    const notice = ref('')
    let timer = null

    function showNotice(text) {
        notice.value = text
        clearTimeout(timer)
        timer = setTimeout(() => (notice.value = ''), 4200)
    }

    function cleanup() {
        clearTimeout(timer)
    }

    return { notice, showNotice, cleanup }
}