<template>
    <div ref="stageRef" class="stage" @click="onClick">
        <div ref="scrollerRef" class="scroller" @scroll.passive="onScroll">
            <div class="content" :style="{ height: contentH + 'px' }">
                <img ref="imgRef" class="content__img" src="/design.jpg" :style="imgStyle" alt="" draggable="false"
                    @load="measure" />

                <div v-for="d in drops" :key="d.id" class="drop-ring" :style="dropStyle(d)"
                    @animationend="removeDrop(d.id)" />
            </div>
        </div>

        <div class="ripple-layer" :style="{ opacity: renderH ? 1 : 0 }" aria-hidden="true">
            <div class="ripple-root" :style="originStyle">
                <div class="ripple-origin" />
                <div class="ripple-wave wave-a" />
                <div class="ripple-wave wave-b" />
                <div class="ripple-wave wave-c" />
                <div class="ripple-wave wave-d" />
                <div class="ripple-wave wave-e" />
                <div class="ripple-wave wave-f" />
            </div>
        </div>

        <button v-show="renderH" class="next-btn" type="button" aria-label="下一步" :style="originStyle" @click="goNext">
            <span class="next-btn__ring" />
            <span class="next-btn__ring next-btn__ring--slow" />
            <span class="next-btn__core" />
            <span class="next-btn__dot" />
        </button>

        <div class="click-layer" aria-hidden="true">
            <div v-for="r in rings" :key="r.id" class="click-ring" :style="ringStyle(r)"
                @animationend="removeRing(r.id)" />
        </div>

        <Transition name="modal-fade">
            <div v-if="showModal" class="modal" @click.stop.self="closeModal">
                <div class="modal__panel" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <button class="modal__close" type="button" aria-label="关闭" @click="closeModal">✕</button>

                    <h2 id="modal-title" class="modal__title">继续体验</h2>
                    <p class="modal__subtitle">选择登录账号，或直接免费试用</p>

                    <div class="modal__actions">
                        <button class="modal-card" type="button" @click="handleLogin">
                            <span class="modal-card__title">登录</span>
                            <span class="modal-card__desc">已有账号，立即进入</span>
                        </button>
                        <button class="modal-card" type="button" @click="handleTrial">
                            <span class="modal-card__title">试用</span>
                            <span class="modal-card__desc">免费体验，无需注册</span>
                        </button>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const lineRatio = 0.9
const ORIGIN_X = 0.8
const ORIGIN_Y = 0.8
const heightRatio = 1

const stageRef = ref(null)
const scrollerRef = ref(null)
const imgRef = ref(null)

const stageW = ref(0)
const stageH = ref(0)
const natW = ref(0)
const natH = ref(0)
const scrollTop = ref(0)

const ratio = Math.min(Math.max(lineRatio, 0), 1)

const renderH = computed(() => {
    if (!natW.value || !natH.value || !stageH.value || !stageW.value) return 0
    const aspect = natW.value / natH.value
    let h = stageH.value * heightRatio
    let w = h * aspect
    if (w < stageW.value) {
        w = stageW.value
        h = w / aspect
    }
    return h
})

const renderW = computed(() => {
    if (!renderH.value || !natW.value || !natH.value) return 0
    return renderH.value * (natW.value / natH.value)
})

const tx = computed(() => {
    const rw = renderW.value
    const sw = stageW.value
    if (!rw || !sw) return 0
    if (rw <= sw) return (sw - rw) / 2
    const ideal = sw / 2 - ORIGIN_X * rw
    const minTx = sw - rw
    const maxTx = 0
    return Math.min(maxTx, Math.max(minTx, ideal))
})

const offsetY = computed(() => {
    const h = renderH.value
    const H = stageH.value
    if (!h || !H) return 0
    const lineY = h * ratio
    return lineY > H ? H - lineY : 0
})

const contentH = computed(() => {
    const h = renderH.value
    const H = stageH.value
    if (!h || !H) return H
    return h + offsetY.value
})

const imgStyle = computed(() => ({
    left: `${tx.value}px`,
    top: `${offsetY.value}px`,
    width: `${renderW.value}px`,
    height: `${renderH.value}px`
}))

const originStyle = computed(() => ({
    left: `${tx.value + ORIGIN_X * renderW.value}px`,
    top: `${offsetY.value + ORIGIN_Y * renderH.value - scrollTop.value}px`
}))

function onScroll() {
    if (scrollerRef.value) scrollTop.value = scrollerRef.value.scrollTop
}

function measure() {
    if (stageRef.value) {
        stageW.value = stageRef.value.clientWidth
        stageH.value = stageRef.value.clientHeight
    }
    if (imgRef.value && imgRef.value.naturalWidth) {
        natW.value = imgRef.value.naturalWidth
        natH.value = imgRef.value.naturalHeight
    }
    onScroll()
}

const showModal = ref(false)

function goNext() {
    showModal.value = true
}

function closeModal() {
    showModal.value = false
}

function handleLogin() {
    window.location.href = '/#login'
}

function handleTrial() {
    window.location.href = '/#trial'
}

watch(showModal, (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
})

function onKeydown(e) {
    if (e.key === 'Escape' && showModal.value) closeModal()
}

const rings = ref([])
let ringSeq = 0

function onClick(e) {
    const stage = stageRef.value
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    for (let i = 0; i < 3; i++) {
        rings.value.push({ id: ++ringSeq, x, y, delay: i * 400 })
    }
}

function ringStyle(r) {
    return {
        left: `${r.x}px`,
        top: `${r.y}px`,
        animationDelay: `${r.delay}ms`
    }
}

function removeRing(id) {
    rings.value = rings.value.filter((r) => r.id !== id)
}

const drops = ref([])
let dropSeq = 0
let dropTimer = null

function scheduleDrop() {
    dropTimer = setTimeout(() => {
        spawnDrops()
        scheduleDrop()
    }, 350 + Math.random() * 650)
}

function spawnDrops() {
    if (!renderH.value) return
    const count = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
        drops.value.push({
            id: ++dropSeq,
            x: 0.05 + Math.random() * 0.9,
            y: 0.05 + Math.random() * 0.9,
            size: 70 + Math.random() * 130,
            duration: 1400 + Math.random() * 1200
        })
    }
}

function dropStyle(d) {
    return {
        left: `${tx.value + d.x * renderW.value}px`,
        top: `${offsetY.value + d.y * renderH.value}px`,
        width: `${d.size}px`,
        height: `${d.size}px`,
        animationDuration: `${d.duration}ms`
    }
}

function removeDrop(id) {
    drops.value = drops.value.filter((d) => d.id !== id)
}

function onVisibility() {
    if (document.hidden) {
        clearTimeout(dropTimer)
        dropTimer = null
    } else if (!dropTimer) {
        scheduleDrop()
    }
}

let ro = null
onMounted(() => {
    measure()
    ro = new ResizeObserver(measure)
    if (stageRef.value) ro.observe(stageRef.value)
    window.addEventListener('orientationchange', measure)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('keydown', onKeydown)
    scheduleDrop()
})

onBeforeUnmount(() => {
    ro && ro.disconnect()
    clearTimeout(dropTimer)
    window.removeEventListener('orientationchange', measure)
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
})
</script>

<style scoped>
.stage {
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    background: #000;
    overscroll-behavior: none;
}

.scroller {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.scroller::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.content {
    position: relative;
    width: 100%;
    overflow: hidden;
}

.content__img {
    position: absolute;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
    max-width: none;
}

/* ===== 下一步按钮 ===== */
.next-btn {
    position: absolute;
    z-index: 5;
    width: 84px;
    height: 84px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    transform: translate(-50%, -50%);
    cursor: pointer;
    pointer-events: auto;
    -webkit-tap-highlight-color: transparent;
    outline: none;
}

.next-btn__ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(130, 195, 255, 0.95);
    box-shadow:
        0 0 14px rgba(102, 179, 255, 0.65),
        inset 0 0 10px rgba(102, 179, 255, 0.3);
    animation: next-ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
    pointer-events: none;
}

.next-btn__ring--slow {
    animation-delay: 1s;
}

@keyframes next-ping {
    0% {
        transform: scale(0.62);
        opacity: 0.95;
    }

    70% {
        transform: scale(1.38);
        opacity: 0;
    }

    100% {
        transform: scale(1.38);
        opacity: 0;
    }
}

.next-btn__core {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 38px;
    height: 38px;
    border-radius: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle,
            rgba(175, 220, 255, 0.98) 0%,
            rgba(90, 165, 235, 0.65) 55%,
            transparent 78%);
    box-shadow: 0 0 16px rgba(120, 195, 255, 0.75);
    transition: box-shadow 0.2s ease;
    pointer-events: none;
}

.next-btn__dot {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: rgba(235, 247, 255, 0.95);
    box-shadow:
        0 0 10px rgba(120, 195, 255, 0.9),
        0 0 20px rgba(120, 195, 255, 0.45);
    transform: translate(-50%, -50%);
    pointer-events: none;
    transition: box-shadow 0.2s ease;
}

.next-btn:hover .next-btn__core,
.next-btn:focus-visible .next-btn__core {
    box-shadow: 0 0 26px rgba(150, 210, 255, 0.98);
}

.next-btn:hover .next-btn__ring,
.next-btn:focus-visible .next-btn__ring {
    border-color: rgba(190, 230, 255, 1);
}

.next-btn:focus-visible {
    outline: 2px solid rgba(170, 215, 255, 0.95);
    outline-offset: 6px;
}

/* ===== 随机水波 ===== */
.drop-ring {
    position: absolute;
    border-radius: 50%;
    border-style: solid;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0.3);
    opacity: 0;
    animation-name: drop-expand;
    animation-timing-function: ease-out;
    animation-fill-mode: forwards;
    will-change: transform, opacity;
}

@keyframes drop-expand {
    0% {
        transform: translate(-50%, -50%) scale(0.3);
        opacity: 0;
        border-color: rgba(102, 179, 255, 0);
        border-width: 3px;
    }

    12% {
        opacity: 0.85;
        border-color: rgba(120, 190, 255, 0.9);
        border-width: 2.5px;
    }

    45% {
        opacity: 0.4;
        border-color: rgba(102, 179, 255, 0.5);
        border-width: 1.5px;
    }

    100% {
        transform: translate(-50%, -50%) scale(1.8);
        opacity: 0;
        border-color: rgba(102, 179, 255, 0);
        border-width: 0.5px;
    }
}

/* ===== 常驻涟漪 ===== */
.ripple-layer {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;
    overflow: hidden;
    transition: opacity 0.3s ease;
}

.ripple-root {
    position: absolute;
    width: 0;
    height: 0;
}

.ripple-origin {
    position: absolute;
    top: 0;
    left: 0;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: radial-gradient(circle,
            rgba(120, 120, 120, 0.6) 0%,
            rgba(80, 150, 220, 0.5) 30%,
            rgba(60, 110, 180, 0.3) 60%,
            transparent 80%);
    filter: blur(1px) brightness(0.9);
    box-shadow:
        0 0 20px 10px rgba(80, 150, 220, 0.3),
        0 0 40px 20px rgba(60, 110, 180, 0.15);
    transform: translate(-50%, -50%);
    animation: origin-pulse 3s ease-out infinite;
}

.ripple-wave {
    position: absolute;
    top: 0;
    left: 0;
    border-radius: 50%;
    opacity: 0;
    pointer-events: none;
    border-style: solid;
    transform: translate(-50%, -50%) scale(0.1);
}

@keyframes ripple-expand {
    0% {
        transform: translate(-50%, -50%) scale(0.1);
        opacity: 0.7;
        border-color: rgba(102, 179, 255, 0.8);
        border-width: 4px;
    }

    20% {
        opacity: 0.6;
        border-color: rgba(66, 133, 244, 0.7);
        border-width: 3px;
    }

    50% {
        opacity: 0.3;
        border-color: rgba(42, 159, 214, 0.5);
        border-width: 2px;
    }

    80% {
        opacity: 0.1;
        border-color: rgba(42, 159, 214, 0.2);
        border-width: 1px;
    }

    100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0;
        border-color: rgba(42, 159, 214, 0);
        border-width: 0.5px;
    }
}

.wave-a {
    width: 150vmax;
    height: 150vmax;
    border: 4px solid rgba(102, 179, 255, 0.7);
    animation: ripple-expand 12s linear infinite;
}

.wave-b {
    width: 160vmax;
    height: 160vmax;
    border: 4px solid rgba(66, 133, 244, 0.6);
    animation: ripple-expand 12s linear infinite 2s;
}

.wave-c {
    width: 170vmax;
    height: 170vmax;
    border: 4px solid rgba(42, 159, 214, 0.5);
    animation: ripple-expand 12s linear infinite 4s;
}

.wave-d {
    width: 180vmax;
    height: 180vmax;
    border: 4px solid rgba(66, 133, 244, 0.4);
    animation: ripple-expand 12s linear infinite 6s;
}

.wave-e {
    width: 190vmax;
    height: 190vmax;
    border: 4px solid rgba(42, 159, 214, 0.3);
    animation: ripple-expand 12s linear infinite 8s;
}

.wave-f {
    width: 200vmax;
    height: 200vmax;
    border: 4px solid rgba(66, 133, 244, 0.2);
    animation: ripple-expand 12s linear infinite 10s;
}

@keyframes origin-pulse {

    0%,
    100% {
        transform: translate(-50%, -50%) scale(1);
        opacity: 0.8;
    }

    50% {
        transform: translate(-50%, -50%) scale(1.1);
        opacity: 1;
        filter: blur(2px) brightness(1.3);
    }
}

/* ===== 点击涟漪 ===== */
.click-layer {
    position: absolute;
    inset: 0;
    z-index: 6;
    pointer-events: none;
}

.click-ring {
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border-style: solid;
    pointer-events: none;
    transform: translate(-50%, -50%) scale(0.4);
    opacity: 0;
    animation: click-ripple-expand 1.5s ease-out forwards;
    will-change: transform, opacity;
}

@keyframes click-ripple-expand {
    0% {
        transform: translate(-50%, -50%) scale(0.4);
        opacity: 0;
        border-color: rgba(102, 179, 255, 0);
        border-width: 2px;
    }

    20% {
        opacity: 0.7;
        border-color: rgba(102, 179, 255, 0.8);
        border-width: 1.5px;
    }

    50% {
        opacity: 0.3;
        border-color: rgba(102, 179, 255, 0.5);
        border-width: 1px;
    }

    80% {
        opacity: 0.1;
        border-color: rgba(102, 179, 255, 0.2);
        border-width: 0.5px;
    }

    100% {
        transform: translate(-50%, -50%) scale(2);
        opacity: 0;
        border-color: rgba(102, 179, 255, 0);
        border-width: 0.25px;
    }
}

/* ===== 全屏磨砂模态框 ===== */
.modal {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(8, 22, 45, 0.6);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
}

.modal__panel {
    position: relative;
    width: 100%;
    max-width: 640px;
    padding: 32px 28px 28px;
    border-radius: 20px;
    background: rgba(22, 48, 88, 0.55);
    border: 1px solid rgba(102, 179, 255, 0.35);
    box-shadow:
        0 20px 60px rgba(0, 0, 0, 0.5),
        0 0 30px rgba(102, 179, 255, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
    text-align: center;
}

.modal__close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: rgba(102, 179, 255, 0.12);
    color: rgba(200, 225, 255, 0.9);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease, color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

.modal__close:hover,
.modal__close:focus-visible {
    background: rgba(102, 179, 255, 0.25);
    color: #fff;
    outline: none;
}

.modal__title {
    margin: 4px 0 6px;
    font-size: 22px;
    font-weight: 600;
    color: rgba(235, 247, 255, 0.98);
    letter-spacing: 0.5px;
}

.modal__subtitle {
    margin: 0 0 24px;
    font-size: 14px;
    color: rgba(175, 215, 250, 0.78);
}

/* 移动端：上下排列 */
.modal__actions {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

/* 两个入口完全同一套视觉 */
.modal-card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 18px 20px;
    border-radius: 14px;
    border: 1px solid rgba(102, 179, 255, 0.4);
    background: rgba(35, 78, 140, 0.45);
    color: rgba(235, 247, 255, 0.98);
    text-align: left;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
        border-color 0.2s ease,
        background 0.2s ease,
        box-shadow 0.2s ease;
    outline: none;
}

.modal-card:hover,
.modal-card:focus-visible {
    border-color: rgba(130, 195, 255, 0.85);
    background: rgba(50, 100, 175, 0.55);
    box-shadow: 0 8px 24px rgba(102, 179, 255, 0.22);
}

.modal-card__title {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: 0.5px;
}

.modal-card__desc {
    font-size: 13px;
    color: rgba(175, 215, 250, 0.75);
}

/* 桌面端：左右排列 */
@media (min-width: 641px) {
    .modal__actions {
        flex-direction: row;
        gap: 16px;
    }

    .modal-card {
        flex: 1;
        min-width: 0;
        padding: 22px 22px;
    }
}

/* 入场/退场：淡入 + 轻微缩放 */
.modal-fade-enter-active,
.modal-fade-leave-active {
    transition: opacity 0.25s ease;
}

.modal-fade-enter-active .modal__panel,
.modal-fade-leave-active .modal__panel {
    transition:
        transform 0.3s ease,
        opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
    opacity: 0;
}

.modal-fade-enter-from .modal__panel,
.modal-fade-leave-to .modal__panel {
    opacity: 0;
    transform: scale(0.97);
}

/* 移动端适配 */
@media (max-width: 480px) {
    .modal {
        padding: 16px;
    }

    .modal__panel {
        padding: 28px 20px 22px;
        border-radius: 18px;
    }

    .modal__title {
        font-size: 20px;
    }
}
</style>