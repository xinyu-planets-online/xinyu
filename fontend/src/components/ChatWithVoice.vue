<script setup>
import { ref, computed } from 'vue'
import { MessageList, ChatInput, WelcomeScreen } from 'zen-ai-chat-ui'
import 'zen-ai-chat-ui/style.css'
import VoiceInputButton from './VoiceInputButton.vue'

const props = defineProps({
    messages: { type: Array, required: true },
    isStreaming: { type: Boolean, default: false },
    presetQuestions: { type: Array, default: () => [] },
    theme: { type: String, default: 'light' },
    welcomeTitle: { type: String, default: '你好，有什么可以帮你？' },
    welcomeDescription: { type: String, default: '试着问我任何问题，或选择下方的话题开始对话。' },
    assistantName: { type: String, default: '助手' },
})
const emit = defineEmits(['send', 'select'])

const inputText = ref('')

function onVoiceUpdate(text) {
    inputText.value = text
}

function onVoiceFinish(text) {
    inputText.value = text
}

function onSend(payload) {
    const text = (payload?.text ?? inputText.value).trim()
    if (!text && !(payload?.files?.length)) return
    emit('send', { text, files: payload?.files || [] })
    inputText.value = ''
}

const hasMessages = computed(() => props.messages.length > 0)
</script>

<template>
    <div class="chat-shell" :data-theme="theme">
        <div v-if="!hasMessages" class="welcome-wrap">
            <WelcomeScreen :title="welcomeTitle" :description="welcomeDescription" :preset-questions="presetQuestions"
                @select="$emit('select', $event)" />
        </div>

        <div v-else class="messages-wrap">
            <MessageList :messages="messages" :assistant-name="assistantName" :theme="theme" />
        </div>

        <div class="input-row">
            <VoiceInputButton :base-text="inputText" :disabled="isStreaming" @update="onVoiceUpdate"
                @finish="onVoiceFinish" />
            <ChatInput v-model="inputText" :disabled="isStreaming" placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                @send="onSend" />
        </div>
    </div>
</template>

<style scoped>
.chat-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--acu-bg);
}

.welcome-wrap {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.messages-wrap {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
}

.input-row {
    flex: 0 0 auto;
    display: flex;
    align-items: flex-end;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--acu-border);
    background: var(--acu-bg);
}

.input-row> :last-child {
    flex: 1 1 auto;
    min-width: 0;
}
</style>