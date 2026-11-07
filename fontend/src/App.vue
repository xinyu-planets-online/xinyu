<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
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
import VoiceInputButton from './components/VoiceInputButton.vue'
import ImageViewer from './components/ImageViewer.vue'
import EnergyStation from './components/EnergyStation.vue'

import { useTheme } from './composables/useTheme'
import { useNotice } from './composables/useNotice'
import { useConversations } from './composables/useConversations'
import { useChatStream } from './composables/useChatStream'
import { useUserSystemPrompt } from './composables/useSystemPrompts'
import { summarizeFile, unwrapFile } from './composables/useAttachmentSummary'
import { useLocalOcr } from './composables/useLocalOcr'
import { useTts, stripTtsMarkers, extractTtsMeta, buildTtsSystemPrompt } from './composables/useTts'
import { useTtsSettings } from './composables/useTtsSettings'

const SELECTION_KEY = 'chat-selection'
const MODELS_KEY = 'chat-models'
const OCR_ENABLED_KEY = 'chat-ocr-enabled'
const SIDEBAR_COLLAPSED_KEY = 'chat-sidebar-collapsed'

const {
  themeLabel, themeMode, resolvedTheme, cycleTheme,
  init: initTheme, destroy: destroyTheme,
} = useTheme()

const { notice, showNotice, cleanup: cleanupNotice } = useNotice()
const { userSystemPrompt } = useUserSystemPrompt()

const { isRecognizing, ocrStatus, ocrProgress, recognize } = useLocalOcr()

const ttsSettings = useTtsSettings()
const tts = useTts(ttsSettings)

function updateTtsSettings(patch) {
  Object.assign(ttsSettings.value, patch)
}

function previewTts() {
  const s = ttsSettings.value
  if (!s.enabled) {
    showNotice('请先启用语音合成')
    return
  }
  if (!s.voice) {
    showNotice('请先选择一个音色')
    return
  }
  tts.speak('你好，这是一段试听语音。', { emotion: 'happy', weight: 0.6, lang: 'ZH' }, s.voice)
}

// ===== 左侧侧栏收起状态 =====
const sidebarCollapsed = ref(false)
try {
  sidebarCollapsed.value = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
} catch { }

watch(sidebarCollapsed, (v) => {
  try {
    if (v) localStorage.setItem(SIDEBAR_COLLAPSED_KEY, '1')
    else localStorage.removeItem(SIDEBAR_COLLAPSED_KEY)
  } catch { }
})

const ocrEnabled = ref(false)
try {
  ocrEnabled.value = localStorage.getItem(OCR_ENABLED_KEY) === '1'
} catch { }

watch(ocrEnabled, (v) => {
  try {
    if (v) localStorage.setItem(OCR_ENABLED_KEY, '1')
    else localStorage.removeItem(OCR_ENABLED_KEY)
  } catch { }
})

const showSettings = ref(false)
const showTree = ref(false)
const currentProvider = ref('')
const currentModel = ref('')
const settingsRef = ref(null)
const showEnergy = ref(false)

const voiceBaseText = ref('')
const models = ref([])

const imageViewerVisible = ref(false)
const imageViewerSrc = ref('')

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

const displayMessages = computed(() =>
  messages.value.map((m) => {
    let content = m.content || ''
    if (m.role === 'assistant') {
      content = stripTtsMarkers(content)
    }

    const imgs = m.images || []
    if (imgs.length) {
      const md = imgs
        .filter((img) => img?.dataUrl)
        .map((img) => `![图片](${img.dataUrl})`)
        .join('\n\n')
      if (md) content = content ? `${content}\n\n${md}` : md
    }

    if (content === (m.content || '') && !imgs.length) return m
    return { ...m, content }
  })
)

const presetQuestions = [
  { id: 'q1', label: '最近有点累，想聊聊', prompt: '我最近有点累，想找个人聊聊，你可以陪我说说话吗？' },
  { id: 'q2', label: '带我做一次呼吸放松', prompt: '带我做一次呼吸放松练习吧。' },
  { id: 'q3', label: '我今晚睡不着', prompt: '我今晚睡不着，脑子里很乱，能陪我说说话吗？' },
  { id: 'q4', label: '我需要解压', prompt: '很焦虑，怎么办，快告诉我' },
]

function onPresetSelect(q) {
  onSend({ text: q.prompt, files: [] })
}

function isImageFile(f) {
  const name = (f.name || '').toLowerCase()
  const type = (f.type || '').toLowerCase()
  return (
    type.startsWith('image/') ||
    /\.(png|jpe?g|webp|bmp|gif|tiff?)$/.test(name)
  )
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

async function buildPayload({ files }) {
  const hasFiles = Array.isArray(files) && files.length > 0
  const summaries = []
  const images = []

  const useOcr = hasFiles && ocrEnabled.value

  if (hasFiles) {
    for (const f of files) {
      const raw = unwrapFile(f)
      if (!raw) continue

      if (isImageFile(raw)) {
        if (useOcr) {
          try {
            const ocrText = await recognize(raw, 'chi_sim+eng')
            summaries.push({
              id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: raw.name || '图片',
              size: raw.size || 0,
              type: raw.type || 'image/*',
              summary: ocrText
                ? `[图片 OCR]\n${ocrText.slice(0, 2000)}`
                : `[图片] ${raw.name || ''} (OCR 未识别出文字)`,
              createdAt: Date.now(),
            })
          } catch (e) {
            console.warn('[ocr] 识别失败', e)
            try { summaries.push(await summarizeFile(raw)) } catch { }
          }
        } else {
          try {
            const dataUrl = await fileToDataUrl(raw)
            images.push({
              name: raw.name || 'image',
              mime: raw.type || 'image/png',
              dataUrl,
            })
          } catch (e) {
            console.warn('[image] 读取失败', e)
          }
        }
        continue
      }

      try { summaries.push(await summarizeFile(raw)) } catch { }
    }
  }

  return { summaries, images, useOcr }
}

// ===== TTS 句子级流水线 =====
const SENTENCE_END = /[。！？!?\n]/
const TTS_META_RE = /<TTS>\s*(\{[\s\S]*?\})\s*<\/TTS>/i
const EMOTION_KEYS = ['happy', 'angry', 'sad', 'fear', 'disgust', 'low', 'surprised', 'calm']
const FALLBACK_META = { emotion: 'happy', weight: 0.7, lang: 'ZH' }

function normalizeMeta(p) {
  if (!p || typeof p !== 'object') return { ...FALLBACK_META }
  const emotion = EMOTION_KEYS.includes(p.emotion) ? p.emotion : FALLBACK_META.emotion
  const rawWeight = typeof p.weight === 'number' ? p.weight : FALLBACK_META.weight
  const weight = Math.max(0, Math.min(1, rawWeight))
  const lang = typeof p.lang === 'string' && p.lang ? p.lang : FALLBACK_META.lang
  return { emotion, weight, lang }
}

function splitSentences(buffer, flush) {
  const out = []
  let rest = buffer
  let idx
  while ((idx = rest.search(SENTENCE_END)) >= 0) {
    const end = idx + 1
    const s = rest.slice(0, end).trim()
    if (s) out.push(s)
    rest = rest.slice(end)
  }
  while (rest.length > 80) {
    const s = rest.slice(0, 80).trim()
    if (s) out.push(s)
    rest = rest.slice(80)
  }
  if (flush && rest.trim()) {
    out.push(rest.trim())
    rest = ''
  }
  return { completed: out, rest }
}

function createTtsPipeline(voice) {
  let rawBuffer = ''
  let lastVisible = ''
  let sentenceBuffer = ''
  let resolvedMeta = null
  let metaResolved = false
  let commitChain = Promise.resolve()
  let playChain = Promise.resolve()
  let cancelled = false
  let commitRef = null

  function tryResolveMeta() {
    if (metaResolved) return
    const m = TTS_META_RE.exec(rawBuffer)
    if (!m) return
    try {
      const p = JSON.parse(m[1])
      resolvedMeta = normalizeMeta(p)
    } catch {
      resolvedMeta = { ...FALLBACK_META }
    }
    metaResolved = true
  }

  function enqueue(text, commit) {
    if (!text || cancelled) return
    const meta = resolvedMeta || FALLBACK_META
    const synthPromise = tts.synthesize(text, meta, voice).catch((e) => {
      console.warn('[tts] 合成失败，降级为纯文本', e)
      return null
    })

    commitChain = commitChain.then(async () => {
      if (cancelled) {
        try { const a = await synthPromise; if (a?.url) URL.revokeObjectURL(a.url) } catch { }
        return
      }
      const audio = await synthPromise
      commit(text)
      if (audio?.url) {
        playChain = playChain.then(() => {
          if (cancelled) {
            URL.revokeObjectURL(audio.url)
            return
          }
          return tts.playUrl(audio.url)
        }).catch(() => { })
      }
    }).catch((e) => {
      console.warn('[tts] commit 链异常', e)
    })
  }

  return {
    onDelta(delta, commit) {
      if (cancelled) return
      commitRef = commit
      rawBuffer += delta
      if (!metaResolved) tryResolveMeta()

      const visible = stripTtsMarkers(rawBuffer)
      const newText = visible.slice(lastVisible.length)
      lastVisible = visible
      if (!newText) return

      sentenceBuffer += newText
      const { completed, rest } = splitSentences(sentenceBuffer, false)
      for (const s of completed) enqueue(s, commit)
      sentenceBuffer = rest
    },

    async onDone(commit) {
      if (cancelled) return
      commitRef = commit
      const { completed } = splitSentences(sentenceBuffer, true)
      for (const s of completed) enqueue(s, commit)
      sentenceBuffer = ''
      try { await commitChain } catch { }
    },

    onError() {
      if (cancelled) return
      cancelled = true
      if (commitRef && sentenceBuffer) {
        commitRef(sentenceBuffer)
        sentenceBuffer = ''
      }
      tts.stop()
    },

    stop() {
      cancelled = true
      tts.stop()
    },
  }
}

function playAssistantTts() { }

function buildTtsPipelineFor(ttsActive) {
  if (!ttsActive) return null
  return createTtsPipeline(ttsSettings.value.voice)
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

  if (!activeConversationId.value) await createConversation()
  const current = activeConversation.value
  if (!current) return

  const { summaries, images, useOcr } = await buildPayload({ files })

  const ttsActive = ttsSettings.value.enabled && !!ttsSettings.value.voice
  const finalSystemPrompt = ttsActive
    ? buildTtsSystemPrompt(userSystemPrompt.value)
    : userSystemPrompt.value
  const ttsPipeline = buildTtsPipelineFor(ttsActive)

  const result = await chatStream.send({
    text: text || '',
    files: summaries,
    images,
    provider: providerName,
    model: modelName,
    client,
    conversation: current,
    userSystemPrompt: finalSystemPrompt,
    ttsPipeline,
  })

  if (result && !result.ok && result.isImageError && !useOcr) {
    ttsPipeline?.stop()
    ocrEnabled.value = true
    showNotice('当前模型不支持图片输入，已自动开启 OCR，正在改用图片文字重试...')
    if (result.userNodeId) {
      try { await revertToNode(result.userNodeId) } catch (e) { console.warn('[retry] 回滚失败', e) }
    }
    await onSend({ text, files })
    return
  }
}

function setChatInputText(text) {
  const ta = chatWrapper.value?.querySelector('.acu-input-textarea')
  if (!ta) return
  ta.value = text
  ta.dispatchEvent(new Event('input', { bubbles: true }))
  ta.focus()
  const len = ta.value.length
  ta.setSelectionRange(len, len)
}

function onVoiceUpdate(text) {
  setChatInputText(text || voiceBaseText.value)
}

function onVoiceFinish(text) {
  const finalText = (text || '').trim()
  if (!finalText) return
  setChatInputText(finalText)
  voiceBaseText.value = finalText
}

function onInputDelegate(e) {
  if (e.target?.classList?.contains('acu-input-textarea')) {
    voiceBaseText.value = e.target.value
  }
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

  const ttsActive = ttsSettings.value.enabled && !!ttsSettings.value.voice
  const finalSystemPrompt = ttsActive
    ? buildTtsSystemPrompt(userSystemPrompt.value)
    : userSystemPrompt.value
  const ttsPipeline = buildTtsPipelineFor(ttsActive)

  await chatStream.generateAssistant({
    userNodeId: newNode.id,
    provider: currentProvider.value,
    model: currentModel.value,
    client,
    conversation: current,
    userSystemPrompt: finalSystemPrompt,
    ttsPipeline,
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

  const ttsActive = ttsSettings.value.enabled && !!ttsSettings.value.voice
  const finalSystemPrompt = ttsActive
    ? buildTtsSystemPrompt(userSystemPrompt.value)
    : userSystemPrompt.value
  const ttsPipeline = buildTtsPipelineFor(ttsActive)

  const result = await chatStream.regenerate({
    assistantNodeId: nodeId,
    provider: currentProvider.value,
    model: currentModel.value,
    client,
    conversation: current,
    userSystemPrompt: finalSystemPrompt,
    ttsPipeline,
  })

  if (result && !result.ok && result.isImageError && !ocrEnabled.value) {
    ttsPipeline?.stop()
    ocrEnabled.value = true
    showNotice('当前模型不支持图片输入，已自动开启 OCR，请再点一次「重新生成」')
    return
  }
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
  const img = e.target.closest('img')
  if (img && chatWrapper.value?.contains(img)) {
    const src = img.getAttribute('src') || ''
    if (src.startsWith('data:image/')) {
      e.stopPropagation()
      e.preventDefault()
      imageViewerSrc.value = src
      imageViewerVisible.value = true
      return
    }
  }

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

function handleCloudImported() {
  loadConversations()
}

function handleCloudCleared() {
  location.reload()
}

onMounted(async () => {
  document.addEventListener('llm-hub-select', onLLMHubSelect)
  initTheme()
  const restored = await loadConversations()
  if (!restored) await createConversation()
  nextTick(() => {
    chatWrapper.value?.addEventListener('click', onWrapperClickCapture, true)
    chatWrapper.value?.addEventListener('input', onInputDelegate)
  })
})

onUnmounted(() => {
  document.removeEventListener('llm-hub-select', onLLMHubSelect)
  chatWrapper.value?.removeEventListener('click', onWrapperClickCapture, true)
  chatWrapper.value?.removeEventListener('input', onInputDelegate)
  tts.stop()
  destroyTheme()
  cleanupNotice()
})
</script>

<template>
  <div class="page" :data-theme="resolvedTheme">
    <AppHeader :theme-label="themeLabel" :show-settings="showSettings" @cycle-theme="cycleTheme"
      @toggle-settings="showSettings = !showSettings" @open-energy="showEnergy = true" />

    <transition name="fade">
      <div v-if="notice" class="notice">{{ notice }}</div>
    </transition>

    <div class="body">
      <div class="sidebar-wrap" :class="{ collapsed: sidebarCollapsed }">
        <ConversationSidebar :conversations="conversations" :active-conversation-id="activeConversationId"
          :select-mode="selectMode" :selected-ids="selectedIds" @switch="switchConversation" @close="closeConversation"
          @create="createConversation" @export-all="exportAllConversations" @enter-select="enterSelectMode"
          @import="handleImport" @toggle-select="toggleSelect" @toggle-select-all="toggleSelectAll"
          @export-selected="exportSelected" @cancel-select="cancelSelectMode" />
      </div>

      <div class="sidebar-toggle-bar">
        <button class="sidebar-fab" :title="sidebarCollapsed ? '展开对话列表' : '收起对话列表'"
          @click="sidebarCollapsed = !sidebarCollapsed">
          <svg v-if="sidebarCollapsed" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3L11 8L6 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3L5 8L10 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </button>
      </div>

      <main class="chat-area">
        <div v-if="!currentProvider" class="hint"><span>先选一个模型，再开始对话</span><button class="hint-btn"
            @click="showSettings = true">去设置</button></div>

        <div ref="chatWrapper" class="chat-card">
          <ChatContainer :messages="displayMessages" :preset-questions="presetQuestions" :theme="resolvedTheme"
            welcome-logo="/logo.png" assistantName="心屿" welcome-title="你好，有什么可以帮你？"
            welcome-description="试着问我任何问题，或选择下方的话题开始对话。" assistantAvatar="/logo.png" @send="onSend"
            @select="onPresetSelect" />

          <div class="chat-toolbar">
            <VoiceInputButton :base-text="voiceBaseText" @update="onVoiceUpdate" @finish="onVoiceFinish" />

            <button class="ocr-toggle" :class="{ active: ocrEnabled }" :title="ocrEnabled
              ? '只发图片中的文字，不发图片本体（点击关闭，改为直接发图片）'
              : '图片直接发给模型（点击开启 OCR，改为只发图片中的文字）'" @click="ocrEnabled = !ocrEnabled">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" stroke-width="1.4" />
                <path d="M5 7h2M5 9h4M9 6l1.5 1.5L9 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
              <span>{{ ocrEnabled ? 'OCR 开' : 'OCR 关' }}</span>
            </button>

            <button class="tts-toggle" :class="{ active: ttsSettings.enabled }"
              :title="ttsSettings.enabled ? '关闭语音合成' : '开启语音合成'"
              @click="updateTtsSettings({ enabled: !ttsSettings.enabled })">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 6v4h2l3 2V4L5 6H3z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
                <path v-if="ttsSettings.enabled" d="M11 6c.7.5 1 1.2 1 2s-.3 1.5-1 2" stroke="currentColor"
                  stroke-width="1.4" stroke-linecap="round" />
                <path v-else d="M11 5.5l3 3M14 5.5l-3 3" stroke="currentColor" stroke-width="1.4"
                  stroke-linecap="round" />
              </svg>
              <span>{{ ttsSettings.enabled ? 'TTS 开' : 'TTS 关' }}</span>
            </button>
          </div>

          <div v-if="isRecognizing" class="ocr-progress">
            <span class="ocr-progress-label">{{ ocrStatus }}</span>
            <div class="ocr-progress-track">
              <div class="ocr-progress-fill" :style="{ width: ocrProgress + '%' }" />
            </div>
            <span class="ocr-progress-value">{{ ocrProgress }}%</span>
          </div>

          <div v-if="ttsSettings.enabled" class="tts-status"
            :style="{ visibility: (tts.playing.value || tts.loading.value) ? 'visible' : 'hidden' }">
            <span class="tts-status-dot" />
            <span>{{ tts.loading.value ? '语音合成中…' : '正在播放语音' }}</span>
            <button class="tts-stop-btn" :disabled="!tts.playing.value" @click="tts.stop()">停止</button>
          </div>
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

    <ImageViewer :visible="imageViewerVisible" :src="imageViewerSrc" alt="图片预览"
      @close="imageViewerVisible = false; imageViewerSrc = ''" />
    <EnergyStation :visible="showEnergy" @close="showEnergy = false" />
    <SettingsDrawer ref="settingsRef" :show-settings="showSettings" :current-provider="currentProvider"
      :current-model="currentModel" :models="models" :theme-mode="themeMode" :user-system-prompt="userSystemPrompt"
      :tts-settings="ttsSettings" @close="showSettings = false" @update:theme-mode="themeMode = $event"
      @update:user-system-prompt="userSystemPrompt = $event" @update:tts-settings="updateTtsSettings"
      @tts-preview="previewTts" @switch-model="switchModel" @remove-model="removeModel" @add-model="onAddModel"
      @data-imported="handleCloudImported" @data-cleared="handleCloudCleared" />
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

.mindfulness-entry {
  flex: 0 0 auto;
  display: flex;
  justify-content: center;
  padding: 0.5rem 1rem 0;
}

.mindfulness-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  padding: 0 0.875rem;
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  color: var(--acu-text-muted);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 999rem;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.mindfulness-link svg {
  width: 0.875rem;
  height: 0.875rem;
}

.mindfulness-link:hover,
.mindfulness-link:focus-visible {
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
  border-color: var(--acu-primary-soft);
  outline: none;
}

/* ===== 侧栏收起包装（无过渡） ===== */
.sidebar-wrap {
  flex: 0 0 auto;
  display: flex;
  min-width: 0;
  overflow: hidden;
}

.sidebar-wrap.collapsed {
  width: 0;
}

.sidebar-wrap>* {
  flex: 0 0 auto;
}

/* ===== 侧栏切换条：flex 流内占位，不覆盖任何内容 ===== */
.sidebar-toggle-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 3.75rem;
  width: 1.5rem;
}

.sidebar-fab {
  width: 1.5rem;
  height: 1.75rem;
  display: grid;
  place-items: center;
  color: var(--acu-text-muted);
  background: transparent;
  border: 1px solid var(--acu-border);
  border-radius: 0.375rem;
  cursor: pointer;
}

.sidebar-fab svg {
  width: 0.875rem;
  height: 0.875rem;
}

.sidebar-fab:hover {
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
  border-color: var(--acu-primary-soft);
}

.sidebar-fab:focus-visible {
  outline: 2px solid var(--acu-primary);
  outline-offset: 2px;
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

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: -0.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.ocr-toggle,
.tts-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  height: 2.25rem;
  padding: 0 0.75rem;
  font-size: 0.75rem;
  color: var(--acu-text-muted);
  background: var(--acu-bg);
  border: 1px solid var(--acu-border);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.ocr-toggle svg,
.tts-toggle svg {
  width: 0.875rem;
  height: 0.875rem;
}

.ocr-toggle:hover,
.tts-toggle:hover {
  color: var(--acu-primary);
  background: var(--acu-primary-soft);
  border-color: var(--acu-primary-soft);
}

.ocr-toggle.active,
.tts-toggle.active {
  color: var(--acu-primary-contrast);
  background: var(--acu-primary);
  border-color: var(--acu-primary);
}

.ocr-toggle:focus-visible,
.tts-toggle:focus-visible {
  outline: 2px solid var(--acu-primary);
  outline-offset: 2px;
}

.ocr-progress {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem 0.5rem;
  font-size: 0.75rem;
  color: var(--acu-text-muted);
}

.ocr-progress-label {
  flex: 0 0 auto;
  white-space: nowrap;
}

.ocr-progress-track {
  flex: 1 1 auto;
  height: 0.25rem;
  background: var(--acu-border);
  border-radius: 999rem;
  overflow: hidden;
}

.ocr-progress-fill {
  height: 100%;
  background: var(--acu-primary);
  transition: width 0.2s ease;
}

.ocr-progress-value {
  flex: 0 0 auto;
  min-width: 2.5rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.tts-status {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.75rem 0.5rem;
  font-size: 0.75rem;
  color: var(--acu-text-muted);
}

.tts-status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--acu-primary);
  animation: tts-pulse 1.2s ease-in-out infinite;
}

@keyframes tts-pulse {

  0%,
  100% {
    opacity: 0.5;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.3);
  }
}

.tts-stop-btn {
  margin-left: auto;
  height: 1.75rem;
  padding: 0 0.625rem;
  font-size: 0.75rem;
  color: var(--acu-text-secondary);
  background: var(--acu-surface);
  border: 1px solid var(--acu-border);
  border-radius: 0.375rem;
  cursor: pointer;
}

.tts-stop-btn:hover {
  color: var(--acu-error);
  border-color: var(--acu-error);
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

:deep(.acu-md img) {
  display: block;
  width: 12rem;
  height: 9rem;
  max-width: 100%;
  object-fit: cover;
  object-position: center;
  border-radius: 0.5rem;
  margin: 0.375rem 0;
  cursor: zoom-in;
  transition: opacity 0.15s ease;
}

:deep(.acu-md img:hover) {
  opacity: 0.9;
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

  .sidebar-wrap,
  .sidebar-wrap.collapsed {
    width: 100%;
    max-height: 7.5rem;
  }

  .sidebar-toggle-bar {
    display: none;
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

  :deep(.acu-md img) {
    transition: none;
  }

  .ocr-progress-fill,
  .ocr-toggle,
  .tts-toggle {
    transition: none;
  }

  .tts-status-dot {
    animation: none;
  }
}
</style>