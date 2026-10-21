<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChatContainer } from 'zen-ai-chat-ui'
import 'zen-ai-chat-ui/style.css'
import '@inteye/llm-hub-ui/element'
import '@inteye/llm-hub-ui/style.css'

import './styles/theme.css'

import AppHeader from './components/AppHeader.vue'
import ConversationSidebar from './components/ConversationSidebar.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'

import { useTheme } from './composables/useTheme'
import { useNotice } from './composables/useNotice'
import { useConversations } from './composables/useConversations'
import { useChatStream } from './composables/useChatStream'

const SELECTION_KEY = 'chat-selection'

const { themeLabel, resolvedTheme, cycleTheme, init: initTheme, destroy: destroyTheme } = useTheme()
const { notice, showNotice, cleanup: cleanupNotice } = useNotice()

const showSettings = ref(false)
const currentProvider = ref('')
const currentModel = ref('')
const settingsRef = ref(null)

  ; (() => {
    try {
      const raw = localStorage.getItem(SELECTION_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        currentProvider.value = saved.provider || ''
        currentModel.value = saved.model || ''
      }
    } catch { }
  })()

function onLLMHubSelect(event) {
  const detail = event.detail
  currentProvider.value = detail.provider
  currentModel.value = detail.model
  try {
    localStorage.setItem(
      SELECTION_KEY,
      JSON.stringify({ provider: detail.provider, model: detail.model })
    )
  } catch (e) {
    console.warn('[selection] 保存失败', e)
  }
}

let chatStream
const conv = useConversations({
  showNotice,
  onConversationSwitch: () => chatStream?.streaming?.reset?.(),
})
chatStream = useChatStream(conv.messages)

const {
  conversations, activeConversationId, activeConversation, messages,
  selectMode, selectedIds,
  createConversation, switchConversation, closeConversation,
  enterSelectMode, cancelSelectMode, toggleSelect, toggleSelectAll,
  exportAllConversations, exportSelected, handleImport,
  persist, loadConversations,
} = conv

const presetQuestions = [
  { id: 'q1', label: '最近有点累，想聊聊', prompt: '我最近有点累，想找个人聊聊，你可以陪我说说话吗？' },
  { id: 'q2', label: '带我做一次呼吸放松', prompt: '带我做一次呼吸放松练习吧。' },
  { id: 'q3', label: '我今晚睡不着', prompt: '我今晚睡不着，脑子里很乱，能陪我说说话吗？' },
  { id: 'q4', label: '我需要解压', prompt: '很焦虑，怎么办，快告诉我' },
]

function onPresetSelect(q) {
  onSend({ text: q.prompt })
}

async function onSend({ text }) {
  if (!text.trim()) return

  if (!currentProvider.value) {
    showNotice('请先在右上角设置中选择模型')
    showSettings.value = true
    return
  }

  if (!activeConversationId.value) createConversation()

  const current = activeConversation.value
  if (!current) return

  await chatStream.send({
    text,
    provider: currentProvider.value,
    model: currentModel.value,
    client: settingsRef.value?.getClient(),
    onAfter: () => {
      current.updatedAt = Date.now()
      persist()
    },
  })
}

onMounted(() => {
  document.addEventListener('llm-hub-select', onLLMHubSelect)
  initTheme()
  const restored = loadConversations()
  if (!restored) createConversation()
})

onUnmounted(() => {
  document.removeEventListener('llm-hub-select', onLLMHubSelect)
  destroyTheme()
  cleanupNotice()
})
</script>

<template>
  <div class="page" :data-theme="resolvedTheme">
    <AppHeader :theme-label="themeLabel" :show-settings="showSettings" @cycle-theme="cycleTheme"
      @toggle-settings="showSettings = !showSettings" />

    <transition name="fade">
      <div v-if="notice" class="notice">{{ notice }}</div>
    </transition>

    <div class="body">
      <ConversationSidebar :conversations="conversations" :active-conversation-id="activeConversationId"
        :select-mode="selectMode" :selected-ids="selectedIds" @switch="switchConversation" @close="closeConversation"
        @create="createConversation" @export-all="exportAllConversations" @enter-select="enterSelectMode"
        @import="handleImport" @toggle-select="toggleSelect" @toggle-select-all="toggleSelectAll"
        @export-selected="exportSelected" @cancel-select="cancelSelectMode" />

      <main class="chat-area">
        <div v-if="!currentProvider" class="hint">
          <span>先选一个模型，再开始对话</span>
          <button class="hint-btn" @click="showSettings = true">去设置</button>
        </div>

        <div class="chat-card">
          <ChatContainer :messages="messages" :preset-questions="presetQuestions" :theme="resolvedTheme"
            welcome-logo="/favicon.ico" assistantName="助手" welcome-title="你好，有什么可以帮你？"
            welcome-description="试着问我任何问题，或选择下方的话题开始对话。" assistantAvatar="/favicon.ico" @send="onSend"
            @select="onPresetSelect" />
        </div>
      </main>
    </div>

    <SettingsDrawer ref="settingsRef" :show-settings="showSettings" :current-provider="currentProvider"
      :current-model="currentModel" @close="showSettings = false" />
  </div>
</template>

<style scoped>
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

.body {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
}

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

:deep(.acu-welcome-logo) {
  display: none;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -0.375rem);
}

@media (max-width: 48rem) {
  .body {
    flex-direction: column;
  }

  .chat-area {
    padding: 0.25rem clamp(0.5rem, 3vw, 0.75rem) clamp(0.5rem, 1.6vh, 0.75rem);
  }

  .chat-card {
    border-radius: 1.125rem;
  }
}

@media (prefers-reduced-motion: reduce) {

  .chat-card,
  .page {
    transition: none;
  }
}
</style>