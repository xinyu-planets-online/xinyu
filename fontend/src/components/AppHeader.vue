<script setup>
defineProps({
    themeLabel: { type: String, required: true },
    showSettings: { type: Boolean, default: false },
})
defineEmits(['cycle-theme', 'toggle-settings'])
</script>

<template>
    <header class="topbar">
        <div class="brand">
            <span class="brand-dot" />
            <span class="brand-name">AI 助手</span>
        </div>

        <div class="actions">
            <button class="pill-btn" :title="`切换主题，当前：${themeLabel}`" @click="$emit('cycle-theme')">
                主题：{{ themeLabel }}
            </button>
            <button class="pill-btn" :class="{ active: showSettings }" @click="$emit('toggle-settings')">
                设置
            </button>
        </div>
    </header>
</template>

<style scoped>
.topbar {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: clamp(0.5rem, 1vw, 0.875rem);
    padding: clamp(0.75rem, 1.5vh, 1rem) clamp(0.875rem, 2vw, 1.5rem) 0.5rem;
}

.brand {
    display: flex;
    align-items: center;
    gap: clamp(0.375rem, 0.8vw, 0.625rem);
    min-width: 0;
}

.brand-dot {
    flex: 0 0 auto;
    width: clamp(0.375rem, 0.7vw, 0.5rem);
    height: clamp(0.375rem, 0.7vw, 0.5rem);
    border-radius: 50%;
    background: var(--acu-primary);
    box-shadow: 0 0 0 clamp(0.25rem, 0.5vw, 0.3125rem) var(--acu-primary-soft);
    animation: breathe 4.5s ease-in-out infinite;
}

@keyframes breathe {

    0%,
    100% {
        transform: scale(1);
        opacity: 0.85;
    }

    50% {
        transform: scale(1.18);
        opacity: 1;
    }
}

.brand-name {
    font-size: clamp(0.875rem, 0.8rem + 0.25vw, 1rem);
    font-weight: 600;
    letter-spacing: 0.06em;
    white-space: nowrap;
}

.actions {
    display: flex;
    gap: clamp(0.375rem, 0.8vw, 0.5rem);
}

.pill-btn {
    height: clamp(1.875rem, 3.2vh, 2.25rem);
    padding: 0 clamp(0.625rem, 1.2vw, 0.9375rem);
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    letter-spacing: 0.04em;
    color: var(--acu-text-secondary);
    background: var(--acu-bg);
    border: 0.0625rem solid var(--acu-border);
    border-radius: 999rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.pill-btn:hover,
.pill-btn.active {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-color: var(--acu-primary-soft);
}

@media (max-width: 48rem) {
    .topbar {
        padding: clamp(0.5rem, 1.6vh, 0.75rem) clamp(0.625rem, 3vw, 1rem) 0.375rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .brand-dot {
        animation: none;
    }
}
</style>