<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ChatContainer, useStreaming, uid } from 'zen-ai-chat-ui'
import 'zen-ai-chat-ui/style.css'

import '@inteye/llm-hub-ui/element'
import '@inteye/llm-hub-ui/style.css'

const messages = ref([])
const streaming = useStreaming()

// 拿 <llm-hub-config> 的引用，之后从这里取它内部的 client
const configEl = ref(null)

// 初始留空，等用户在左侧选完再赋值
const currentProvider = ref('')
const currentModel = ref('')

function onLLMHubSelect(event) {
  const detail = event.detail
  currentProvider.value = detail.provider
  currentModel.value = detail.model
  console.log('[llm-hub] 用户选择:', detail.provider, detail.model)
}

onMounted(() => {
  document.addEventListener('llm-hub-select', onLLMHubSelect)
})

onUnmounted(() => {
  document.removeEventListener('llm-hub-select', onLLMHubSelect)
})

const presetQuestions = [
  { id: 'q1', label: '介绍一下你自己', prompt: '介绍一下你自己' },
  { id: 'q2', label: '写一首短诗', prompt: '写一首关于春天的短诗' },
]

async function onSend({ text }) {
  if (!text.trim()) return
  if (!currentProvider.value) {
    alert('请先在左侧配置并选择一个 Provider / 模型')
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
    // 关键：用 <llm-hub-config> 内部那个 client，它注册了全部 provider（含 custom）
    const client = configEl.value?.client
    if (!client) throw new Error('llm-hub-config 尚未就绪')

    const stream = client.chatStream({
      provider: currentProvider.value,
      model: currentModel.value,
      messages: history,
    })

    for await (const chunk of stream) {
      streaming.append(assistant, {
        type: 'content',
        delta: chunk.delta,
      })
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
  <div style="display: flex;">
    <aside style="flex: 1.5">
      <h3 style="margin: 0 0 8px;">模型配置</h3>
      <p style="font-size: 12px; color: #888; margin: 0 0 12px;">
        填写你自己的 API Key，选择 Provider 和模型。
      </p>

      <!-- 加 ref，后续从它身上取 client -->
      <llm-hub-config ref="configEl" storage="localStorage" locale="zh" show-debug />

      <div style="margin-top: 16px; font-size: 12px; color: #555;">
        当前：<strong>{{ currentProvider || '未选择' }}</strong>
        <template v-if="currentModel"> / <strong>{{ currentModel }}</strong></template>
      </div>
    </aside>

    <main style="flex: 1">
      <ChatContainer :messages="messages" :preset-questions="presetQuestions" theme="auto" assistant-name="AI 助手"
        @send="onSend" />
    </main>
  </div>
</template>