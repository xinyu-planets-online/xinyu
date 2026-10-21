<script setup>
import { ref } from 'vue'

defineProps({
    showSettings: { type: Boolean, default: false },
    currentProvider: { type: String, default: '' },
    currentModel: { type: String, default: '' },
})
defineEmits(['close'])

const configEl = ref(null)

function getClient() {
    return configEl.value?.client
}

defineExpose({ getClient })
</script>

<template>
    <div class="mask" :class="{ show: showSettings }" @click="$emit('close')" />

    <aside class="drawer" :class="{ show: showSettings }">
        <header class="drawer-header">
            <div class="drawer-heading">
                <h2 class="drawer-title">设置</h2>
                <p class="drawer-subtitle">配置模型与 API Key</p>
            </div>
            <button class="drawer-close" aria-label="关闭" @click="$emit('close')">
                <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                    <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
                </svg>
            </button>
        </header>

        <div class="drawer-body">
            <div class="current-card">
                <div class="current-label">当前模型</div>
                <div class="current-value">
                    <template v-if="currentProvider">
                        <span class="current-provider">{{ currentProvider }}</span>
                        <span v-if="currentModel" class="current-divider">/</span>
                        <span v-if="currentModel" class="current-model">{{ currentModel }}</span>
                    </template>
                    <span v-else class="current-empty">尚未选择</span>
                </div>
            </div>

            <section class="config-section">
                <div class="section-head">
                    <h3 class="section-title">Provider 配置</h3>
                    <p class="section-desc">填写你自己的 API Key，选择 Provider 与模型</p>
                </div>
                <div class="config-panel">
                    <llm-hub-config ref="configEl" storage="localStorage" locale="zh" show-debug />
                </div>
            </section>
        </div>

        <footer class="drawer-footer">
            <button class="btn-secondary" @click="$emit('close')">取消</button>
            <button class="btn-primary" @click="$emit('close')">完成</button>
        </footer>
    </aside>
</template>

<style scoped>
.mask {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--mask);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.35s ease;
}

.mask.show {
    opacity: 1;
    pointer-events: auto;
}

.drawer {
    position: fixed;
    top: 0;
    right: 0;
    z-index: 50;
    height: 100vh;
    height: 100dvh;
    width: 42vw;
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    background: var(--acu-bg);
    border-left: 0.0625rem solid var(--acu-border);
    box-shadow: var(--drawer-shadow);
    transform: translateX(105%);
    transition: transform 0.42s cubic-bezier(0.22, 0.8, 0.24, 1);
}

.drawer.show {
    transform: translateX(0);
}

.drawer-header {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: clamp(0.75rem, 1.6vw, 1rem);
    padding: clamp(1rem, 2.4vh, 1.5rem) clamp(1rem, 2.4vw, 1.5rem) clamp(0.75rem, 1.8vh, 1.25rem);
    border-bottom: 0.0625rem solid var(--acu-border);
}

.drawer-heading {
    min-width: 0;
}

.drawer-title {
    margin: 0 0 0.25rem;
    font-size: clamp(1rem, 0.9rem + 0.4vw, 1.125rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--acu-text);
}

.drawer-subtitle {
    margin: 0;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    color: var(--acu-text-muted);
}

.drawer-close {
    flex: 0 0 auto;
    width: clamp(1.75rem, 2.8vw, 2rem);
    height: clamp(1.75rem, 2.8vw, 2rem);
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: transparent;
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.625rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.drawer-close svg {
    width: 1.125em;
    height: 1.125em;
}

.drawer-close:hover {
    color: var(--acu-text);
    background: var(--acu-surface-2);
    border-color: var(--acu-border-strong);
}

.drawer-body {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: clamp(0.75rem, 2vh, 1.25rem);
    padding: clamp(0.875rem, 2.2vh, 1.5rem) clamp(1rem, 2.4vw, 1.5rem);
    scrollbar-width: thin;
    scrollbar-color: var(--acu-border-strong) transparent;
}

.drawer-body::-webkit-scrollbar {
    width: 0.375rem;
}

.drawer-body::-webkit-scrollbar-thumb {
    background: var(--acu-border-strong);
    border-radius: 999rem;
}

.drawer-body>* {
    flex: 0 0 auto;
    min-width: 0;
}

.current-card {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: clamp(0.75rem, 1.8vh, 1rem) clamp(0.875rem, 2vw, 1.125rem);
    background: var(--acu-surface);
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.875rem;
}

.current-label {
    font-size: clamp(0.625rem, 0.6rem + 0.1vw, 0.6875rem);
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--acu-text-muted);
    margin-bottom: clamp(0.375rem, 0.9vh, 0.5rem);
}

.current-value {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: clamp(0.375rem, 0.8vw, 0.5rem);
    font-size: clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem);
    font-weight: 500;
    color: var(--acu-text);
    min-width: 0;
    word-break: break-word;
}

.current-provider {
    padding: 0.1875rem 0.625rem;
    font-size: clamp(0.75rem, 0.72rem + 0.15vw, 0.8125rem);
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-radius: 0.375rem;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.current-divider {
    color: var(--acu-text-muted);
    font-weight: 400;
}

.current-empty {
    color: var(--acu-text-muted);
    font-weight: 400;
}

.config-section {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(0.5rem, 1vh, 0.75rem);
}

.section-head {
    display: flex;
    flex-direction: column;
    gap: 0.1875rem;
    min-width: 0;
}

.section-title {
    margin: 0;
    font-size: clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--acu-text);
}

.section-desc {
    margin: 0;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    line-height: 1.6;
    color: var(--acu-text-muted);
}

.config-panel {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    background: var(--acu-surface);
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.875rem;
}

.config-panel>* {
    display: block;
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
}

.drawer-footer {
    flex: 0 0 auto;
    display: flex;
    justify-content: flex-end;
    gap: clamp(0.5rem, 1vw, 0.75rem);
    padding: clamp(0.75rem, 1.8vh, 1rem) clamp(1rem, 2.4vw, 1.5rem);
    border-top: 0.0625rem solid var(--acu-border);
    background: var(--acu-bg);
}

.btn-secondary,
.btn-primary {
    height: clamp(2rem, 4vh, 2.375rem);
    padding: 0 clamp(0.875rem, 1.6vw, 1.25rem);
    font-size: clamp(0.8125rem, 0.78rem + 0.2vw, 0.875rem);
    font-weight: 500;
    letter-spacing: 0.04em;
    border-radius: 0.625rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.btn-secondary {
    color: var(--acu-text-secondary);
    background: transparent;
    border: 0.0625rem solid var(--acu-border);
}

.btn-secondary:hover {
    color: var(--acu-text);
    background: var(--acu-surface-2);
    border-color: var(--acu-border-strong);
}

.btn-primary {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border: 0.0625rem solid transparent;
}

.btn-primary:hover {
    background: var(--acu-primary-hover);
}

@media (max-width: 64rem) {
    .drawer {
        width: 60vw;
    }
}

@media (max-width: 48rem) {
    .drawer {
        width: 100vw;
        border-left: none;
    }

    .drawer-header {
        padding: clamp(0.875rem, 2.2vh, 1.25rem) clamp(0.875rem, 3vw, 1.125rem) clamp(0.625rem, 1.6vh, 1rem);
    }

    .drawer-body {
        padding: clamp(0.75rem, 1.8vh, 1rem) clamp(0.875rem, 3vw, 1.125rem);
    }

    .drawer-footer {
        padding: clamp(0.625rem, 1.6vh, 1rem) clamp(0.875rem, 3vw, 1.125rem);
    }
}

@media (prefers-reduced-motion: reduce) {

    .drawer,
    .mask {
        transition: none;
    }
}
</style>