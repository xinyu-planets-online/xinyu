<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
    visible: { type: Boolean, default: false },
    content: { type: String, default: '' },
})
const emit = defineEmits(['close', 'submit'])

const textareaRef = ref(null)
const localContent = ref('')

watch(
    () => props.visible,
    async (v) => {
        if (!v) return
        localContent.value = props.content
        await nextTick()
        const el = textareaRef.value
        if (el) {
            el.focus()
            el.setSelectionRange(localContent.value.length, localContent.value.length)
        }
    }
)

function onSubmit() {
    const text = localContent.value.trim()
    if (!text) return
    emit('submit', text)
}

function onKeydown(e) {
    if (e.key === 'Escape') {
        e.preventDefault()
        emit('close')
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        onSubmit()
    }
}
</script>

<template>
    <Teleport to="body">
        <transition name="edit-dialog">
            <div v-if="visible" class="edit-dialog-mask" @click.self="$emit('close')">
                <div class="edit-dialog" role="dialog" aria-modal="true" @keydown="onKeydown">
                    <header class="edit-dialog-header">
                        <h3 class="edit-dialog-title">修改消息</h3>
                        <p class="edit-dialog-subtitle">保存后将从这条消息重新生成回答</p>
                    </header>

                    <div class="edit-dialog-body">
                        <textarea ref="textareaRef" v-model="localContent" class="edit-dialog-textarea" rows="6"
                            placeholder="输入新的消息内容" />
                    </div>

                    <footer class="edit-dialog-footer">
                        <span class="edit-dialog-hint">Ctrl / ⌘ + Enter 提交</span>
                        <div class="edit-dialog-actions">
                            <button class="edit-dialog-btn" @click="$emit('close')">取消</button>
                            <button class="edit-dialog-btn primary" :disabled="!localContent.trim()"
                                @click="onSubmit">确定</button>
                        </div>
                    </footer>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
.edit-dialog-mask {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(2px);
}

.edit-dialog {
    width: min(32rem, 100%);
    display: flex;
    flex-direction: column;
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.875rem;
    box-shadow: var(--acu-shadow-lg);
    overflow: hidden;
}

.edit-dialog-header {
    padding: 1rem 1.25rem 0.5rem;
}

.edit-dialog-title {
    margin: 0 0 0.25rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--acu-text);
}

.edit-dialog-subtitle {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--acu-text-muted);
}

.edit-dialog-body {
    padding: 0.5rem 1.25rem;
}

.edit-dialog-textarea {
    width: 100%;
    box-sizing: border-box;
    min-height: 8rem;
    padding: 0.75rem 0.875rem;
    font-family: inherit;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--acu-text);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.625rem;
    resize: vertical;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.edit-dialog-textarea:focus {
    border-color: var(--acu-primary);
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.edit-dialog-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1.25rem 1rem;
}

.edit-dialog-hint {
    font-size: 0.75rem;
    color: var(--acu-text-muted);
}

.edit-dialog-actions {
    display: flex;
    gap: 0.5rem;
}

.edit-dialog-btn {
    height: 2.25rem;
    padding: 0 1.125rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
    background: transparent;
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.edit-dialog-btn:hover {
    color: var(--acu-text);
    background: var(--acu-surface);
    border-color: var(--acu-border-strong);
}

.edit-dialog-btn.primary {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border-color: var(--acu-primary);
}

.edit-dialog-btn.primary:hover {
    background: var(--acu-primary-hover);
    border-color: var(--acu-primary-hover);
}

.edit-dialog-btn.primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.edit-dialog-enter-active,
.edit-dialog-leave-active {
    transition: opacity 0.18s ease;
}

.edit-dialog-enter-active .edit-dialog,
.edit-dialog-leave-active .edit-dialog {
    transition: transform 0.18s ease, opacity 0.18s ease;
}

.edit-dialog-enter-from,
.edit-dialog-leave-to {
    opacity: 0;
}

.edit-dialog-enter-from .edit-dialog,
.edit-dialog-leave-to .edit-dialog {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.98);
}

@media (prefers-reduced-motion: reduce) {

    .edit-dialog-enter-active,
    .edit-dialog-leave-active,
    .edit-dialog-enter-active .edit-dialog,
    .edit-dialog-leave-active .edit-dialog {
        transition: none;
    }
}
</style>