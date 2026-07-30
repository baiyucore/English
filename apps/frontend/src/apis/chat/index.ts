import { aiApi, type Response } from '..';
import type {
  ChatAssistantList,
  ChatMessageList,
} from '@en/common/chat';

export const getChatAssistants = () => {
  return aiApi.get('/prompt') as Promise<Response<ChatAssistantList>>;
};

export const getChatMode = getChatAssistants;

export const getChatHistory = (conversationId: string) => {
  return aiApi.get(
    `/chat/history?conversationId=${encodeURIComponent(conversationId)}`,
  ) as Promise<Response<ChatMessageList>>;
};
