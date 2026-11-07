<template>
    <Transition name="energy-fade">
        <div v-if="visible" class="energy" @click.self="close">
            <div class="energy__panel" role="dialog" aria-modal="true" aria-labelledby="energy-title">
                <button class="energy__close" type="button" aria-label="关闭" @click="close">✕</button>

                <div class="energy__head">
                    <span id="energy-title" class="energy__badge">
                        <span class="energy__badge-dot" />
                        今日能量站
                    </span>
                    <span class="energy__date">{{ dateLabel }}</span>
                </div>

                <div class="energy__quote-wrap">
                    <Transition name="quote" mode="out-in">
                        <div :key="index" class="energy__quote">
                            <p class="energy__text">{{ quotes[index].text }}</p>
                            <p class="energy__from">— {{ quotes[index].from }}</p>
                        </div>
                    </Transition>
                </div>

                <div class="energy__actions">
                    <button class="energy__btn" type="button" @click="next">换一句</button>
                    <button class="energy__btn energy__btn--primary" type="button" @click="close">
                        收下这份能量
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
    visible: { type: Boolean, default: false }
})
const emit = defineEmits(['close'])

/* 每日能量句：文字尽量温柔、鼓励、不说教 */
const quotes = [
    { text: '你已经走了很远，允许自己慢一点。', from: '心屿' },
    { text: '情绪没有对错，它只是来提醒你。', from: '心屿' },
    { text: '今天的你，不需要完美，只需要存在。', from: '心屿' },
    { text: '疲惫不是失败，是身体在提醒你休息。', from: '心屿' },
    { text: '你比想象中更有韧性。', from: '心屿' },
    { text: '允许一切发生，也允许自己什么都不做。', from: '心屿' },
    { text: '此刻的呼吸，就是你和世界之间最温柔的联系。', from: '心屿' },
    { text: '不必追赶任何人，你有自己的节奏。', from: '心屿' },
    { text: '先把今天过好，明天自有明天的答案。', from: '心屿' },
    { text: '你已经做得足够好了，真的。', from: '心屿' },
    { text: '所有你以为过不去的，后来都成了曾经。', from: '心屿' },
    { text: '照顾好自己，不是奢侈，是必需。', from: '心屿' },
    { text: '难过的时候，不需要理由，也不需要被理解。', from: '心屿' },
    { text: '你不是不够好，你只是太久没被好好对待。', from: '心屿' },
    { text: '允许自己偶尔停摆，机器都需要散热。', from: '心屿' },
    { text: '不必把每件事都想通，有些答案要慢慢长出来。', from: '心屿' },
    { text: '你今天愿意打开这里，已经是在照顾自己了。', from: '心屿' },
    { text: '不是所有的情绪都需要解决，有些只需要被看见。', from: '心屿' },
    { text: '你可以不勇敢，可以只是想被人陪着。', from: '心屿' },
    { text: '你的感受是真实的，不需要向任何人证明。', from: '心屿' },
    { text: '别急着好起来，慢慢来也是向前。', from: '心屿' },
    { text: '累的时候，就承认累，不用硬撑成没事。', from: '心屿' },
    { text: '你已经很努力在生活了，这一点值得被承认。', from: '心屿' },
    { text: '此刻无论你是什么状态，都是被接纳的。', from: '心屿' },
    { text: '有些日子只需要撑过去，不需要过得多漂亮。', from: '心屿' },
    { text: '你可以一边难过，一边继续往前走。', from: '心屿' },
    { text: '不必和昨天的自己比较，你已经换了很多次呼吸。', from: '心屿' },
    { text: '如果今天很难，就把目标缩小到「再呼吸一次」。', from: '心屿' },
    { text: '你不需要变得更好才配被喜欢。', from: '心屿' },
    { text: '心里乱的时候，先照顾身体，它会带你回来。', from: '心屿' },
    { text: '你值得被温柔对待，包括被自己温柔对待。', from: '心屿' },
    { text: '有些伤口不结痂，是因为它还在学习怎么愈合。', from: '心屿' },
    { text: '你不是情绪化，你只是感受得比别人深一点。', from: '心屿' },
    { text: '今天允许自己少做一件事，天不会塌。', from: '心屿' },
    { text: '没有谁的生活是全程在线的，你也可以掉线一会儿。', from: '心屿' },
    { text: '你已经在用自己的方式，很认真地活着了。', from: '心屿' },
    { text: '难受就说出来，说不出口也没关系，我在这里。', from: '心屿' },
    { text: '你不是一个需要被修复的问题，你是一个正在经历的人。', from: '心屿' },
    { text: '不必感谢苦难，但可以感谢撑过来的自己。', from: '心屿' },
    { text: '慢下来的时候，你才开始听得见自己。', from: '心屿' },
    { text: '你可以有自己的阴暗面，那不影响你值得被爱。', from: '心屿' },
    { text: '有时不是你想太多，是你太想把它想明白。', from: '心屿' },
    { text: '今天能好好吃饭、好好睡觉，就已经是了不起的一天。', from: '心屿' },
    { text: '你不需要对所有人的期待负责，包括过去的自己。', from: '心屿' },
    { text: '情绪像天气，来了会走，你不是天气本身。', from: '心屿' },
    { text: '你可以怀念从前，也可以不急着原谅自己。', from: '心屿' },
    { text: '此刻你已经做得够多了，剩下的交给时间。', from: '心屿' },
    { text: '愿你今晚睡个好觉，明天的事明天再说。', from: '心屿' },
]

/* 用「一年中的第几天」作种子，保证每天固定一句 */
function dayOfYear() {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 0)
    return Math.floor((now - start) / 86400000)
}

const dateLabel = computed(() => {
    const d = new Date()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
    return `${m} 月 ${day} 日 · 周${week}`
})

const index = ref(dayOfYear() % quotes.length)

function next() {
    if (quotes.length <= 1) return
    let n = index.value
    while (n === index.value) n = Math.floor(Math.random() * quotes.length)
    index.value = n
}

function close() {
    emit('close')
}

function onKeydown(e) {
    if (e.key === 'Escape' && props.visible) close()
}

watch(
    () => props.visible,
    (v) => {
        document.body.style.overflow = v ? 'hidden' : ''
    }
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
})
</script>

<style scoped>
.energy {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: rgba(24, 18, 12, 0.6);
    -webkit-backdrop-filter: blur(20px) saturate(140%);
    backdrop-filter: blur(20px) saturate(140%);
}

.energy__panel {
    position: relative;
    width: 100%;
    max-width: 480px;
    padding: 32px 28px 26px;
    border-radius: 22px;
    /* 暖琥珀色，和蓝色系的功能入口形成区分 */
    background: linear-gradient(160deg,
            rgba(72, 48, 26, 0.72) 0%,
            rgba(48, 32, 18, 0.68) 100%);
    border: 1px solid rgba(240, 185, 115, 0.28);
    box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.55),
        0 0 40px rgba(240, 180, 100, 0.12),
        inset 0 1px 0 rgba(255, 230, 200, 0.08);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    text-align: center;
    color: rgba(255, 240, 220, 0.95);
}

.energy__close {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: rgba(240, 185, 115, 0.1);
    color: rgba(255, 230, 200, 0.8);
    font-size: 16px;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s ease, color 0.2s ease;
    -webkit-tap-highlight-color: transparent;
}

.energy__close:hover,
.energy__close:focus-visible {
    background: rgba(240, 185, 115, 0.22);
    color: #fff;
    outline: none;
}

.energy__head {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-bottom: 22px;
}

.energy__badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px 4px 10px;
    font-size: 12px;
    letter-spacing: 0.14em;
    color: rgba(255, 220, 175, 0.95);
    background: rgba(240, 185, 115, 0.12);
    border: 1px solid rgba(240, 185, 115, 0.28);
    border-radius: 999rem;
}

.energy__badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 205, 130, 0.95);
    box-shadow: 0 0 8px rgba(255, 205, 130, 0.9);
}

.energy__date {
    font-size: 12px;
    letter-spacing: 0.1em;
    color: rgba(235, 210, 180, 0.55);
}

.energy__quote-wrap {
    min-height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 4px 12px;
}

.energy__quote {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.energy__text {
    margin: 0;
    font-size: clamp(1.05rem, 1rem + 0.6vw, 1.25rem);
    line-height: 1.7;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: rgba(255, 244, 228, 0.98);
}

.energy__from {
    margin: 0;
    font-size: 12px;
    letter-spacing: 0.12em;
    color: rgba(235, 205, 170, 0.5);
}

.energy__actions {
    display: flex;
    flex-direction: column-reverse;
    gap: 10px;
    margin-top: 8px;
}

.energy__btn {
    height: 42px;
    padding: 0 18px;
    font-size: 14px;
    letter-spacing: 0.04em;
    color: rgba(255, 230, 200, 0.85);
    background: transparent;
    border: 1px solid rgba(240, 185, 115, 0.25);
    border-radius: 999rem;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.energy__btn:hover,
.energy__btn:focus-visible {
    background: rgba(240, 185, 115, 0.12);
    border-color: rgba(240, 185, 115, 0.5);
    color: #fff;
    outline: none;
}

.energy__btn--primary {
    color: rgba(60, 36, 16, 0.98);
    background: linear-gradient(135deg,
            rgba(255, 205, 130, 0.95) 0%,
            rgba(240, 175, 95, 0.95) 100%);
    border-color: transparent;
    font-weight: 600;
}

.energy__btn--primary:hover,
.energy__btn--primary:focus-visible {
    color: rgba(48, 28, 10, 1);
    background: linear-gradient(135deg,
            rgba(255, 215, 148, 1) 0%,
            rgba(245, 185, 108, 1) 100%);
    box-shadow: 0 6px 20px rgba(240, 180, 100, 0.35);
}

/* 引用淡入切换 */
.quote-enter-active,
.quote-leave-active {
    transition: opacity 0.25s ease, transform 0.25s ease;
}

.quote-enter-from {
    opacity: 0;
    transform: translateY(6px);
}

.quote-leave-to {
    opacity: 0;
    transform: translateY(-6px);
}

/* 弹层入场 */
.energy-fade-enter-active,
.energy-fade-leave-active {
    transition: opacity 0.25s ease;
}

.energy-fade-enter-active .energy__panel,
.energy-fade-leave-active .energy__panel {
    transition: transform 0.3s ease, opacity 0.25s ease;
}

.energy-fade-enter-from,
.energy-fade-leave-to {
    opacity: 0;
}

.energy-fade-enter-from .energy__panel,
.energy-fade-leave-to .energy__panel {
    opacity: 0;
    transform: scale(0.97);
}

@media (min-width: 641px) {
    .energy__actions {
        flex-direction: row;
        justify-content: center;
    }

    .energy__btn {
        flex: 1;
        max-width: 200px;
    }
}

@media (max-width: 480px) {
    .energy {
        padding: 16px;
    }

    .energy__panel {
        padding: 28px 20px 22px;
        border-radius: 18px;
    }
}

@media (prefers-reduced-motion: reduce) {

    .quote-enter-active,
    .quote-leave-active,
    .energy-fade-enter-active,
    .energy-fade-leave-active,
    .energy-fade-enter-active .energy__panel,
    .energy-fade-leave-active .energy__panel {
        transition: none;
    }
}
</style>