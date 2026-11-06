<template>
    <div class="mindful">
        <a class="mindful__back" href="/" aria-label="返回" @click.prevent="goBack">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                    stroke-linejoin="round" />
            </svg>
            <span>返回</span>
        </a>

        <main class="mindful__stage">
            <header class="mindful__head">
                <h1 class="mindful__title">正念呼吸</h1>
                <p class="mindful__subtitle">放慢呼吸，让心回到此刻</p>
            </header>

            <div class="breathe" :class="`breathe--${phaseKey}`">
                <span class="breathe__halo" />
                <span class="breathe__ring breathe__ring--outer" />
                <span class="breathe__ring breathe__ring--inner" />
                <span class="breathe__core" />
                <span class="breathe__label">{{ phaseLabel }}</span>
            </div>

            <p class="mindful__hint">跟随圆圈的节奏，鼻吸 · 屏息 · 口呼</p>
            <p class="mindful__meta">4 · 2 · 6 呼吸法</p>
        </main>
    </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

/* 4s 吸气 · 2s 屏息 · 6s 呼气 = 12s 一个循环，与 CSS 动画同周期 */
const PHASES = [
    { key: 'in', label: '吸气', duration: 4000 },
    { key: 'hold', label: '屏息', duration: 2000 },
    { key: 'out', label: '呼气', duration: 6000 },
]
const TOTAL = PHASES.reduce((sum, p) => sum + p.duration, 0)

const phaseKey = ref('in')
const phaseLabel = ref('吸气')

let timers = new Set()

function schedule(fn, ms) {
    const t = setTimeout(() => {
        timers.delete(t)
        fn()
    }, ms)
    timers.add(t)
}

function runCycle() {
    let offset = 0
    for (const p of PHASES) {
        schedule(() => {
            phaseKey.value = p.key
            phaseLabel.value = p.label
        }, offset)
        offset += p.duration
    }
    schedule(runCycle, TOTAL)
}

function goBack() {
    if (document.referrer && new URL(document.referrer).origin === location.origin) {
        history.back()
    } else {
        location.href = '/'
    }
}

onMounted(() => {
    runCycle()
})

onBeforeUnmount(() => {
    timers.forEach(clearTimeout)
    timers.clear()
})
</script>

<style scoped>
.mindful {
    box-sizing: border-box;
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem 1.25rem;
    overflow: hidden;
    overscroll-behavior: none;
    color: #d9e5e7;
    background:
        radial-gradient(ellipse 90% 65% at 50% 28%, #1b2b31 0%, transparent 70%),
        radial-gradient(ellipse 70% 55% at 50% 105%, #101a1e 0%, transparent 70%),
        #0a1013;
    font-family: inherit;
}

/* 返回：低存在感，悬停才亮 */
.mindful__back {
    position: fixed;
    top: max(0.875rem, env(safe-area-inset-top));
    left: max(0.875rem, env(safe-area-inset-left));
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    height: 2rem;
    padding: 0 0.75rem 0 0.5rem;
    font-size: 0.75rem;
    letter-spacing: 0.05em;
    color: rgba(200, 218, 220, 0.5);
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(200, 220, 222, 0.08);
    border-radius: 999rem;
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: color 0.25s ease, background 0.25s ease, border-color 0.25s ease;
}

.mindful__back svg {
    width: 0.875rem;
    height: 0.875rem;
}

.mindful__back:hover,
.mindful__back:focus-visible {
    color: rgba(230, 242, 243, 0.92);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(200, 220, 222, 0.16);
    outline: none;
}

.mindful__stage {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(1.5rem, 4vh, 2.75rem);
    text-align: center;
}

.mindful__head {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.mindful__title {
    margin: 0;
    font-size: clamp(1.125rem, 1rem + 0.8vw, 1.5rem);
    font-weight: 500;
    letter-spacing: 0.3em;
    padding-left: 0.3em;
    color: rgba(225, 237, 239, 0.92);
}

.mindful__subtitle {
    margin: 0;
    font-size: clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem);
    letter-spacing: 0.15em;
    color: rgba(180, 200, 203, 0.5);
}

/* 呼吸圆 */
.breathe {
    position: relative;
    width: min(56vw, 240px);
    aspect-ratio: 1;
    display: grid;
    place-items: center;
}

.breathe__halo {
    position: absolute;
    inset: -18%;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(130, 185, 188, 0.1) 0%, transparent 65%);
    animation: breathe-halo 12s ease-in-out infinite;
    pointer-events: none;
}

.breathe__ring {
    position: absolute;
    border-radius: 50%;
    pointer-events: none;
}

.breathe__ring--outer {
    inset: 0;
    border: 1px solid rgba(160, 205, 208, 0.16);
}

.breathe__ring--inner {
    inset: 14%;
    border: 1px solid rgba(160, 205, 208, 0.1);
}

.breathe__core {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: radial-gradient(circle,
            rgba(165, 212, 214, 0.32) 0%,
            rgba(120, 175, 180, 0.14) 42%,
            transparent 70%);
    box-shadow:
        0 0 60px rgba(130, 190, 195, 0.18),
        inset 0 0 40px rgba(160, 210, 212, 0.12);
    animation: breathe-scale 12s ease-in-out infinite;
    pointer-events: none;
}

.breathe__label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: clamp(0.875rem, 0.8rem + 0.3vw, 1rem);
    letter-spacing: 0.35em;
    padding-left: 0.35em;
    color: rgba(228, 240, 241, 0.85);
    text-shadow: 0 0 12px rgba(150, 200, 205, 0.35);
    pointer-events: none;
}

@keyframes breathe-scale {
    0% {
        transform: scale(0.62);
    }

    33.33% {
        transform: scale(1);
    }

    /* 吸气结束 */
    50% {
        transform: scale(1);
    }

    /* 屏息结束 */
    100% {
        transform: scale(0.62);
    }

    /* 呼气结束 */
}

@keyframes breathe-halo {
    0% {
        transform: scale(0.85);
        opacity: 0.5;
    }

    33.33% {
        transform: scale(1.05);
        opacity: 0.9;
    }

    50% {
        transform: scale(1.05);
        opacity: 0.9;
    }

    100% {
        transform: scale(0.85);
        opacity: 0.5;
    }
}

.mindful__hint {
    margin: 0;
    font-size: clamp(0.75rem, 0.7rem + 0.2vw, 0.8125rem);
    letter-spacing: 0.12em;
    color: rgba(180, 200, 203, 0.48);
}

.mindful__meta {
    margin: 0;
    font-size: 0.6875rem;
    letter-spacing: 0.2em;
    color: rgba(160, 180, 183, 0.32);
}

@media (prefers-reduced-motion: reduce) {

    .breathe__core,
    .breathe__halo {
        animation: none;
        transform: scale(0.85);
    }
}
</style>