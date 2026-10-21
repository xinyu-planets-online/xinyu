<script setup>
import { ref } from 'vue'

const props = defineProps({
    conversations: { type: Array, required: true },
    activeConversationId: { type: String, default: '' },
    selectMode: { type: Boolean, default: false },
    selectedIds: { type: Array, required: true },
})

const emit = defineEmits([
    'switch', 'close', 'create',
    'export-all', 'enter-select', 'import',
    'toggle-select', 'toggle-select-all', 'export-selected', 'cancel-select',
])

const fileInputEl = ref(null)

function triggerImport() {
    fileInputEl.value?.click()
}

function onFileChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) emit('import', file)
}

function onTabClick(id) {
    if (props.selectMode) emit('toggle-select', id)
    else emit('switch', id)
}
</script>

<template>
    <aside class="conv-sidebar">
        <div class="conv-sidebar-head">
            <span class="conv-sidebar-title">
                {{ selectMode ? `已选 ${selectedIds.length}` : '对话' }}
            </span>

            <div v-if="!selectMode" class="conv-sidebar-actions">
                <button class="conv-icon-btn" title="导出全部对话" @click="$emit('export-all')">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 12.5h10" stroke="currentColor" stroke-width="1.4"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="conv-icon-btn" title="选择性导出" @click="$emit('enter-select')">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2.5 4.5h7M2.5 8h7M2.5 11.5h7M12 4.5l1.5 1.5L16 3.5" stroke="currentColor"
                            stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="conv-icon-btn" title="导入对话" @click="triggerImport">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 10V2M4.5 5.5L8 2l3.5 3.5M3 12.5h10" stroke="currentColor" stroke-width="1.4"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="conv-new-btn" title="新建对话" @click="$emit('create')">+</button>
            </div>

            <div v-else class="conv-sidebar-actions">
                <button class="conv-icon-btn" :title="selectedIds.length === conversations.length ? '取消全选' : '全选'"
                    @click="$emit('toggle-select-all')">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" stroke-width="1.4" />
                        <path d="M5.5 8l1.8 1.8L10.8 6.3" stroke="currentColor" stroke-width="1.4"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="conv-icon-btn" :disabled="!selectedIds.length" :title="`导出选中的 ${selectedIds.length} 个对话`"
                    @click="$emit('export-selected')">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M3 12.5h10" stroke="currentColor" stroke-width="1.4"
                            stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </button>
                <button class="conv-icon-btn" title="取消" @click="$emit('cancel-select')">
                    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                    </svg>
                </button>
            </div>
        </div>

        <input ref="fileInputEl" type="file" accept="application/json,.json" style="display:none"
            @change="onFileChange" />

        <div class="conv-tabs">
            <div v-for="conv in conversations" :key="conv.id" class="conv-tab"
                :class="{ active: conv.id === activeConversationId, selected: selectedIds.includes(conv.id) }"
                @click="onTabClick(conv.id)">
                <input v-if="selectMode" type="checkbox" class="conv-checkbox" :checked="selectedIds.includes(conv.id)"
                    @click.stop @change="$emit('toggle-select', conv.id)" />
                <span class="conv-tab-title" :title="conv.title">{{ conv.title }}</span>
                <button v-if="!selectMode" class="conv-tab-close" title="关闭对话"
                    @click.stop="$emit('close', conv.id)">×</button>
            </div>
        </div>

        <div v-if="!conversations.length" class="conv-empty">暂无对话</div>
    </aside>
</template>

<style scoped>
.conv-sidebar {
    flex: 0 0 auto;
    width: 13.5rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-right: 0.0625rem solid var(--acu-border);
    background: var(--acu-bg);
}

.conv-sidebar-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;
    padding: clamp(0.5rem, 1.2vh, 0.75rem) clamp(0.5rem, 1vw, 0.75rem);
    border-bottom: 0.0625rem solid var(--acu-border);
}

.conv-sidebar-title {
    flex: 0 0 auto;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--acu-text-muted);
    white-space: nowrap;
}

.conv-sidebar-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
}

.conv-icon-btn,
.conv-new-btn {
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-secondary);
    background: transparent;
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.4375rem;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}

.conv-new-btn {
    font-size: 1rem;
    line-height: 1;
}

.conv-icon-btn svg {
    width: 0.875rem;
    height: 0.875rem;
}

.conv-icon-btn:hover,
.conv-new-btn:hover {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
    border-color: var(--acu-primary-soft);
}

.conv-icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
}

.conv-icon-btn:disabled:hover {
    color: var(--acu-text-secondary);
    background: transparent;
    border-color: var(--acu-border);
}

.conv-tabs {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    padding: 0.375rem;
}

.conv-tab {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.4375rem 0.5rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.18s ease;
    min-width: 0;
}

.conv-tab:hover {
    background: var(--acu-surface-2);
}

.conv-tab.active {
    background: var(--acu-primary-soft);
}

.conv-tab.selected {
    background: var(--acu-primary-soft-hover);
}

.conv-checkbox {
    flex: 0 0 auto;
    width: 0.875rem;
    height: 0.875rem;
    margin: 0;
    accent-color: var(--acu-primary);
    cursor: pointer;
}

.conv-tab-title {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: clamp(0.75rem, 0.7rem + 0.15vw, 0.8125rem);
    color: var(--acu-text-secondary);
}

.conv-tab.active .conv-tab-title,
.conv-tab.selected .conv-tab-title {
    color: var(--acu-primary);
    font-weight: 500;
}

.conv-tab-close {
    flex: 0 0 auto;
    width: 1.125rem;
    height: 1.125rem;
    display: grid;
    place-items: center;
    font-size: 0.875rem;
    line-height: 1;
    color: var(--acu-text-muted);
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.15s ease, background 0.15s ease;
}

.conv-tab:hover .conv-tab-close {
    opacity: 1;
}

.conv-tab-close:hover {
    color: var(--acu-error);
    background: var(--acu-error-soft);
}

.conv-empty {
    padding: 1rem;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
    text-align: center;
}

@media (max-width: 64rem) {
    .conv-sidebar {
        width: 12rem;
    }
}

@media (max-width: 48rem) {
    .conv-sidebar {
        width: 100%;
        max-height: 7.5rem;
        border-right: none;
        border-bottom: 0.0625rem solid var(--acu-border);
    }

    .conv-tabs {
        flex-direction: row;
        overflow-x: auto;
        overflow-y: hidden;
    }

    .conv-tab {
        flex: 0 0 auto;
        max-width: 10rem;
    }
}
</style>