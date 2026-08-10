import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { Token, WebResultUser, UserUpdate } from '@en/common/user';

/** 仅用于前端判断登录态；不验证签名 */
function getJwtExpMs(token: string): number | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenAlive(token: string | undefined | null): boolean {
  if (!token) return false;
  const expMs = getJwtExpMs(token);
  if (expMs == null) return false;
  return expMs > Date.now();
}

export const useUserStore = defineStore(
  'user',
  () => {
    const user = ref<WebResultUser | null>(null);
    const setUser = (params: WebResultUser) => {
      user.value = params;
    };

    const getAccessToken = computed(() => user.value?.token.accessToken);
    const getRefreshToken = computed(() => user.value?.token.refreshToken);
    const updateAccessToken = (newToken: Token) => {
      if (!user.value) return;
      user.value.token = newToken;
    };

    /** refresh 仍有效则视为已登录（access 过期可由拦截器续期） */
    const isLoggedIn = computed(() => {
      if (!user.value) return false;
      return isTokenAlive(user.value.token.refreshToken);
    });

    /** 清除已过期的本地会话，使 UI 与 token 生命周期一致 */
    const syncAuthState = () => {
      if (!user.value) return;
      if (!isTokenAlive(user.value.token.refreshToken)) {
        user.value = null;
      }
    };

    const getUser = computed(() => user.value);
    const updateUser = (params: UserUpdate) => {
      if (!user.value) return;
      user.value.name = params.name;
      user.value.email = params.email;
      user.value.address = params.address;
      user.value.avatar = params.avatar;
      user.value.bio = params.bio;
      user.value.isTimingTask = params.isTimingTask;
      user.value.timingTaskTime = params.timingTaskTime;
    };
    const getUpdateUserInfo = computed<UserUpdate>(() => {
      return {
        name: user.value!.name,
        email: user.value!.email,
        address: user.value!.address,
        bio: user.value!.bio,
        isTimingTask: user.value!.isTimingTask,
        timingTaskTime: user.value!.timingTaskTime,
        avatar: user.value!.avatar,
      };
    });
    const logout = () => {
      user.value = null;
    };
    return {
      user,
      setUser,
      getUser,
      logout,
      getAccessToken,
      getRefreshToken,
      updateAccessToken,
      getUpdateUserInfo,
      updateUser,
      isLoggedIn,
      syncAuthState,
    };
  },
  {
    persist: {
      afterHydrate: (ctx) => {
        ctx.store.syncAuthState();
      },
    },
  },
);
