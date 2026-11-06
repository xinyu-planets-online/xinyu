import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import Home from './Home.vue'
import Mindfulness from './Mindfulness.vue'
import router from './router'

const path = location.pathname
const isHome = path === '/home'
const isMindful = path === '/mindfulness'

const Root = isHome ? Home : isMindful ? Mindfulness : App
const app = createApp(Root)

app.use(createPinia())
app.use(router)

app.mount('#app')