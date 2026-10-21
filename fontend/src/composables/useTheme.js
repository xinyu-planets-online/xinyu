import { ref, computed, watch } from 'vue'

const THEME_KEY = 'chat-theme-mode'

export function useTheme() {
    const themeMode = ref(
        (() => {
            try {
                const saved = localStorage.getItem(THEME_KEY)
                return saved === 'light' || saved === 'dark' || saved === 'auto' ? saved : 'auto'
            } catch {
                return 'auto'
            }
        })()
    )
    const systemDark = ref(false)
    let mql = null

    const resolvedTheme = computed(() =>
        themeMode.value === 'auto' ? (systemDark.value ? 'dark' : 'light') : themeMode.value
    )
    const themeLabel = computed(() =>
        themeMode.value === 'auto' ? '系统' : themeMode.value === 'dark' ? '深色' : '浅色'
    )

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme)
        document.body.setAttribute('data-theme', theme)
        document.documentElement.style.colorScheme = theme
        document.body.style.colorScheme = theme
    }

    function cycleTheme() {
        themeMode.value =
            themeMode.value === 'auto' ? 'light' : themeMode.value === 'light' ? 'dark' : 'auto'
    }

    function onSchemeChange(e) {
        systemDark.value = e.matches
    }

    watch(themeMode, (val) => {
        try {
            localStorage.setItem(THEME_KEY, val)
        } catch (e) {
            console.warn('[theme] 保存失败', e)
        }
    })

    watch(() => resolvedTheme.value, (theme) => applyTheme(theme))

    function init() {
        mql = window.matchMedia('(prefers-color-scheme: dark)')
        systemDark.value = mql.matches
        mql.addEventListener('change', onSchemeChange)
        applyTheme(resolvedTheme.value)
    }

    function destroy() {
        mql?.removeEventListener('change', onSchemeChange)
    }

    return { themeMode, resolvedTheme, themeLabel, cycleTheme, init, destroy }
}