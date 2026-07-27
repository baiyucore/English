import axios from "axios";
import { useUserStore } from "@/stores/user";
import { useRouter } from "vue-router";
import { refreshTokenApi } from "./auth";
import { ElMessage } from "element-plus";
export const timeout = 50000;
const router = useRouter()

let isRefreshing = false // 是否正在刷新令牌
let requestQueue: ((newAccessToken: string) => void)[] = [] // 请求队列

export const aiApi = axios.create({
  baseURL: '/ai/v1',
  timeout,
});

aiApi.interceptors.response.use(res => {
  return res.data;
})

export const serverApi = axios.create({
  baseURL: '/api/v1',
  timeout,
});


serverApi.interceptors.request.use(config => {
  const userStore = useUserStore()
  if (userStore.getAccessToken) {
    config.headers.Authorization = `Bearer ${userStore.getAccessToken}`
  }
  return config
})

serverApi.interceptors.response.use(res => {
  return res.data;
}, async error => {
  if(error.code === 'ERR_NETWORK'){
    ElMessage.error('网络错误')
    return Promise.reject(error)
  }
  if (error.response.status !== 401) {
    ElMessage.error('服务器错误')
    return Promise.reject(error)
  }
  const userStore = useUserStore()
  const refreshToken = userStore.getRefreshToken
  const accessToken = userStore.getAccessToken
  const originalRequest = error.config
  if (!accessToken || !refreshToken) {
    userStore.logout()
    ElMessage.error('登录过期')
    router.push('/')
    return Promise.reject(error)
  }
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      requestQueue.push((newAccessToken: string) => {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        resolve(serverApi(originalRequest))
      })
    })
  }
  isRefreshing = true
  try {
  const newToken = await refreshTokenApi({ refreshToken: refreshToken })
  if (newToken.success) {
    userStore.updateAccessToken(newToken.data)
  }
  else {
    userStore.logout()
    ElMessage.error('登录过期')
    router.push('/')
    return Promise.reject(error)
  }
  const newAccessToken = newToken.data.accessToken
  requestQueue.forEach(callback => callback(newAccessToken))
  return serverApi(originalRequest)
  } catch (error) {
    return Promise.reject(error)
  } finally {
    isRefreshing = false
    requestQueue = []
  }
})

export interface Response<T> {
  timestamp: string;
  path: string;
  message: string;
  code: number;
  success: boolean;
  data: T;
}