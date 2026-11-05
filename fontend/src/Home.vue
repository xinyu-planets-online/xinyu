<template>
    <div ref="stageRef" class="stage">
        <div class="scroller">
            <div class="content" :style="{ height: contentH + 'px' }">
                <img ref="imgRef" class="content__img" src="/design.jpg" :style="{ top: offsetY + 'px' }" alt=""
                    draggable="false" @load="measure" />
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

/* ===== 可调参数 ===== */
const lineRatio = 0.9 // 分界线：图片高度的 90%

/* ===== 尺寸状态（只依赖实际渲染尺寸） ===== */
const stageRef = ref(null)
const imgRef = ref(null)

const stageH = ref(0)   // 容器高
const renderH = ref(0)  // 图片实际渲染高（offsetHeight）

const ratio = Math.min(Math.max(lineRatio, 0), 1)

/**
 * 图片相对内容区顶部的位移，<= 0
 * 只有分界线会溢出底部时才上移（裁掉顶部），否则 0（顶部完整可见）
 */
const offsetY = computed(() => {
    const h = renderH.value
    const H = stageH.value
    if (!h || !H) return 0
    const lineY = h * ratio
    return lineY > H ? H - lineY : 0
})

/**
 * 内容区高度 = 图片底边在内容区中的位置
 * - 未裁切：= renderH
 * - 裁切：  = renderH + offsetY（顶部被 overflow:hidden 永久裁掉）
 */
const contentH = computed(() => {
    const h = renderH.value
    const H = stageH.value
    if (!h || !H) return H
    return h + offsetY.value
})

function measure() {
    if (stageRef.value) stageH.value = stageRef.value.clientHeight
    if (imgRef.value) renderH.value = imgRef.value.offsetHeight
}

let ro = null
onMounted(() => {
    measure()
    ro = new ResizeObserver(measure)
    if (stageRef.value) ro.observe(stageRef.value)
    window.addEventListener('orientationchange', measure)
})

onBeforeUnmount(() => {
    ro && ro.disconnect()
    window.removeEventListener('orientationchange', measure)
})
</script>

<style scoped>
.stage {
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

    /* 隐藏滚动条：Firefox */
    scrollbar-width: none;
    /* 隐藏滚动条：IE / 旧 Edge */
    -ms-overflow-style: none;
}

/* 隐藏滚动条：WebKit（Chrome / Safari / 新 Edge / 移动端） */
.scroller::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
}

.content {
    position: relative;
    width: 100%;
    overflow: hidden;
    /* 裁掉被上移的图片顶部，滚动也看不到 */
}

.content__img {
    position: absolute;
    left: 0;
    width: 100%;
    height: auto;
    /* 按图片自身比例自然布局，不假设宽高比 */
    display: block;
    user-select: none;
    -webkit-user-drag: none;
}
</style>