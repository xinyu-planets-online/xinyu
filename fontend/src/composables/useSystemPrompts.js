import { ref, watch } from 'vue'

const KEY = 'chat-user-system-prompt'

export function useUserSystemPrompt() {
    const userSystemPrompt = ref('')
    try {
        userSystemPrompt.value = localStorage.getItem(KEY) || ''
    } catch { }

    watch(userSystemPrompt, v => {
        try {
            if (v) localStorage.setItem(KEY, v)
            else localStorage.removeItem(KEY)
        } catch { }
    })

    return { userSystemPrompt }
}