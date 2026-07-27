import '@/assets/base.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router/index.ts'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import focusPlugin from './directives/focus.ts'
const app = createApp(App) 
const pinia = createPinia() // 创建 pinia 实例
pinia.use(piniaPluginPersistedstate) // 使用 pinia-plugin-persistedstate 插件
app.use(ElementPlus, { locale: zhCn } ) // 使用 ElementPlus
app.use(router) // 使用 router
app.use(pinia) // 使用 pinia
app.use(focusPlugin) // 使用 focus
app.mount('#app') // 挂载 app
