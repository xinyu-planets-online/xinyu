<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ChatContainer } from 'zen-ai-chat-ui'
import 'zen-ai-chat-ui/style.css'
import '@inteye/llm-hub-ui/element'
import '@inteye/llm-hub-ui/style.css'

import './styles/theme.css'

import AppHeader from './components/AppHeader.vue'
import ConversationSidebar from './components/ConversationSidebar.vue'
import SettingsDrawer from './components/SettingsDrawer.vue'
import ConversationTree from './components/ConversationTree.vue'
import EditMessageDialog from './components/EditMessageDialog.vue'

import { useTheme } from './composables/useTheme'
import { useNotice } from './composables/useNotice'
import { useConversations } from './composables/useConversations'
import { useChatStream } from './composables/useChatStream'
import { useUserSystemPrompt } from './composables/useSystemPrompts'
import { summarizeFile, unwrapFile } from './composables/useAttachmentSummary'

const SELECTION_KEY = 'chat-selection'
const MODELS_KEY = 'chat-models'

const {
  themeLabel, themeMode, resolvedTheme, cycleTheme,
  init: initTheme, destroy: destroyTheme,
} = useTheme()

const { notice, showNotice, cleanup: cleanupNotice } = useNotice()
const { userSystemPrompt } = useUserSystemPrompt()

const showSettings = ref(false)
const showTree = ref(false)
const currentProvider = ref('')
const currentModel = ref('')
const settingsRef = ref(null)

const models = ref([])

function genModelId() {
  return 'm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

; (() => {
  try {
    const raw = localStorage.getItem(MODELS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    models.value = Array.isArray(arr) ? arr : []
  } catch { }
})()

function persistModels() {
  try { localStorage.setItem(MODELS_KEY, JSON.stringify(models.value)) } catch { }
}

function addModel({ provider, model, label, displayName }) {
  if (!provider) return null
  const exists = models.value.find(m => m.provider === provider && m.model === model)
  if (exists) {
    if (displayName && !exists.label) { exists.label = displayName; persistModels() }
    return exists
  }
  const item = { id: genModelId(), provider, model, label: displayName || label || '' }
  models.value.push(item)
  persistModels()
  return item
}

function removeModel(id) {
  const idx = models.value.findIndex(m => m.id === id)
  if (idx < 0) return
  models.value.splice(idx, 1)
  persistModels()
  const cur = models.value.find(m => m.provider === currentProvider.value && m.model === currentModel.value)
  if (!cur) {
    const next = models.value[0]
    if (next) { currentProvider.value = next.provider; currentModel.value = next.model; persistSelection() }
    else { currentProvider.value = ''; currentModel.value = ''; persistSelection() }
  }
}

function persistSelection() {
  try {
    if (currentProvider.value) {
      localStorage.setItem(SELECTION_KEY, JSON.stringify({ provider: currentProvider.value, model: currentModel.value }))
    } else {
      localStorage.removeItem(SELECTION_KEY)
    }
  } catch { }
}

function switchModel({ provider, model }) {
  currentProvider.value = provider
  currentModel.value = model
  persistSelection()
}

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
  const d = event.detail
  currentProvider.value = d.provider
  currentModel.value = d.model
  addModel({ provider: d.provider, model: d.model, displayName: d.displayName || '' })
  persistSelection()
}

function onAddModel({ provider, model, label, displayName }) {
  addModel({ provider, model, label, displayName })
  if (!currentProvider.value) {
    currentProvider.value = provider
    currentModel.value = model
    persistSelection()
  }
}

let chatStream
const conv = useConversations({
  showNotice,
  onConversationSwitch: () => chatStream?.streaming?.reset?.(),
})
chatStream = useChatStream({ addNode: conv.addNode })

const {
  conversations, activeConversationId, activeConversation,
  messages, selectMode, selectedIds,
  createConversation, switchConversation, closeConversation,
  editUserMessage, revertToNode, switchToNode,
  enterSelectMode, cancelSelectMode, toggleSelect, toggleSelectAll,
  exportAllConversations, exportSelected, handleImport,
  loadConversations,
} = conv

const presetQuestions = [
  { id: 'q1', label: '最近有点累，想聊聊', prompt: '我最近有点累，想找个人聊聊，你可以陪我说说话吗？' },
  { id: 'q2', label: '带我做一次呼吸放松', prompt: '带我做一次呼吸放松练习吧。' },
  { id: 'q3', label: '我今晚睡不着', prompt: '我今晚睡不着，脑子里很乱，能陪我说说话吗？' },
  { id: 'q4', label: '我需要解压', prompt: '很焦虑，怎么办，快告诉我' },
]

function onPresetSelect(q) {
  onSend({ text: q.prompt, files: [] })
}

async function onSend({ text, files }) {
  const hasText = !!text?.trim()
  const hasFiles = Array.isArray(files) && files.length > 0
  if (!hasText && !hasFiles) return

  const client = settingsRef.value?.getClient()
  if (!client || !currentProvider.value) {
    showNotice('请先在设置中添加并选择一个模型')
    showSettings.value = true
    return
  }

  const providerName = currentProvider.value
  const modelName = currentModel.value

  // ===== 诊断：await 异步方法 + 同步方法 =====
  try {
    const cfg = await client.getEffectiveConfig(providerName)
    console.log(`[DIAG][SEND] getEffectiveConfig("${providerName}"):`, cfg)
  } catch (e) {
    console.error(`[DIAG][SEND] getEffectiveConfig threw:`, e)
  }

  try {
    const access = await client.getProviderAccess(providerName)
    console.log(`[DIAG][SEND] getProviderAccess("${providerName}"):`, access)
  } catch (e) {
    console.error(`[DIAG][SEND] getProviderAccess threw:`, e)
  }

  try {
    const reqCfg = client.getRequiredEffectiveConfig(providerName)
    console.log(`[DIAG][SEND] getRequiredEffectiveConfig("${providerName}"):`, reqCfg)
  } catch (e) {
    console.error(`[DIAG][SEND] getRequiredEffectiveConfig threw:`, e)
  }
  // ===== 诊断结束 =====

  if (!activeConversationId.value) await createConversation()
  const current = activeConversation.value
  if (!current) return

  const summaries = []
  if (hasFiles) {
    for (const f of files) {
      const raw = unwrapFile(f)
      if (!raw) continue
      try { summaries.push(await summarizeFile(raw)) } catch { }
    }
  }

  await chatStream.send({
    text: text || '',
    files: summaries,
    provider: providerName,
    model: modelName,
    client,
    conversation: current,
    userSystemPrompt: userSystemPrompt.value,
  })
}

async function onSwitchNode(nodeId) { await switchToNode(nodeId) }
async function onRevert(nodeId) { await revertToNode(nodeId) }

async function onEditMessage({ nodeId, content }) {
  const current = activeConversation.value
  if (!current) return
  const client = settingsRef.value?.getClient()
  if (!client || !currentProvider.value) {
    showNotice('请先在设置中添加并选择一个模型')
    showSettings.value = true
    return
  }
  const newNode = await editUserMessage(nodeId, content)
  if (!newNode) return
  await chatStream.generateAssistant({
    userNodeId: newNode.id,
    provider: currentProvider.value,
    model: currentModel.value,
    client,
    conversation: current,
    userSystemPrompt: userSystemPrompt.value,
  })
}

async function onRegenerate(nodeId) {
  const current = activeConversation.value
  if (!current) return
  const client = settingsRef.value?.getClient()
  if (!client || !currentProvider.value) {
    showNotice('请先在设置中添加并选择一个模型')
    showSettings.value = true
    return
  }
  await chatStream.regenerate({
    assistantNodeId: nodeId,
    provider: currentProvider.value,
    model: currentModel.value,
    client,
    conversation: current,
    userSystemPrompt: userSystemPrompt.value,
  })
}

const editDialogVisible = ref(false)
const editDialogMessage = ref(null)
const editDialogContent = ref('')

function openEditDialog(msg) {
  const client = settingsRef.value?.getClient()
  if (!client || !currentProvider.value) {
    showNotice('请先在设置中添加并选择一个模型')
    showSettings.value = true
    return
  }
  editDialogMessage.value = msg
  editDialogContent.value = msg.content || ''
  editDialogVisible.value = true
}
function closeEditDialog() {
  editDialogVisible.value = false
  editDialogMessage.value = null
  editDialogContent.value = ''
}
async function submitEditDialog(text) {
  const msg = editDialogMessage.value
  if (!msg) return
  const next = (text || '').trim()
  if (!next || next === (msg.content || '').trim()) { closeEditDialog(); return }
  const nodeId = msg.id
  closeEditDialog()
  await onEditMessage({ nodeId, content: next })
}

const chatWrapper = ref(null)
const domMessageIdMap = new WeakMap()

function buildActionBarHtml(role) {
  const editBtn = `<button class="msg-action-btn" data-action="edit" title="修改"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg></button>`
  const revertBtn = `<button class="msg-action-btn" data-action="revert" title="撤回此消息及之后"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h9M6 4.5L2.5 8 6 11.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
  const regenBtn = `<button class="msg-action-btn" data-action="regenerate" title="重新生成"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 4v4h-4M3 12V8h4M12.5 8a4.5 4.5 0 00-8-2.5M3.5 8a4.5 4.5 0 008 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`
  if (role === 'user') return editBtn + revertBtn
  if (role === 'assistant') return regenBtn
  return ''
}

async function attachActionBars(retry = 0) {
  await nextTick()
  if (!chatWrapper.value) return
  const hosts = Array.from(chatWrapper.value.querySelectorAll('.acu-bubble-main'))
  if (hosts.length === 0 && messages.value.length > 0) {
    if (retry < 20) setTimeout(() => attachActionBars(retry + 1), 50)
    return
  }
  if (hosts.length !== messages.value.length) return
  chatWrapper.value.querySelectorAll('.msg-action-bar').forEach(el => el.remove())
  hosts.forEach((el, index) => {
    const msg = messages.value[index]
    if (!msg?.id) return
    domMessageIdMap.set(el, msg.id)
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    const bar = document.createElement('div')
    bar.className = 'msg-action-bar'
    bar.dataset.messageId = msg.id
    bar.dataset.role = msg.role
    bar.innerHTML = buildActionBarHtml(msg.role)
    el.appendChild(bar)
  })
}

watch(() => messages.value.map(m => m.id).join('|'), () => attachActionBars(), { immediate: true })

function onWrapperClickCapture(e) {
  const actionBtn = e.target.closest('.msg-action-btn')
  if (actionBtn) {
    e.stopPropagation(); e.preventDefault()
    const action = actionBtn.dataset.action
    const bar = actionBtn.closest('.msg-action-bar')
    const messageId = bar?.dataset.messageId
    if (!messageId) return
    if (action === 'revert') onRevert(messageId)
    else if (action === 'edit') { const msg = messages.value.find(m => m.id === messageId); if (msg) openEditDialog(msg) }
    else if (action === 'regenerate') onRegenerate(messageId)
    return
  }
  const btn = e.target.closest('button, [role="button"]')
  if (!btn) return
  const hint = (btn.getAttribute('title') || btn.getAttribute('aria-label') || btn.innerText || '').toLowerCase()
  const isRegenerate = hint.includes('重新生成') || hint.includes('regenerate') || hint.includes('重试') || hint.includes('retry')
  if (!isRegenerate) return
  let node = btn
  while (node && node !== chatWrapper.value) {
    if (domMessageIdMap.has(node)) {
      const messageId = domMessageIdMap.get(node)
      e.stopPropagation(); e.preventDefault()
      onRegenerate(messageId); return
    }
    node = node.parentElement
  }
}

onMounted(async () => {
  document.addEventListener('llm-hub-select', onLLMHubSelect)
  initTheme()
  const restored = await loadConversations()
  if (!restored) await createConversation()
  nextTick(() => { chatWrapper.value?.addEventListener('click', onWrapperClickCapture, true) })
})

onUnmounted(() => {
  document.removeEventListener('llm-hub-select', onLLMHubSelect)
  chatWrapper.value?.removeEventListener('click', onWrapperClickCapture, true)
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
        <div v-if="!currentProvider" class="hint"><span>先选一个模型，再开始对话</span><button class="hint-btn"
            @click="showSettings = true">去设置</button></div>
        <div ref="chatWrapper" class="chat-card">
          <ChatContainer :messages="messages" :preset-questions="presetQuestions" :theme="resolvedTheme"
            welcome-logo="/favicon.ico" assistantName="助手" welcome-title="你好，有什么可以帮你？"
            welcome-description="试着问我任何问题，或选择下方的话题开始对话。" assistantAvatar="/favicon.ico" @send="onSend"
            @select="onPresetSelect" />
        </div>
      </main>
    </div>

    <button class="tree-fab" :class="{ active: showTree }" :title="showTree ? '隐藏对话树' : '显示对话树'"
      @click="showTree = !showTree">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="4" cy="4" r="1.5" stroke="currentColor" stroke-width="1.4" />
        <circle cx="4" cy="16" r="1.5" stroke="currentColor" stroke-width="1.4" />
        <circle cx="16" cy="10" r="1.5" stroke="currentColor" stroke-width="1.4" />
        <path d="M5.5 4.5v3c0 1.1.9 2 2 2h7M5.5 15.5v-3c0-1.1.9-2 2-2h7" stroke="currentColor" stroke-width="1.4"
          stroke-linecap="round" />
      </svg>
    </button>

    <ConversationTree v-if="activeConversation" :conversation="activeConversation"
      :current-leaf-id="activeConversation.currentLeafId" :visible="showTree" @update:visible="showTree = $event"
      @switch-node="onSwitchNode" @revert="onRevert" @edit="onEditMessage" @regenerate="onRegenerate" />

    <EditMessageDialog :visible="editDialogVisible" :content="editDialogContent" @close="closeEditDialog"
      @submit="submitEditDialog" />

    <SettingsDrawer ref="settingsRef" :show-settings="showSettings" :current-provider="currentProvider"
      :current-model="currentModel" :models="models" :theme-mode="themeMode" :user-system-prompt="userSystemPrompt"
      @close="showSettings = false" @update:theme-mode="themeMode = $event"
      @update:user-system-prompt="userSystemPrompt = $event" @switch-model="switchModel" @remove-model="removeModel"
      @add-model="onAddModel" />
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
  background: radial-gradient(70vw 34vh at 8% -8%, var(--glow-a) 0%, transparent 62%), radial-gradient(62vw 30vh at 104% 4%, var(--glow-b) 0%, transparent 58%), radial-gradient(68vw 40vh at 50% 118%, var(--glow-c) 0%, transparent 60%), var(--acu-bg);
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

:deep(.acu-bubble-main) {
  margin-bottom: 1.75rem;
}

:deep(.msg-action-bar) {
  position: absolute;
  top: 100%;
  right: 0.25rem;
  margin-top: 0.25rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.125rem;
  padding: 0.125rem 0.25rem;
  border-radius: 0.375rem;
  background: var(--acu-bg);
  border: 1px solid var(--acu-border);
  box-shadow: var(--acu-shadow-sm);
  opacity: 0.75;
  pointer-events: auto;
  transition: opacity 0.15s ease;
  user-select: none;
}

:deep(.acu-bubble-main:hover .msg-action-bar) {
  opacity: 1;
}

:deep(.msg-action-btn) {
  width: 1.25rem;
  height: 1.25rem;
  display: grid;
  place-items: center;
  color: var(--acu-text-muted);
  background: transparent;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

:deep(.msg-action-btn svg) {
  width: 0.75rem;
  height: 0.75rem;
}

:deep(.msg-action-btn:hover) {
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
}

:deep(.msg-action-btn:focus-visible) {
  outline: 0.125rem solid var(--acu-primary);
  outline-offset: 0.0625rem;
}

.tree-fab {
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 46;
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  color: var(--acu-text-secondary);
  background: var(--acu-bg);
  border: 0.0625rem solid var(--acu-border);
  border-radius: 50%;
  box-shadow: var(--acu-shadow-lg);
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.tree-fab svg {
  width: 1.25rem;
  height: 1.25rem;
}

.tree-fab:hover,
.tree-fab.active {
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
  border-color: var(--acu-primary-soft);
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

  :deep(.msg-action-bar) {
    transition: none;
  }
}
</style>