import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Token, WebResultUser, UserUpdate } from '@en/common/user'
export const useUserStore = defineStore('user', () => {
  const user = ref<WebResultUser | null>(null) //用户信息
  const setUser = (params: WebResultUser) => {
    user.value = params //设置用户信息
  }

  const getAccessToken = computed(() => user.value?.token.accessToken)
  const getRefreshToken = computed(() => user.value?.token.refreshToken)
  const updateAccessToken = (newToken: Token) => {
    user.value!.token = newToken
  }
   //获取用户信息
   const getUser = computed(() => user.value) 
   //更新用户信息
   const updateUser = (params: UserUpdate) => {
     user.value!.name = params.name
     user.value!.email = params.email
     user.value!.address = params.address
     user.value!.avatar = params.avatar
     user.value!.bio = params.bio
     user.value!.isTimingTask = params.isTimingTask
     user.value!.timingTaskTime = params.timingTaskTime
   }
   //返回需要更新的用户信息
   const getUpdateUserInfo = computed<UserUpdate>(() => {
     return {
       name: user.value!.name,
       email: user.value!.email,
       address: user.value!.address,
       bio: user.value!.bio,
       isTimingTask: user.value!.isTimingTask,
       timingTaskTime: user.value!.timingTaskTime,
       avatar: user.value!.avatar
     }
   })
   //退出登录
   const logout = () => {
     user.value = null 
   }
  return { user, setUser, getUser, logout, getAccessToken, getRefreshToken, updateAccessToken ,getUpdateUserInfo, updateUser}
}, { persist: true }) //持久化存储localStorage
