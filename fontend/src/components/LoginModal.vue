<template>
    <Teleport to="body">
        <transition name="lm">
            <div v-if="show" class="lm-mask" @click.self="onCancel">
                <div class="lm-panel" role="dialog" aria-modal="true">
                    <header class="lm-header">
                        <h2 class="lm-title">{{ status === 'logged-in' ? '账户' : '登录' }}</h2>
                        <button class="lm-close" aria-label="关闭" @click="onCancel">
                            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                <path d="M5 5L13 13M13 5L5 13" stroke="currentColor" stroke-width="1.6"
                                    stroke-linecap="round" />
                            </svg>
                        </button>
                    </header>

                    <div class="lm-body">
                        <p v-if="status === 'checking'" class="lm-status">检测登录状态…</p>

                        <template v-else-if="status === 'logged-in'">
                            <p class="lm-status lm-status-ok">已登录</p>
                            <p v-if="error" class="lm-error">{{ error }}</p>
                            <div class="lm-actions">
                                <button class="lm-btn-ghost" @click="onCancel">关闭</button>
                                <button class="lm-btn-primary" :disabled="busy" @click="doLogout">
                                    {{ busy ? '处理中…' : '登出' }}
                                </button>
                            </div>
                        </template>

                        <template v-else>
                            <label class="lm-field">
                                <span class="lm-label">用户名</span>
                                <input v-model="username" class="lm-input" autocomplete="username" spellcheck="false" />
                            </label>
                            <label class="lm-field">
                                <span class="lm-label">密码</span>
                                <input v-model="password" type="password" class="lm-input"
                                    autocomplete="current-password" spellcheck="false" />
                            </label>
                            <p v-if="error" class="lm-error">{{ error }}</p>
                            <div class="lm-actions">
                                <button class="lm-btn-ghost" @click="onCancel">取消</button>
                                <button class="lm-btn-primary" :disabled="busy" @click="doLogin">
                                    {{ busy ? '登录中…' : '登录' }}
                                </button>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
    show: { type: Boolean, default: false },
    // 传入时先探测，根据结果决定显示登录表单还是已登录态；为空则直接显示登录表单
    probeUrl: { type: String, default: '' },
    defaultUsername: { type: String, default: '' },
    defaultPassword: { type: String, default: '' },
    loginUrl: { type: String, default: '/v1/auth/login' },
    logoutUrl: { type: String, default: '/v1/auth/logout' },
})

const emit = defineEmits(['close', 'login-success', 'logout-success', 'changed'])

const status = ref('checking')   // checking | logged-in | logged-out | error
const username = ref(props.defaultUsername)
const password = ref(props.defaultPassword)
const busy = ref(false)
const error = ref('')

async function probe() {
    if (!props.probeUrl) {
        status.value = 'logged-out'
        return
    }
    status.value = 'checking'
    error.value = ''
    try {
        const r = await fetch(props.probeUrl, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
        })
        if (r.status === 401) { status.value = 'logged-out'; return }
        if (!r.ok) {
            status.value = 'error'
            error.value = `探测失败：HTTP ${r.status}`
            return
        }
        try {
            const expected = new URL(props.probeUrl, location.origin)
            const finalUrl = new URL(r.url, location.origin)
            if (finalUrl.pathname !== expected.pathname) { status.value = 'logged-out'; return }
        } catch { status.value = 'logged-out'; return }

        const ct = (r.headers.get('Content-Type') || '').toLowerCase()
        if (!ct.includes('application/json')) { status.value = 'logged-out'; return }

        let info
        try { info = await r.json() } catch { status.value = 'logged-out'; return }
        if (!info || typeof info !== 'object' || typeof info.exists !== 'boolean') {
            status.value = 'logged-out'
            return
        }
        status.value = 'logged-in'
    } catch (e) {
        status.value = 'error'
        error.value = e?.message || '网络错误'
    }
}

async function doLogin() {
    error.value = ''
    if (!username.value || !password.value) {
        error.value = '请输入用户名和密码'
        return
    }
    busy.value = true
    try {
        const r = await fetch(props.loginUrl, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username.value, password: password.value }),
        })
        if (!r.ok) {
            const data = await r.json().catch(() => null)
            error.value = data?.message || `登录失败：HTTP ${r.status}`
            return
        }
        status.value = 'logged-in'
        password.value = ''
        emit('login-success')
        emit('changed', 'logged-in')
        onCancel()
    } catch (e) {
        error.value = e?.message || '网络错误'
    } finally {
        busy.value = false
    }
}

async function doLogout() {
    busy.value = true
    error.value = ''
    try {
        const r = await fetch(props.logoutUrl, { method: 'POST', credentials: 'include' })
        if (r.status !== 204 && r.status !== 200) {
            error.value = `登出失败：HTTP ${r.status}`
            return
        }
        status.value = 'logged-out'
        emit('logout-success')
        emit('changed', 'logged-out')
    } catch (e) {
        error.value = e?.message || '网络错误'
    } finally {
        busy.value = false
    }
}

function onCancel() { emit('close') }

watch(() => props.show, (v) => {
    if (!v) return
    error.value = ''
    busy.value = false
    if (props.probeUrl) probe()
    else status.value = 'logged-out'
}, { immediate: true })
</script>

<style scoped>
.lm-mask {
    position: fixed;
    inset: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(2px);
}

.lm-panel {
    width: min(24rem, 100%);
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 1rem;
    box-shadow: var(--acu-shadow-lg);
    overflow: hidden;
}

.lm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    border-bottom: 1px solid var(--acu-border);
}

.lm-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--acu-text);
}

.lm-close {
    width: 1.75rem;
    height: 1.75rem;
    display: grid;
    place-items: center;
    color: var(--acu-text-muted);
    background: transparent;
    border: 1px solid var(--acu-border);
    border-radius: 0.4375rem;
    cursor: pointer;
}

.lm-close svg {
    width: 1rem;
    height: 1rem;
}

.lm-close:hover {
    color: var(--acu-text);
    background: var(--acu-surface-2);
}

.lm-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
}

.lm-field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
}

.lm-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--acu-text-secondary);
}

.lm-input {
    height: 2.375rem;
    padding: 0 0.75rem;
    font-family: inherit;
    font-size: 0.8125rem;
    color: var(--acu-text);
    background: var(--acu-bg);
    border: 1px solid var(--acu-border);
    border-radius: 0.5rem;
    outline: none;
}

.lm-input:focus {
    border-color: var(--acu-primary);
    box-shadow: 0 0 0 3px var(--acu-primary-soft);
}

.lm-error {
    margin: 0;
    font-size: 0.75rem;
    color: var(--acu-error);
}

.lm-status {
    margin: 0;
    font-size: 0.875rem;
    color: var(--acu-text-secondary);
}

.lm-status-ok {
    color: var(--acu-success);
}

.lm-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    padding-top: 0.25rem;
}

.lm-btn-primary,
.lm-btn-ghost {
    height: 2.25rem;
    padding: 0 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 0.5rem;
    cursor: pointer;
}

.lm-btn-primary {
    color: var(--acu-primary-contrast);
    background: var(--acu-primary);
    border: 1px solid var(--acu-primary);
}

.lm-btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.lm-btn-ghost {
    color: var(--acu-text-secondary);
    background: transparent;
    border: 1px solid var(--acu-border);
}

.lm-btn-ghost:hover {
    color: var(--acu-text);
    background: var(--acu-surface);
}

.lm-enter-active,
.lm-leave-active {
    transition: opacity 0.2s ease;
}

.lm-enter-from,
.lm-leave-to {
    opacity: 0;
}
</style>