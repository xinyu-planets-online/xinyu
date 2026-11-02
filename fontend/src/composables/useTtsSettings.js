import { ref, watch } from 'vue'

const STORAGE_KEY = 'chat-tts-settings'

const DEFAULT_SETTINGS = {
    enabled: false,
    voice: null,
}

export function useTtsSettings() {
    const settings = ref({ ...DEFAULT_SETTINGS })

    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) Object.assign(settings.value, JSON.parse(raw))
    } catch { }

    watch(settings, (v) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
        } catch { }
    }, { deep: true })

    return settings
}