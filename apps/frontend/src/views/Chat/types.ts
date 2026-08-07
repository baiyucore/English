import type { ChatAssistantKey, ChatMessageList } from '@en/common/chat';

export type ConversationItem = {
  id: string;
  title: string;
  messages: ChatMessageList;
  assistantKey: ChatAssistantKey;
  updatedAt: number;
};
