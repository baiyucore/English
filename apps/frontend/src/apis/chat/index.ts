import { aiApi, type Response } from '..';
import type {
  ChatModeList,
  ChatRoleType,
  ChatMessageList,
} from '@en/common/chat';

export const getChatMode = () => {
  return aiApi.get('/prompt') as Promise<Response<ChatModeList>>;
};

export const getChatHistory = (userId: string, role: ChatRoleType) => {
  return aiApi.get(`/chat/history?userId=${userId}&role=${role}`) as Promise<
    Response<ChatMessageList>
  >;
};
