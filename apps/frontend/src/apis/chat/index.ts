import { aiApi, type Response } from '..';
import type {
  ChatConversation,
  ChatConversationList,
  ChatMessageList,
} from '@en/common/chat';

export const getChatAssistants = (userId: string) => {
  return aiApi.get(`/prompt?userId=${encodeURIComponent(userId)}`) as Promise<
    Response<ChatConversationList>
  >;
};

export const createChatAssistant = (userId: string, title?: string) => {
  const params = new URLSearchParams({ userId });
  const trimmedTitle = title?.trim();
  if (trimmedTitle) {
    params.set('title', trimmedTitle);
  }
  return aiApi.post(`/prompt?${params.toString()}`) as Promise<
    Response<ChatConversation>
  >;
};

export const removeChatAssistant = (id: string, userId: string) => {
  return aiApi.delete(
    `/prompt/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`,
  ) as Promise<Response<ChatConversation>>;
};

export const searchChatConversations = (userId: string, keyword: string) => {
  const params = new URLSearchParams({ userId });
  const trimmed = keyword.trim();
  if (trimmed) {
    params.set('keyword', trimmed);
  }
  return aiApi.get(`/prompt/search?${params.toString()}`) as Promise<
    Response<ChatConversationList>
  >;
};

export const getChatHistory = (conversationId: string, userId: string) => {
  return aiApi.get(
    `/chat/history?conversationId=${encodeURIComponent(conversationId)}&userId=${encodeURIComponent(userId)}`,
  ) as Promise<Response<ChatMessageList>>;
};
