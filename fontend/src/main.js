import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import Home from './Home.vue'
import Mindfulness from './Mindfulness.vue'

function resolveRoot() {
    const seg = location.hash.replace(/^#\/?/, '').replace(/\/+$/, '')
    if (seg === 'home') return Home
    if (seg === 'mindfulness') return Mindfulness
    return App
}

let app = null

function mount() {
    if (app) {
        app.unmount()
        app = null
    }
    app = createApp(resolveRoot())
    app.use(createPinia())
    app.mount('#app')
}

mount()

window.addEventListener('hashchange', mount)