<script setup>
import { ref, computed, onMounted, onUnmounted, watchEffect } from 'vue'
import { ChatContainer, useStreaming, uid } from 'zen-ai-chat-ui'
import 'zen-ai-chat-ui/style.css'

import '@inteye/llm-hub-ui/element'
import '@inteye/llm-hub-ui/style.css'

const messages = ref([])
const streaming = useStreaming()

const configEl = ref(null)

const appName = ref('')
const assistantName = ref('AI 助手')

const currentProvider = ref('')
const currentModel = ref('')

const themeMode = ref('auto')
const systemDark = ref(false)
let mql = null

const resolvedTheme = computed(() =>
  themeMode.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : themeMode.value
)
const themeLabel = computed(() =>
  themeMode.value === 'auto' ? '系统' : themeMode.value === 'dark' ? '深色' : '浅色'
)

function cycleTheme() {
  themeMode.value =
    themeMode.value === 'auto' ? 'light' : themeMode.value === 'light' ? 'dark' : 'auto'
}
function onSchemeChange(e) {
  systemDark.value = e.matches
}

const showSettings = ref(false)

const notice = ref('')
let noticeTimer = null
function showNotice(text) {
  notice.value = text
  clearTimeout(noticeTimer)
  noticeTimer = setTimeout(() => (notice.value = ''), 4200)
}

function onLLMHubSelect(event) {
  const detail = event.detail
  currentProvider.value = detail.provider
  currentModel.value = detail.model
}

onMounted(() => {
  document.addEventListener('llm-hub-select', onLLMHubSelect)

  mql = window.matchMedia('(prefers-color-scheme: dark)')
  systemDark.value = mql.matches
  mql.addEventListener('change', onSchemeChange)
})

onUnmounted(() => {
  document.removeEventListener('llm-hub-select', onLLMHubSelect)
  mql?.removeEventListener('change', onSchemeChange)
  clearTimeout(noticeTimer)
})

watchEffect(() => {
  const theme = resolvedTheme.value
  document.documentElement.setAttribute('data-theme', theme)
  document.body.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme
  document.body.style.colorScheme = theme
})

const presetQuestions = [
  { id: 'q1', label: '最近有点累，想聊聊', prompt: '我最近有点累，想找个人聊聊，你可以陪我说说话吗？' },
  { id: 'q2', label: '带我做一次呼吸放松', prompt: '带我做一次三分钟的呼吸放松练习吧。' },
  { id: 'q3', label: '我今晚睡不着', prompt: '我今晚睡不着，脑子里很乱，能陪我说说话吗？' },
]

async function onSend({ text }) {
  if (!text.trim()) return

  if (!currentProvider.value) {
    showNotice('请先在右上角设置中选择模型')
    showSettings.value = true
    return
  }

  messages.value.push({
    id: uid('u'),
    role: 'user',
    content: text,
    status: 'done',
  })

  const assistant = streaming.createAssistant()
  messages.value.push(assistant)

  const history = messages.value
    .filter(m => m.role !== 'assistant' || m.content !== '')
    .map(m => ({ role: m.role, content: m.content }))

  try {
    const client = configEl.value?.client
    if (!client) throw new Error('llm-hub-config 尚未就绪')

    const stream = client.chatStream({
      provider: currentProvider.value,
      model: currentModel.value,
      messages: history,
    })

    for await (const chunk of stream) {
      streaming.append(assistant, { type: 'content', delta: chunk.delta })
    }

    streaming.append(assistant, { type: 'done', delta: '' })
  } catch (err) {
    console.error('[chatStream] 失败:', err)
    streaming.append(assistant, {
      type: 'error',
      delta: err?.message || '请求失败',
    })
  }
}
</script>

<template>
  <div class="page" :data-theme="resolvedTheme">
    <header class="topbar">
      <div class="brand">
        <span class="brand-dot" />
        <span v-if="appName" class="brand-name">{{ appName }}</span>
      </div>

      <div class="actions">
        <button class="pill-btn" :title="`切换主题，当前：${themeLabel}`" @click="cycleTheme">
          主题：{{ themeLabel }}
        </button>
        <button class="pill-btn" :class="{ active: showSettings }" @click="showSettings = !showSettings">
          设置
        </button>
      </div>
    </header>

    <transition name="fade">
      <div v-if="notice" class="notice">{{ notice }}</div>
    </transition>

    <main class="chat-area">
      <div v-if="!currentProvider" class="hint">
        <span>先选一个模型，再开始对话</span>
        <button class="hint-btn" @click="showSettings = true">去设置</button>
      </div>

      <div class="chat-card">
        <ChatContainer :messages="messages" :preset-questions="presetQuestions" :theme="resolvedTheme"
          :assistant-name="assistantName" @send="onSend" />
      </div>
    </main>

    <div class="mask" :class="{ show: showSettings }" @click="showSettings = false" />

    <aside class="drawer" :class="{ show: showSettings }">
      <header class="drawer-header">
        <div class="drawer-heading">
          <h2 class="drawer-title">设置</h2>
          <p class="drawer-subtitle">配置模型与 API Key</p>
        </div>
        <button class="drawer-close" aria-label="关闭" @click="showSettings = false">
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
        <button class="btn-secondary" @click="showSettings = false">取消</button>
        <button class="btn-primary" @click="showSettings = false">完成</button>
      </footer>
    </aside>
  </div>
</template>

<style scoped>
:global(html),
:global(body) {
  margin: 0;
  padding: 0;
  height: 100%;
}

/* ============ 亮色令牌 + --llm-hub-* 映射（使用 light-dark） ============ */
:global(:root),
:global([data-theme='light']) {
  color-scheme: light;

  --surface-0: #f2e9dc;
  --surface-1: #f8f0e4;
  --surface-2: #f3e8d7;
  --surface-3: #ecdfcc;

  --text-1: #453b32;
  --text-2: #6b5d4d;
  --text-3: #a09078;

  --border-1: rgba(165, 107, 69, 0.14);
  --border-2: rgba(165, 107, 69, 0.2);
  --border-3: rgba(165, 107, 69, 0.34);

  --accent: #a56b45;
  --accent-hover: #8f5a38;
  --accent-soft: rgba(165, 107, 69, 0.1);
  --accent-soft-hover: rgba(165, 107, 69, 0.16);
  --accent-contrast: #fffaf3;

  --shadow-sm: 0 0.0625rem 0.125rem rgba(122, 92, 62, 0.06);
  --shadow-md: 0 0.25rem 1rem rgba(122, 92, 62, 0.1);
  --shadow-lg: 0 1.5rem 3.75rem -1.625rem rgba(122, 92, 62, 0.34);
  --drawer-shadow: -1.5rem 0 4rem -2rem rgba(122, 92, 62, 0.35);
  --mask: rgba(72, 56, 40, 0.24);

  /* --acu-* 映射 */
  --acu-bg: var(--surface-1);
  --acu-surface: var(--surface-2);
  --acu-surface-2: var(--surface-3);
  --acu-surface-hover: var(--surface-3);
  --acu-text: var(--text-1);
  --acu-text-secondary: var(--text-2);
  --acu-text-muted: var(--text-3);
  --acu-border: var(--border-2);
  --acu-border-strong: var(--border-3);
  --acu-primary: var(--accent);
  --acu-primary-hover: var(--accent-hover);
  --acu-primary-active: var(--accent-hover);
  --acu-primary-contrast: var(--accent-contrast);
  --acu-primary-soft: var(--accent-soft);
  --acu-primary-soft-hover: var(--accent-soft-hover);
  --acu-bubble-user-bg: var(--accent);
  --acu-bubble-user-text: var(--accent-contrast);
  --acu-bubble-assistant-bg: var(--surface-2);
  --acu-bubble-assistant-text: var(--text-1);
  --acu-thinking-bg: var(--surface-2);
  --acu-thinking-text: var(--text-2);
  --acu-thinking-border: var(--border-1);
  --acu-thinking-icon: var(--text-3);
  --acu-code-bg: var(--surface-2);
  --acu-code-text: var(--text-1);
  --acu-code-border: var(--border-2);
  --acu-code-inline-bg: var(--border-1);
  --acu-code-header-bg: var(--surface-3);
  --acu-error: #c0563f;
  --acu-error-soft: rgba(192, 86, 63, 0.1);
  --acu-success: #6b8f6b;
  --acu-warning: #c08a3e;
  --acu-shadow-sm: var(--shadow-sm);
  --acu-shadow: var(--shadow-md);
  --acu-shadow-lg: var(--shadow-lg);

  /* --llm-hub-* 映射：light-dark() 根据 color-scheme 自动选择 */
  --llm-hub-primary: light-dark(var(--accent), #8fa8c8);
  --llm-hub-primary-hover: light-dark(var(--accent-hover), #a3bad6);
  --llm-hub-accent: light-dark(var(--accent), #8fa8c8);
  --llm-hub-accent-hover: light-dark(var(--accent-hover), #a3bad6);

  --llm-hub-bg: light-dark(var(--surface-1), #15181d);
  --llm-hub-bg-secondary: light-dark(var(--surface-2), #1b1f25);
  --llm-hub-bg-elevated: light-dark(var(--surface-3), #1d2229);

  --llm-hub-border: light-dark(var(--border-2), rgba(255, 255, 255, 0.09));
  --llm-hub-border-strong: light-dark(var(--border-3), rgba(255, 255, 255, 0.18));
  --llm-hub-text: light-dark(var(--text-1), #e6e9ee);
  --llm-hub-text-secondary: light-dark(var(--text-2), #a8b0bc);
  --llm-hub-text-muted: light-dark(var(--text-3), #727a86);
  --llm-hub-radius: 0.625rem;
}

/* ============ 深色令牌 ============ */
:global([data-theme='dark']) {
  color-scheme: dark;

  --surface-0: #0d1014;
  --surface-1: #15181d;
  --surface-2: #1b1f25;
  --surface-3: #232830;

  --text-1: #e6e9ee;
  --text-2: #a8b0bc;
  --text-3: #727a86;

  --border-1: rgba(255, 255, 255, 0.06);
  --border-2: rgba(255, 255, 255, 0.09);
  --border-3: rgba(255, 255, 255, 0.18);

  --accent: #8fa8c8;
  --accent-hover: #a3bad6;
  --accent-soft: rgba(143, 168, 200, 0.14);
  --accent-soft-hover: rgba(143, 168, 200, 0.2);
  --accent-contrast: #12151a;

  --shadow-sm: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.35);
  --shadow-md: 0 0.25rem 1rem rgba(0, 0, 0, 0.45);
  --shadow-lg: 0 1.5rem 3.75rem -1.75rem rgba(0, 0, 0, 0.8);
  --drawer-shadow: -1.5rem 0 4rem -2rem rgba(0, 0, 0, 0.7);
  --mask: rgba(0, 0, 0, 0.55);

  --acu-bg: var(--surface-1);
  --acu-surface: var(--surface-2);
  --acu-surface-2: var(--surface-3);
  --acu-surface-hover: var(--surface-3);
  --acu-text: var(--text-1);
  --acu-text-secondary: var(--text-2);
  --acu-text-muted: var(--text-3);
  --acu-border: var(--border-2);
  --acu-border-strong: var(--border-3);
  --acu-primary: var(--accent);
  --acu-primary-hover: var(--accent-hover);
  --acu-primary-active: var(--accent-hover);
  --acu-primary-contrast: var(--accent-contrast);
  --acu-primary-soft: var(--accent-soft);
  --acu-primary-soft-hover: var(--accent-soft-hover);
  --acu-bubble-user-bg: var(--accent);
  --acu-bubble-user-text: var(--accent-contrast);
  --acu-bubble-assistant-bg: var(--surface-2);
  --acu-bubble-assistant-text: var(--text-1);
  --acu-thinking-bg: var(--surface-2);
  --acu-thinking-text: var(--text-2);
  --acu-thinking-border: var(--border-1);
  --acu-thinking-icon: var(--text-3);
  --acu-code-bg: var(--surface-2);
  --acu-code-text: var(--text-1);
  --acu-code-border: var(--border-2);
  --acu-code-inline-bg: var(--border-1);
  --acu-code-header-bg: var(--surface-3);
  --acu-error: #e07a7a;
  --acu-error-soft: rgba(224, 122, 122, 0.14);
  --acu-success: #7fbf9f;
  --acu-warning: #d4b06a;
  --acu-shadow-sm: var(--shadow-sm);
  --acu-shadow: var(--shadow-md);
  --acu-shadow-lg: var(--shadow-lg);
}

/* ============ 页面 ============ */
.page {
  --glow-a: rgba(255, 206, 166, 0.78);
  --glow-b: rgba(255, 198, 186, 0.66);
  --glow-c: rgba(198, 226, 206, 0.58);

  box-sizing: border-box;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  color: var(--acu-text);
  font-size: clamp(0.8125rem, 0.75rem + 0.25vw, 0.9375rem);
  line-height: 1.5;
  letter-spacing: 0.012em;

  background:
    radial-gradient(70vw 34vh at 8% -8%, var(--glow-a) 0%, transparent 62%),
    radial-gradient(62vw 30vh at 104% 4%, var(--glow-b) 0%, transparent 58%),
    radial-gradient(68vw 40vh at 50% 118%, var(--glow-c) 0%, transparent 60%),
    var(--acu-bg);

  transition: background-color 0.6s ease, color 0.4s ease;
}

.page[data-theme='dark'] {
  --glow-a: rgba(48, 64, 88, 0.5);
  --glow-b: rgba(40, 52, 70, 0.45);
  --glow-c: rgba(36, 46, 60, 0.4);
}

/* ============ 顶栏 ============ */
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

/* ============ 提示 ============ */
.notice {
  position: fixed;
  top: clamp(3.25rem, 8vh, 4.25rem);
  left: 50%;
  transform: translateX(-50%);
  z-index: 60;
  padding: clamp(0.5rem, 1.2vh, 0.625rem) clamp(0.875rem, 1.6vw, 1.125rem);
  font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
  color: var(--acu-text);
  background: var(--acu-bg);
  border: 0.0625rem solid var(--acu-border);
  border-radius: 999rem;
  box-shadow: var(--acu-shadow);
  max-width: 90%;
}

.hint {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: clamp(0.375rem, 0.8vw, 0.625rem);
  padding: 0.375rem 0.5rem 0.375rem clamp(0.75rem, 1.4vw, 1rem);
  font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
  color: var(--acu-text-secondary);
  background: var(--acu-bg);
  border: 0.0625rem solid var(--acu-border);
  border-radius: 999rem;
  max-width: 90%;
}

.hint-btn {
  padding: 0.25rem 0.75rem;
  font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
  border: none;
  border-radius: 999rem;
  cursor: pointer;
}

/* ============ 聊天区 ============ */
.chat-area {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 0.25rem clamp(0.625rem, 1.6vw, 1.375rem) clamp(0.75rem, 1.8vh, 1.375rem);
  gap: clamp(0.5rem, 1vh, 0.75rem);
}

.chat-card {
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 0.0625rem solid var(--acu-border);
  border-radius: clamp(1rem, 1.6vw, 1.5rem);
  box-shadow: var(--acu-shadow-lg);
  overflow: hidden;
}

.chat-card>* {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
}

/* ============ 遮罩 ============ */
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

/* ============ 设置抽屉 ============ */
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

/* ============ 过渡与响应式 ============ */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -0.375rem);
}

@media (max-width: 64rem) {
  .drawer {
    width: 60vw;
  }
}

@media (max-width: 48rem) {
  .topbar {
    padding: clamp(0.5rem, 1.6vh, 0.75rem) clamp(0.625rem, 3vw, 1rem) 0.375rem;
  }

  .chat-area {
    padding: 0.25rem clamp(0.5rem, 3vw, 0.75rem) clamp(0.5rem, 1.6vh, 0.75rem);
  }

  .chat-card {
    border-radius: 1.125rem;
  }

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
  .brand-dot {
    animation: none;
  }

  .drawer,
  .mask,
  .chat-card,
  .page {
    transition: none;
  }
}
</style>