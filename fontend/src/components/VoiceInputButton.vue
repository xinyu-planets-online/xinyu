<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { useVoiceInput } from '@/composables/useVoiceInput'

const props = defineProps({
    disabled: { type: Boolean, default: false },
    baseText: { type: String, default: '' },
})
const emit = defineEmits(['update', 'finish', 'cancel'])

const HOLD_MS = 250

const active = ref(false)       // 是否在录音（UI 用）
const locked = ref(false)       // 是否处于"单击开启"的锁定态

let pressAt = 0                 // 本次 pointerdown 时间
let downWasActive = false       // pointerdown 时是否已处于录音中（用于判断"再点一下关闭"）

const voice = useVoiceInput({
    lang: 'zh-CN',
    onFinalText: (text) => {
        emit('finish', text)
    },
})

function startRecording() {
    locked.value = false
    pressAt = performance.now()
    voice.begin(props.baseText || '')
    active.value = true
}

function finishRecording() {
    active.value = false
    locked.value = false
    voice.finish()
}

function cancelRecording() {
    active.value = false
    locked.value = false
    voice.cancel()
    emit('cancel')
}

function onPointerDown(e) {
    if (props.disabled) return
    if (!voice.isSupported.value) {
        alert('当前浏览器不支持语音输入，请使用 Chrome 或 Edge。')
        return
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return

    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { }

    if (active.value) {
        // 已在录音（说明是锁定态），记录这次 down 用于 pointerup 关闭
        downWasActive = true
        return
    }

    downWasActive = false
    startRecording()
}

function onPointerUp(e) {
    if (!active.value) return
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch { }

    if (downWasActive) {
        // 锁定态下再次点击 → 关闭
        downWasActive = false
        finishRecording()
        return
    }

    const held = performance.now() - pressAt
    if (held < HOLD_MS) {
        // 短按 → 进入锁定态（单击开启）
        locked.value = true
    } else {
        // 长按松开（PTT）→ 结束
        finishRecording()
    }
}

function onPointerCancel() {
    if (!active.value) return
    if (downWasActive) {
        // 取消这次"关闭"意图，保持原录音
        downWasActive = false
        return
    }
    // holding 状态被系统取消 → 结束
    finishRecording()
}

function onContextMenu(e) {
    if (active.value) e.preventDefault()
}

function onKeyDown(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (e.repeat) return
    if (props.disabled) return
    if (!voice.isSupported.value) return
    e.preventDefault()
    if (active.value && locked.value) {
        finishRecording()
        return
    }
    if (!active.value) {
        startRecording()
    }
}

function onKeyUp(e) {
    if (e.key !== ' ' && e.key !== 'Enter') return
    if (!active.value) return
    e.preventDefault()
    // 键盘始终按 PTT 处理
    if (!locked.value) finishRecording()
}

// 实时预览推给父组件
watch(
    () => voice.previewText.value,
    (text) => {
        if (active.value) emit('update', text)
    }
)

// 出错时自动清理，不提交
watch(
    () => voice.errorMessage.value,
    (msg) => {
        if (msg && active.value) {
            cancelRecording()
        }
    }
)

onBeforeUnmount(() => {
    if (active.value) cancelRecording()
})
</script>

<template>
    <div class="voice-wrap">
        <button class="voice-btn" :class="{ active, locked, unsupported: !voice.isSupported.value }"
            :disabled="disabled" :title="voice.isSupported.value
                ? (active
                    ? (locked ? '点击结束录音' : '松开结束，或轻点保持录音')
                    : '按住说话，或点击开始')
                : '当前浏览器不支持语音输入'" @pointerdown="onPointerDown" @pointerup="onPointerUp"
            @pointercancel="onPointerCancel" @contextmenu="onContextMenu" @keydown="onKeyDown" @keyup="onKeyUp">
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
    touch-action: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
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

.voice-btn.active.locked {
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.voice-btn.unsupported {
    opacity: 0.35;
    cursor: not-allowed;
}

.voice-btn:focus-visible {
    outline: 2px solid var(--acu-primary);
    outline-offset: 2px;
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

@media (prefers-reduced-motion: reduce) {
    .pulse {
        animation: none;
    }

    .voice-btn {
        transition: none;
    }
}
</style>