import { IS_SHOW_LOGIN } from '../component/Login/type';
import { inject, ref } from 'vue';
import { useUserStore } from '../stores/user';

export const useLogin = () => {
  const isShowLogin = inject(IS_SHOW_LOGIN, ref(false));
  const userStore = useUserStore();
  const login = () => {
    return new Promise((resolve, reject) => {
      if (userStore.isLoggedIn) {
        resolve(true);
      } else {
        isShowLogin.value = true;
        reject(false);
      }
    });
  };
  const hide = () => {
    isShowLogin.value = false;
  };
  return {
    login,
    hide,
  };
};
