<script setup>
defineProps({
    themeLabel: { type: String, required: true },
    showSettings: { type: Boolean, default: false },
})
defineEmits(['cycle-theme', 'toggle-settings', 'open-energy'])
</script>

<template>
    <header class="topbar">
        <div class="brand">
            <slot name="sidebar-toggle" />
            <span class="brand-dot" />
            <span class="brand-name">心屿</span>
        </div>

        <nav class="nav" aria-label="功能导航">
            <a class="pill-btn pill-btn--mind" href="#mindfulness" title="正念呼吸安抚">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                    <circle cx="8" cy="8" r="4" stroke="currentColor" stroke-width="1.2" opacity="0.55" />
                    <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2" opacity="0.28" />
                </svg>
                <span>正念呼吸</span>
            </a>
            <a class="pill-btn pill-btn--energy" href="javascript:void(0)" role="button" title="今日能量站"
                @click="$emit('open-energy')">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 1.5l1.4 4.1 4.1 1.4-4.1 1.4L8 12.5 6.6 8.4 2.5 7l4.1-1.4L8 1.5z" stroke="currentColor"
                        stroke-width="1.2" stroke-linejoin="round" />
                </svg>
                <span>今日能量站</span>
            </a>
        </nav>

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
    gap: clamp(0.5rem, 1vw, 0.875rem);
    padding: clamp(0.75rem, 1.5vh, 1rem) clamp(0.875rem, 2vw, 1.5rem) 0.5rem;
}

.brand {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: clamp(0.375rem, 0.8vw, 0.625rem);
    min-width: 0;
}

.brand-dot {
    flex: 0 0 auto;
    width: clamp(1.125rem, 2vw, 1.5rem);
    height: clamp(1.125rem, 2vw, 1.5rem);
    background: var(--acu-primary);
    -webkit-mask: url("/favicon.ico") center / contain no-repeat;
    mask: url("/favicon.ico") center / contain no-repeat;
    filter: drop-shadow(0 0 clamp(0.25rem, 0.5vw, 0.3125rem) var(--acu-primary-soft));
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

/* 主导航：紧跟品牌，占中段 */
.nav {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(0.375rem, 0.8vw, 0.5rem);
    min-width: 0;
}

.actions {
    flex: 0 0 auto;
    display: flex;
    gap: clamp(0.375rem, 0.8vw, 0.5rem);
    margin-left: auto;
}

.pill-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    height: clamp(1.875rem, 3.2vh, 2.25rem);
    padding: 0 clamp(0.625rem, 1.2vw, 0.9375rem);
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    letter-spacing: 0.04em;
    color: var(--acu-text-secondary);
    background: var(--acu-bg);
    border: 0.0625rem solid var(--acu-border);
    border-radius: 999rem;
    cursor: pointer;
    text-decoration: none;
    white-space: nowrap;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.pill-btn svg {
    width: 0.875rem;
    height: 0.875rem;
    flex: 0 0 auto;
}

.pill-btn--energy {
    color: var(--acu-text);
}

.pill-btn--energy svg {
    color: var(--acu-primary);
}

@media (max-width: 48rem) {
    .pill-btn--energy span {
        display: none;
    }

    .pill-btn--energy::after {
        content: "能量";
        margin-left: 0.25rem;
    }
}

.pill-btn:hover,
.pill-btn.active,
.pill-btn:focus-visible {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-color: var(--acu-primary-soft);
    outline: none;
}

/* 功能入口：正常可见，图标常亮主题色以示意"这是功能" */
.pill-btn--mind {
    color: var(--acu-text);
}

.pill-btn--mind svg {
    color: var(--acu-primary);
}

@media (max-width: 48rem) {
    .topbar {
        padding: clamp(0.5rem, 1.6vh, 0.75rem) clamp(0.625rem, 3vw, 1rem) 0.375rem;
        gap: 0.5rem;
    }

    .pill-btn {
        padding: 0 0.625rem;
    }

    /* 窄屏放不下完整文字时缩短文案，而不是隐藏功能 */
    .pill-btn--mind span {
        display: none;
    }

    .pill-btn--mind::after {
        content: "正念";
        margin-left: 0.25rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .brand-dot {
        animation: none;
    }
}
</style>