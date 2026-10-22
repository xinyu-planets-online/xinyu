<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
    conversation: { type: Object, required: true },
    currentLeafId: { type: String, default: null },
    visible: { type: Boolean, default: false },
})

const emit = defineEmits(['switch-node', 'revert', 'edit', 'regenerate', 'update:visible'])

const editingNodeId = ref(null)
const editingContent = ref('')

const flatTree = computed(() => {
    const nodes = props.conversation?.nodes || {}
    const roots = []
    const childrenMap = new Map()
    for (const node of Object.values(nodes)) {
        if (node.parentId == null) roots.push(node)
        else {
            if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, [])
            childrenMap.get(node.parentId).push(node)
        }
    }
    for (const arr of childrenMap.values()) arr.sort((a, b) => a.createdAt - b.createdAt)
    roots.sort((a, b) => a.createdAt - b.createdAt)

    const currentPath = new Set()
    let cur = props.currentLeafId
    const guard = new Set()
    while (cur && nodes[cur] && !guard.has(cur)) {
        guard.add(cur)
        currentPath.add(cur)
        cur = nodes[cur].parentId
    }

    const result = []
    function dfs(node, depth) {
        const siblings = node.parentId == null ? roots : (childrenMap.get(node.parentId) || [])
        const index = siblings.findIndex(s => s.id === node.id)
        result.push({
            node, depth,
            onPath: currentPath.has(node.id),
            siblingIndex: index + 1,
            siblingCount: siblings.length,
        })
        const children = childrenMap.get(node.id) || []
        children.forEach(c => dfs(c, depth + 1))
    }
    roots.forEach(r => dfs(r, 0))
    return result
})

function preview(content) {
    if (!content) return '(空)'
    const t = content.trim().replace(/\s+/g, ' ')
    return t.length > 28 ? t.slice(0, 28) + '…' : t
}

function startEdit(node) {
    editingNodeId.value = node.id
    editingContent.value = node.content
}
function saveEdit() {
    if (editingNodeId.value && editingContent.value.trim()) {
        emit('edit', { nodeId: editingNodeId.value, content: editingContent.value })
    }
    cancelEdit()
}
function cancelEdit() {
    editingNodeId.value = null
    editingContent.value = ''
}
</script>

<template>
    <div class="tree-panel" v-show="visible">
        <div class="tree-header">
            <span class="tree-title">对话树</span>
            <button class="tree-close" @click="$emit('update:visible', false)" title="隐藏">×</button>
        </div>
        <div class="tree-body">
            <div v-if="!flatTree.length" class="tree-empty">还没有消息</div>
            <div v-for="item in flatTree" :key="item.node.id" class="tree-node" :class="{
                'on-path': item.onPath,
                'role-user': item.node.role === 'user',
                'role-assistant': item.node.role === 'assistant',
            }" :style="{ paddingLeft: (item.depth * 16 + 8) + 'px' }"
                @click="!editingNodeId && $emit('switch-node', item.node.id)">
                <span class="tree-dot" />
                <span class="tree-role">{{ item.node.role === 'user' ? '问' : '答' }}</span>

                <template v-if="editingNodeId === item.node.id">
                    <div class="tree-edit">
                        <textarea v-model="editingContent" rows="2" @click.stop />
                        <div class="tree-edit-actions">
                            <button @click.stop="saveEdit">保存</button>
                            <button @click.stop="cancelEdit">取消</button>
                        </div>
                    </div>
                </template>
                <template v-else>
                    <span class="tree-preview" :title="item.node.content">{{ preview(item.node.content) }}</span>
                    <span v-if="item.siblingCount > 1" class="tree-branch-count">
                        {{ item.siblingIndex }}/{{ item.siblingCount }}
                    </span>
                    <div class="tree-actions">
                        <button v-if="item.node.role === 'user'" title="修改"
                            @click.stop="startEdit(item.node)">✎</button>
                        <button v-if="item.node.role === 'user'" title="撤回此消息及之后"
                            @click.stop="$emit('revert', item.node.id)">⊖</button>
                        <button v-if="item.node.role === 'assistant'" title="重新生成"
                            @click.stop="$emit('regenerate', item.node.id)">↻</button>
                    </div>
                </template>
            </div>
        </div>
    </div>
</template>

<style scoped>
.tree-panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 22rem;
    max-width: 90vw;
    z-index: 45;
    display: flex;
    flex-direction: column;
    background: var(--acu-bg);
    border-left: 0.0625rem solid var(--acu-border);
    box-shadow: var(--drawer-shadow);
}

.tree-header {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    border-bottom: 0.0625rem solid var(--acu-border);
}

.tree-title {
    font-size: 0.8125rem;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--acu-text-muted);
}

.tree-close {
    width: 1.5rem;
    height: 1.5rem;
    display: grid;
    place-items: center;
    font-size: 1rem;
    line-height: 1;
    color: var(--acu-text-muted);
    background: transparent;
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.375rem;
    cursor: pointer;
}

.tree-close:hover {
    color: var(--acu-error);
    background: var(--acu-error-soft);
    border-color: var(--acu-error-soft);
}

.tree-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    padding: 0.375rem 0;
}

.tree-empty {
    padding: 1rem;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
    text-align: center;
}

.tree-node {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
    padding-right: 0.5rem;
    cursor: pointer;
    border-left: 0.125rem solid transparent;
    transition: background 0.15s ease, border-color 0.15s ease;
    min-width: 0;
}

.tree-node:hover {
    background: var(--acu-surface-2);
}

.tree-node.on-path {
    background: var(--acu-primary-soft);
    border-left-color: var(--acu-primary);
}

.tree-dot {
    flex: 0 0 auto;
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 50%;
    background: var(--acu-border-strong);
}

.tree-node.on-path .tree-dot {
    background: var(--acu-primary);
}

.tree-role {
    flex: 0 0 auto;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--acu-text-muted);
}

.tree-node.on-path .tree-role {
    color: var(--acu-primary);
}

.tree-preview {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.75rem;
    color: var(--acu-text-secondary);
}

.tree-node.on-path .tree-preview {
    color: var(--acu-text);
}

.tree-branch-count {
    flex: 0 0 auto;
    padding: 0.0625rem 0.375rem;
    font-size: 0.625rem;
    color: var(--acu-primary);
    background: var(--acu-primary-soft-hover);
    border-radius: 0.25rem;
}

.tree-actions {
    flex: 0 0 auto;
    display: flex;
    gap: 0.125rem;
    opacity: 0;
    transition: opacity 0.15s ease;
}

.tree-node:hover .tree-actions {
    opacity: 1;
}

.tree-actions button {
    width: 1.25rem;
    height: 1.25rem;
    display: grid;
    place-items: center;
    font-size: 0.75rem;
    color: var(--acu-text-muted);
    background: transparent;
    border: none;
    border-radius: 0.25rem;
    cursor: pointer;
}

.tree-actions button:hover {
    color: var(--acu-primary);
    background: var(--acu-primary-soft);
}

.tree-edit {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}

.tree-edit textarea {
    width: 100%;
    box-sizing: border-box;
    font-size: 0.75rem;
    font-family: inherit;
    padding: 0.25rem 0.375rem;
    border: 0.0625rem solid var(--acu-border-strong);
    border-radius: 0.375rem;
    background: var(--acu-bg);
    color: var(--acu-text);
    resize: vertical;
}

.tree-edit-actions {
    display: flex;
    gap: 0.25rem;
}

.tree-edit-actions button {
    padding: 0.1875rem 0.625rem;
    font-size: 0.6875rem;
    color: var(--acu-text-secondary);
    background: var(--acu-surface-2);
    border: 0.0625rem solid var(--acu-border);
    border-radius: 0.375rem;
    cursor: pointer;
}

.tree-edit-actions button:hover {
    color: var(--acu-primary);
    border-color: var(--acu-primary-soft);
}

@media (max-width: 48rem) {
    .tree-panel {
        width: 100vw;
    }
}
</style>