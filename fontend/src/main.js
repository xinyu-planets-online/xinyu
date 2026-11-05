import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import Home from './Home.vue'
import router from './router'

const isHome = location.pathname === '/home'
const app = createApp(isHome ? Home : App)

app.use(createPinia())
app.use(router)

app.mount('#app')
