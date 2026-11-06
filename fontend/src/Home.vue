<template>
    <div ref="stageRef" class="stage" @click="onClick">
        <div ref="scrollerRef" class="scroller" @scroll.passive="onScroll">
            <div class="content" :style="{ height: contentH + 'px' }">
                <img ref="imgRef" class="content__img" src="/design.jpg" :style="imgStyle" alt="" draggable="false"
                    @load="measure" />

                <!-- 随机水波（锚定图片坐标，随图片滚动） -->
                <div v-for="d in drops" :key="d.id" class="drop-ring" :style="dropStyle(d)"
                    @animationend="removeDrop(d.id)" />
            </div>
        </div>

        <!-- 常驻涟漪：原点锚在图片 80% 宽 × 80% 高 -->
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

        <!-- 下一步按钮：挂在原点 -->
        <button v-show="renderH" class="next-btn" type="button" aria-label="下一步" :style="originStyle" @click="goNext">
            <span class="next-btn__ring" />
            <span class="next-btn__ring next-btn__ring--slow" />
            <span class="next-btn__core" />
            <span class="next-btn__dot" />
        </button>

        <!-- 点击涟漪 -->
        <div class="click-layer" aria-hidden="true">
            <div v-for="r in rings" :key="r.id" class="click-ring" :style="ringStyle(r)"
                @animationend="removeRing(r.id)" />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/* ===== 可调参数 ===== */
const lineRatio = 0.9     // 90% 高度分位线
const ORIGIN_X = 0.8      // 水波原点：图片宽度的 80%
const ORIGIN_Y = 0.8      // 水波原点：图片高度的 80%
const heightRatio = 1     // 图片渲染高度 = 屏幕高 × heightRatio（>1 会更大、可滚动）

/* ===== 状态 ===== */
const stageRef = ref(null)
const scrollerRef = ref(null)
const imgRef = ref(null)

const stageW = ref(0)
const stageH = ref(0)
const natW = ref(0)
const natH = ref(0)
const scrollTop = ref(0)

const ratio = Math.min(Math.max(lineRatio, 0), 1)

/** 图片渲染高度（按高度铺满；竖图回退按宽度铺满，避免留白） */
const renderH = computed(() => {
    if (!natW.value || !natH.value || !stageH.value || !stageW.value) return 0
    const aspect = natW.value / natH.value

    // 目标：高度 = 屏幕高 × heightRatio
    let h = stageH.value * heightRatio
    let w = h * aspect

    // 如果按高度铺满后宽度还不够屏幕宽（竖图），改为按宽度铺满
    if (w < stageW.value) {
        w = stageW.value
        h = w / aspect
    }
    return h
})

/** 图片渲染宽度 */
const renderW = computed(() => {
    if (!renderH.value || !natW.value || !natH.value) return 0
    return renderH.value * (natW.value / natH.value)
})

/**
 * 水平偏移：让图片 80% 宽处尽量对齐屏幕中心，同时保证左右不留空白
 * - 宽图：理想值 = stageW/2 - 0.8·renderW，夹在 [stageW - renderW, 0] 之间
 * - 竖图（renderW ≤ stageW）：居中显示
 */
const tx = computed(() => {
    const rw = renderW.value
    const sw = stageW.value
    if (!rw || !sw) return 0

    if (rw <= sw) return (sw - rw) / 2

    const ideal = sw / 2 - ORIGIN_X * rw
    const minTx = sw - rw // 右边缘贴屏幕右
    const maxTx = 0       // 左边缘贴屏幕左
    return Math.min(maxTx, Math.max(minTx, ideal))
})

/** 垂直偏移：分界线不落底；超出则上移裁掉顶部 */
const offsetY = computed(() => {
    const h = renderH.value
    const H = stageH.value
    if (!h || !H) return 0
    const lineY = h * ratio
    return lineY > H ? H - lineY : 0
})

/** 内容区高度 = 图片底边位置（未裁切 = renderH；裁切 = renderH + offsetY） */
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

/** 水波原点在舞台坐标系中的位置 */
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

/* ===== 下一步 ===== */
function goNext() {
    window.location.href = '/'
}

/* ===== 点击涟漪 ===== */
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

/* ===== 随机水波 ===== */
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
        // 图片坐标 → 内容坐标（含水平偏移 tx）
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
    scheduleDrop()
})

onBeforeUnmount(() => {
    ro && ro.disconnect()
    clearTimeout(dropTimer)
    window.removeEventListener('orientationchange', measure)
    document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.stage {
    position: relative;
    width: 100%;
    height: 100vh;
    height: 100dvh;
    /* 移动端地址栏收缩自适应 */
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
    /* 左右裁切、顶部裁切都在这里完成 */
}

.content__img {
    position: absolute;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
    max-width: none;
    /* 防止被全局样式限制宽度 */
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
    transition: transform 0.2s ease, box-shadow 0.2s ease;
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
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.next-btn:hover .next-btn__core,
.next-btn:focus-visible .next-btn__core {
    transform: translate(-50%, -50%) scale(1.16);
    box-shadow: 0 0 26px rgba(150, 210, 255, 0.98);
}

.next-btn:hover .next-btn__dot,
.next-btn:focus-visible .next-btn__dot {
    transform: translate(-50%, -50%) scale(1.2);
}

.next-btn:active .next-btn__core {
    transform: translate(-50%, -50%) scale(0.92);
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
</style>