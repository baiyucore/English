import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';
import { useUserStore } from '@/stores/user';
import router from '@/router';
import { refreshTokenApi } from './auth';
import { ElMessage } from 'element-plus';

export const timeout = 50000;

type QueueItem = {
  resolve: (token: string) => void;
  reject: (reason?: unknown) => void;
};

let isRefreshing = false;
let refreshQueue: QueueItem[] = [];

const attachAccessToken = (config: InternalAxiosRequestConfig) => {
  const userStore = useUserStore();
  if (userStore.getAccessToken) {
    config.headers.Authorization = `Bearer ${userStore.getAccessToken}`;
  }
  return config;
};

const forceLogout = (message = '登录过期') => {
  const userStore = useUserStore();
  userStore.logout();
  ElMessage.error(message);
  void router.push('/');
};

const flushRefreshQueue = (error: unknown, token?: string) => {
  const queue = refreshQueue;
  refreshQueue = [];
  for (const item of queue) {
    if (token) item.resolve(token);
    else item.reject(error);
  }
};

/** 用 refresh token 换新的 access token；失败会登出并返回 null */
export const refreshAccessToken = async (): Promise<string | null> => {
  const userStore = useUserStore();
  const refreshToken = userStore.getRefreshToken;
  if (!refreshToken) {
    forceLogout();
    return null;
  }

  try {
    const newToken = await refreshTokenApi({ refreshToken });
    if (!newToken.success || !newToken.data?.accessToken) {
      forceLogout();
      return null;
    }
    userStore.updateAccessToken(newToken.data);
    return newToken.data.accessToken;
  } catch {
    forceLogout();
    return null;
  }
};

const attachAuthResponseInterceptor = (client: AxiosInstance) => {
  client.interceptors.response.use(
    (res) => res.data,
    async (error) => {
      if (error.code === 'ERR_NETWORK') {
        ElMessage.error('网络错误');
        return Promise.reject(error);
      }

      const status = error.response?.status;
      if (status !== 401) {
        ElMessage.error('服务器错误');
        return Promise.reject(error);
      }

      const userStore = useUserStore();
      const refreshToken = userStore.getRefreshToken;
      const accessToken = userStore.getAccessToken;
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      if (!accessToken || !refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      if (originalRequest?._retry) {
        forceLogout();
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((newAccessToken) => {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return client(originalRequest);
        });
      }

      isRefreshing = true;
      try {
        const newAccessToken = await refreshAccessToken();
        if (!newAccessToken) {
          flushRefreshQueue(error);
          return Promise.reject(error);
        }
        flushRefreshQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        flushRefreshQueue(refreshError);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    },
  );
};

export const aiApi = axios.create({
  baseURL: '/ai/v1',
  timeout,
});

aiApi.interceptors.request.use(attachAccessToken);
attachAuthResponseInterceptor(aiApi);

export const serverApi = axios.create({
  baseURL: '/api/v1',
  timeout,
});

serverApi.interceptors.request.use(attachAccessToken);
attachAuthResponseInterceptor(serverApi);

export interface Response<T> {
  timestamp: string;
  path: string;
  message: string;
  code: number;
  success: boolean;
  data: T;
}
