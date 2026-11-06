<template>
    <div ref="stageRef" class="stage" @click="onClick">
        <div ref="scrollerRef" class="scroller" @scroll.passive="onScroll">
            <div class="content" :style="{ height: contentH + 'px' }">
                <img ref="imgRef" class="content__img" src="/design.jpg" :style="{ top: offsetY + 'px' }" alt=""
                    draggable="false" @load="measure" />

                <!-- 随机水波（放 content 内，锚定图片坐标，随图片滚动） -->
                <div v-for="d in drops" :key="d.id" class="drop-ring" :style="dropStyle(d)"
                    @animationend="removeDrop(d.id)" />
            </div>
        </div>

        <!-- 常驻涟漪：原点锚在图片 80% × 80% -->
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

        <!-- 下一步按钮：挂在「最大圆心」= 原点位置 -->
        <button v-show="renderH" class="next-btn" type="button" aria-label="下一步" :style="originStyle" @click="goNext">
            <span class="next-btn__ring" />
            <span class="next-btn__ring next-btn__ring--slow" />
            <span class="next-btn__core" />
            <span class="next-btn__dot" />
        </button>

        <!-- 点击涟漪：3 个环依次出现 -->
        <div class="click-layer" aria-hidden="true">
            <div v-for="r in rings" :key="r.id" class="click-ring" :style="ringStyle(r)"
                @animationend="removeRing(r.id)" />
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/* ===== 可调参数 ===== */
const lineRatio = 0.9
const ORIGIN_X = 0.8
const ORIGIN_Y = 0.8

/* ===== 尺寸状态 ===== */
const stageRef = ref(null)
const scrollerRef = ref(null)
const imgRef = ref(null)

const stageH = ref(0)
const renderH = ref(0)
const scrollTop = ref(0)

const ratio = Math.min(Math.max(lineRatio, 0), 1)

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

/** 原点位置（按钮与常驻涟漪共用） */
const originStyle = computed(() => ({
    left: `${ORIGIN_X * 100}%`,
    top: `${offsetY.value + renderH.value * ORIGIN_Y - scrollTop.value}px`
}))

function onScroll() {
    if (scrollerRef.value) scrollTop.value = scrollerRef.value.scrollTop
}

function measure() {
    if (stageRef.value) stageH.value = stageRef.value.clientHeight
    if (imgRef.value) renderH.value = imgRef.value.offsetHeight
    onScroll()
}

/* ===== 下一步按钮 ===== */
function goNext() {
    // 跳转首页（SPA 若用 vue-router，可改为 router.push('/')）
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
    const h = renderH.value
    if (!h) return

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
        left: `${d.x * 100}%`,
        top: `${offsetY.value + renderH.value * d.y}px`,
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
    overflow: hidden;
    background: #000;
}

.scroller {
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
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
    left: 0;
    width: 100%;
    height: auto;
    display: block;
    user-select: none;
    -webkit-user-drag: none;
}

/* ===== 下一步按钮（挂在最大圆心 = 原点） ===== */
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

/* 外圈提示环：持续向外脉冲，明确「这里可以点」 */
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

/* 中心能量核 */
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

/* 中心实心圆点 */
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

/* hover / 键盘聚焦 */
.next-btn:hover .next-btn__core,
.next-btn:focus-visible .next-btn__core {
    transform: translate(-50%, -50%) scale(1.16);
    box-shadow: 0 0 26px rgba(150, 210, 255, 0.98);
}

.next-btn:hover .next-btn__dot,
.next-btn:focus-visible .next-btn__dot {
    transform: translate(-50%, -50%) scale(1.2);
    box-shadow:
        0 0 14px rgba(190, 230, 255, 1),
        0 0 28px rgba(120, 195, 255, 0.7);
}

.next-btn:hover .next-btn__ring,
.next-btn:focus-visible .next-btn__ring {
    border-color: rgba(190, 230, 255, 1);
}

.next-btn:active .next-btn__core {
    transform: translate(-50%, -50%) scale(0.92);
}

.next-btn:active .next-btn__dot {
    transform: translate(-50%, -50%) scale(0.85);
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

/* ===== 常驻涟漪层 ===== */
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

/* ===== 点击涟漪层 ===== */
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