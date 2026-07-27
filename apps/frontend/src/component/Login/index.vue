
<template>
    <div v-if="isShowLogin" class="fixed inset-0 bg-black opacity-30 filter blur-sm z-40"></div>
    <Transition name="fade">
      <div v-if="isShowLogin" class="fixed inset-30  flex items-center justify-center z-50">
        <div class="w-[1200px] h-[700px] bg-white rounded-[20px] shadow-2xl overflow-hidden flex">
            <!-- 左侧 3D 模型区域 -->
            <ModelViewer @changeType="changeType" ref="modelViewerRef" />
            
            <!-- 右侧登录表单区域 -->
            <div class="flex-1 flex flex-col justify-center px-12 py-10 bg-white">
                <LoginForm  v-if="loginType === 'login'" />
                <RegisterForm v-if="loginType === 'register'" />
            </div>
        </div>
    </div>
    </Transition>
</template>

<script setup lang="ts">
import ModelViewer from './ModelViewer.vue'
import LoginForm from './LoginForm.vue'
import RegisterForm from './RegisterForm.vue'
import { ref,inject,watch } from 'vue'
import { IS_SHOW_LOGIN } from './type.ts'
import type { LoginType } from './type.ts'

const isShowLogin = inject(IS_SHOW_LOGIN,ref(false))
const loginType = ref<LoginType>('login')

const changeType = (type: LoginType) => {
    loginType.value = type
}

window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      isShowLogin.value = false
    }
})
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>