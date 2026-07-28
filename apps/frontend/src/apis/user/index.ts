import { log } from 'three';
import { serverApi, type Response } from '..';
import type {
  UserLogin,
  UserRegister,
  WebResultUser,
  AvatarResult,
} from '@en/common/user';

export const login = (data: UserLogin) => {
  return serverApi.post('/user/login', data) as Promise<
    Response<WebResultUser>
  >;
};

export const register = (data: UserRegister) => {
  return serverApi.post('/user/register', data) as Promise<
    Response<WebResultUser>
  >;
};

export const uploadAvatar = (data: FormData) => {
  return serverApi.post('/user/upload-avatar', data) as Promise<
    Response<AvatarResult>
  >;
};
