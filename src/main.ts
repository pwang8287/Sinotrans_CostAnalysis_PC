import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import App from './App.vue'
import router from './router'
import './styles/tokens.css'
import './styles/global.css'

const app = createApp(App)
Object.entries(ElementPlusIconsVue).forEach(([name, component]) => app.component(name, component))
app.use(createPinia()).use(router).use(ElementPlus).mount('#app')
