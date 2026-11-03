<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { listVoices, addVoice, deleteVoice } from '@/db/ttsVoices'

const props = defineProps({
    modelValue: { type: Object, default: null },
})

const emit = defineEmits(['update:modelValue'])

const presets = ref([])
const customVoices = ref([])
const loadingPresets = ref(false)
const loadingCustom = ref(false)

const showAddForm = ref(false)
const newName = ref('')
const newFile = ref(null)
const adding = ref(false)
const addError = ref('')

const allVoices = computed(() => [
    ...presets.value.map(p => ({
        key: `preset:${p.value}`,
        type: 'preset',
        name: p.value,
        label: p.label,
    })),
    ...customVoices.value.map(c => ({
        key: `custom:${c.id}`,
        type: 'custom',
        id: c.id,
        name: c.name,
        label: c.name,
    })),
])

const selectedKey = computed({
    get() {
        const v = props.modelValue
        if (!v) return ''
        if (v.type === 'preset') return `preset:${v.name}`
        if (v.type === 'custom') return `custom:${v.id}`
        return ''
    },
    set(k) {
        if (!k) {
            emit('update:modelValue', null)
            return
        }
        const found = allVoices.value.find(v => v.key === k)
        if (!found) return
        if (found.type === 'preset') {
            emit('update:modelValue', { type: 'preset', name: found.name })
        } else {
            emit('update:modelValue', { type: 'custom', id: found.id, name: found.name })
        }
    },
})

const selectedIsCustom = computed(() => props.modelValue?.type === 'custom')

async function loadPresets() {
    loadingPresets.value = true
    try {
        const r = await fetch('/tts/preset/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        })
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        const data = await r.json()
        const raw = Array.isArray(data?.names) ? data.names : []
        presets.value = raw
            .map(item => {
                // Gradio dropdown choices: [value, label]；兼容纯字符串
                if (Array.isArray(item)) {
                    const value = typeof item[0] === 'string' ? item[0].trim() : ''
                    const label = typeof item[1] === 'string' && item[1].trim() ? item[1].trim() : value
                    if (!value) return null
                    return { value, label: label || value }
                }
                if (typeof item === 'string' && item.trim()) {
                    const v = item.trim()
                    return { value: v, label: v }
                }
                return null
            })
            .filter(Boolean)
    } catch (e) {
        console.warn('[tts] 加载预设失败', e)
        presets.value = []
    } finally {
        loadingPresets.value = false
    }
}

async function loadCustom() {
    loadingCustom.value = true
    try {
        const list = await listVoices()
        customVoices.value = list.map(v => ({ id: v.id, name: v.name }))
    } catch (e) {
        console.warn('[tts] 加载自定义音色失败', e)
        customVoices.value = []
    } finally {
        loadingCustom.value = false
    }
}

function openAddForm() {
    showAddForm.value = true
    newName.value = ''
    newFile.value = null
    addError.value = ''
}

function closeAddForm() {
    showAddForm.value = false
    newName.value = ''
    newFile.value = null
    addError.value = ''
}

function onFileChange(e) {
    newFile.value = e.target.files?.[0] || null
}

async function submitAdd() {
    addError.value = ''
    const name = newName.value.trim()
    if (!name) { addError.value = '请填写音色名称'; return }
    if (!newFile.value) { addError.value = '请选择参考音频'; return }

    adding.value = true
    try {
        const id = await addVoice({
            name,
            audioBlob: newFile.value,
            mime: newFile.value.type,
        })
        await loadCustom()
        emit('update:modelValue', { type: 'custom', id, name })
        closeAddForm()
    } catch (e) {
        addError.value = e?.message || String(e)
    } finally {
        adding.value = false
    }
}

async function removeCurrent() {
    if (!selectedIsCustom.value) return
    if (!window.confirm(`删除音色「${props.modelValue.name}」？`)) return
    try {
        await deleteVoice(props.modelValue.id)
        emit('update:modelValue', null)
        await loadCustom()
    } catch (e) {
        addError.value = e?.message || String(e)
    }
}

// 已选 voice 失效时自动清空，避免下拉显示已选但请求 400
watch(
    () => [presets.value, customVoices.value, props.modelValue],
    () => {
        const v = props.modelValue
        if (!v) return
        if (v.type === 'preset' && presets.value.length > 0) {
            const ok = presets.value.some(p => p.value === v.name)
            if (!ok) emit('update:modelValue', null)
        } else if (v.type === 'custom' && customVoices.value.length > 0) {
            const ok = customVoices.value.some(c => c.id === v.id)
            if (!ok) emit('update:modelValue', null)
        }
    },
    { deep: true }
)

onMounted(() => {
    loadPresets()
    loadCustom()
})
</script>

<template>
    <div class="voice-picker">
        <label class="field">
            <span class="field-label">音色</span>
            <select v-model="selectedKey" class="field-input">
                <option value="">— 未选择 —</option>
                <optgroup label="预设音色" v-if="presets.length">
                    <option v-for="v in allVoices.filter(x => x.type === 'preset')" :key="v.key" :value="v.key">{{
                        v.label }}</option>
                </optgroup>
                <optgroup label="自定义音色" v-if="customVoices.length">
                    <option v-for="v in allVoices.filter(x => x.type === 'custom')" :key="v.key" :value="v.key">{{
                        v.label }}</option>
                </optgroup>
            </select>
            <span class="field-hint">
                预设音色由服务端提供，只读；自定义音色存于本浏览器，可增删。
            </span>
        </label>

        <div class="voice-actions">
            <button class="btn" type="button" @click="openAddForm">+ 添加自定义音色</button>
            <button v-if="selectedIsCustom" class="btn danger" type="button" @click="removeCurrent">删除当前自定义音色</button>
        </div>

        <div v-if="showAddForm" class="add-form">
            <label class="field">
                <span class="field-label">名称</span>
                <input v-model="newName" class="field-input" placeholder="例如：温柔女声" />
            </label>
            <label class="field">
                <span class="field-label">参考音频</span>
                <input type="file" accept="audio/*" class="field-input" @change="onFileChange" />
                <span class="field-hint">建议 3~15 秒清晰人声，wav / mp3 均可</span>
            </label>
            <p v-if="addError" class="add-error">{{ addError }}</p>
            <div class="add-actions">
                <button class="btn" type="button" @click="closeAddForm" :disabled="adding">取消</button>
                <button class="btn primary" type="button" @click="submitAdd" :disabled="adding">
                    {{ adding ? '保存中…' : '保存' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.voice-picker {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
}

.field-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.625rem;
    font-family: inherit;
    font-size: 0.8125rem;
    color: var(--acu-text);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    outline: none;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-input:focus {
    border-color: var(--acu-primary);
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.field-hint {
    font-size: 0.6875rem;
    color: var(--acu-text-muted);
    line-height: 1.5;
}

.voice-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.btn {
    height: 2rem;
    padding: 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--acu-text-secondary);
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

.btn:hover:not(:disabled) {
    color: var(--acu-primary);
    border-color: var(--acu-primary-soft);
}

.btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.btn.primary {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border-color: var(--acu-primary);
}

.btn.primary:hover:not(:disabled) {
    background: var(--acu-primary-hover);
}

.btn.danger:hover:not(:disabled) {
    color: var(--acu-error);
    border-color: var(--acu-error);
}

.add-form {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    padding: 0.75rem;
    background: var(--acu-surface);
    border: 1px solid var(--acu-border);
    border-radius: 0.625rem;
}

.add-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
}

.add-error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--acu-error);
}
</style>