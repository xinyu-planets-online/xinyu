<script setup>
import { ref, watch } from 'vue'
import { useVoiceInput } from '@/composables/useVoiceInput'

const props = defineProps({
    disabled: { type: Boolean, default: false },
    baseText: { type: String, default: '' },
})
const emit = defineEmits(['update', 'finish', 'cancel'])

const active = ref(false)

const voice = useVoiceInput({
    lang: 'zh-CN',
    onFinalText: (text) => {
        emit('finish', text)
        active.value = false
    },
})

function toggle() {
    if (!voice.isSupported.value) {
        alert('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。')
        return
    }

    if (active.value) {
        active.value = false
        voice.finish()
    } else {
        active.value = true
        voice.begin(props.baseText)
    }
}

// 实时预览推给父组件
watch(
    () => voice.previewText.value,
    (text) => {
        if (active.value) emit('update', text)
    }
)

watch(
    () => voice.errorMessage.value,
    (msg) => {
        if (msg) {
            emit('cancel')
            active.value = false
        }
    }
)
</script>

<template>
    <div class="voice-wrap">
        <button class="voice-btn" :class="{ active, unsupported: !voice.isSupported.value }" :disabled="disabled"
            :title="voice.isSupported.value ? (active ? '结束语音输入' : '语音输入') : '当前浏览器不支持语音输入'" @click="toggle">
            <svg v-if="!active" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
            <span v-else class="pulse" />
        </button>

        <p v-if="voice.errorMessage.value" class="voice-error">
            {{ voice.errorMessage.value }}
        </p>
    </div>
</template>

<style scoped>
.voice-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.voice-btn {
    width: 2.25rem;
    height: 2.25rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.voice-btn svg {
    width: 1rem;
    height: 1rem;
}

.voice-btn:hover:not(.unsupported) {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-color: var(--acu-primary-soft);
}

.voice-btn.active {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border-color: var(--acu-primary);
}

.voice-btn.unsupported {
    opacity: 0.35;
    cursor: not-allowed;
}

.pulse {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 50%;
    background: currentColor;
    animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
        opacity: 0.7;
    }

    50% {
        transform: scale(1.35);
        opacity: 1;
    }
}

.voice-error {
    margin: 0;
    font-size: 0.6875rem;
    color: var(--acu-error);
    white-space: nowrap;
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>