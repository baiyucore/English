import { aiApi, type Response } from '..';
import type {
  ChatConversation,
  ChatConversationList,
  ChatMessageList,
} from '@en/common/chat';

export const getChatAssistants = () => {
  return aiApi.get('/prompt') as Promise<Response<ChatConversationList>>;
};

export const createChatAssistant = (title?: string) => {
  const params = new URLSearchParams();
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    params.set('title', trimmedTitle);
  }
  return aiApi.post(`/prompt?${params.toString()}`) as Promise<
    Response<ChatConversation>
  >;
};

export const removeChatAssistant = (id: string) => {
  return aiApi.delete(`/prompt/${encodeURIComponent(id)}`) as Promise<
    Response<ChatConversation>
  >;
};

export const searchChatConversations = (keyword: string) => {
  const params = new URLSearchParams();
  const trimmed = keyword.trim();
  if (trimmed) {
    params.set('keyword', trimmed);
  }
  return aiApi.get(`/prompt/search?${params.toString()}`) as Promise<
    Response<ChatConversationList>
  >;
};

export const getChatHistory = (conversationId: string) => {
  return aiApi.get(
    `/chat/history?conversationId=${encodeURIComponent(conversationId)}`,
  ) as Promise<Response<ChatMessageList>>;
};
