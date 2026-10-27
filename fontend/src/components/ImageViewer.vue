<script setup>
import { onMounted, onUnmounted } from 'vue'

const props = defineProps({
    visible: { type: Boolean, default: false },
    src: { type: String, default: '' },
    alt: { type: String, default: '图片' },
})

const emit = defineEmits(['close'])

function onKeydown(e) {
    if (e.key === 'Escape' && props.visible) {
        e.preventDefault()
        emit('close')
    }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
    <Teleport to="body">
        <transition name="image-viewer">
            <div v-if="visible && src" class="iv-mask" @click.self="$emit('close')">
                <button class="iv-close" aria-label="关闭" @click="$emit('close')">×</button>
                <img class="iv-image" :src="src" :alt="alt" @click.stop />
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
.iv-mask {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: grid;
    place-items: center;
    padding: 2rem;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(4px);
    cursor: zoom-out;
}

.iv-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 0.5rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    cursor: default;
}

.iv-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 2.5rem;
    height: 2.5rem;
    display: grid;
    place-items: center;
    font-size: 1.5rem;
    line-height: 1;
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    cursor: pointer;
    transition: background 0.15s ease;
}

.iv-close:hover {
    background: rgba(255, 255, 255, 0.2);
}

.iv-close:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
}

.image-viewer-enter-active,
.image-viewer-leave-active {
    transition: opacity 0.2s ease;
}

.image-viewer-enter-from,
.image-viewer-leave-to {
    opacity: 0;
}

@media (prefers-reduced-motion: reduce) {

    .image-viewer-enter-active,
    .image-viewer-leave-active {
        transition: none;
    }
}
</style>