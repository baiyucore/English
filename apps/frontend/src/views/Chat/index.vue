<template>
  <div class="flex h-[calc(100vh-5rem)] w-full overflow-hidden">
    <Conversations
      :conversations="conversations"
      :active-id="activeConversationId"
      @on-new-chat="startNewChat"
      @on-select-conversation="selectConversation"
      @on-delete-conversation="deleteConversation"
    />
    <Bubble
      :list="list"
      :is-streaming="isStreaming"
      @on-send-message="sendMessage"
      @on-abort="abortMessage"
    />
  </div>
</template>
<script setup lang="ts">
import Conversations from './components/Conversations.vue';
import Bubble from './components/Bubble.vue';
import { sse, fetchSse, CHAT_URL } from '@/apis/sse';
import { useUserStore } from '@/stores/user';
import { onMounted, ref, computed } from 'vue';
import type {
  ChatAssistantKey,
  ChatMessageList,
  ChatStreamEvent,
} from '@en/common/chat';
import {
  createChatAssistant,
  getChatAssistants,
  getChatHistory,
  removeChatAssistant,
} from '@/apis/chat';
import type { ConversationItem } from './types';

/** 测试开关：'library' 用 fetch-event-source，'custom' 用自研 fetchSse */
const SSE_IMPL = 'custom' as 'library' | 'custom';

const userStore = useUserStore();
const conversations = ref<ConversationItem[]>([]);
const activeConversationId = ref<string | null>(null);
const list = ref<ChatMessageList>([]);
const userId = computed(() =>
  userStore.isLoggedIn ? userStore.user?.id : undefined,
);
const assistantKey = ref<ChatAssistantKey>('');
const isStreaming = ref(false);
let abortController: AbortController | null = null;

const getActiveConversation = () => {
  if (!activeConversationId.value) return null;
  return conversations.value.find(
    (item) => item.id === activeConversationId.value,
  );
};

const syncListFromActiveConversation = () => {
  const activeConversation = getActiveConversation();
  list.value = activeConversation ? [...activeConversation.messages] : [];
};

const isApiOk = <T,>(res: { code?: number; data?: T } | null | undefined) => {
  return res?.code === 200;
};

const loadConversations = async () => {
  if (!userId.value) return;

  try {
    const res = await getChatAssistants();
    if (!isApiOk(res) || !Array.isArray(res.data)) return;

    conversations.value = res.data.map((item) => ({
      id: item.id,
      title: item.title || '新聊天',
      messages: [],
      assistantKey: item.assistantKey || item.id,
      updatedAt: Date.parse(item.updatedAt) || Date.now(),
    }));
  } catch (error) {
    console.error(error);
  }
};

const createConversationTitle = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return '新聊天';
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}...` : trimmed;
};

const startNewChat = () => {
  if (isStreaming.value) return;
  activeConversationId.value = null;
  assistantKey.value = '';
  list.value = [];
};

const loadConversationHistory = async (conversation: ConversationItem) => {
  if (!userId.value) return;

  try {
    const res = await getChatHistory(conversation.id);
    if (!isApiOk(res) || !Array.isArray(res.data)) return;

    conversation.messages = res.data.map((item) => ({
      role: item.role === 'ai' ? 'ai' : 'human',
      content:
        typeof item.content === 'string'
          ? item.content
          : String(item.content ?? ''),
    }));

    const firstHuman = conversation.messages.find(
      (item) => item.role === 'human' && item.content.trim(),
    );
    if (firstHuman) {
      conversation.title = createConversationTitle(firstHuman.content);
    }

    if (activeConversationId.value === conversation.id) {
      list.value = [...conversation.messages];
    }
  } catch (error) {
    console.error(error);
  }
};

const selectConversation = async (id: string) => {
  if (isStreaming.value) return;

  const conversation = conversations.value.find((item) => item.id === id);
  if (!conversation) return;

  activeConversationId.value = id;
  assistantKey.value = conversation.assistantKey || id;
  syncListFromActiveConversation();
  await loadConversationHistory(conversation);
};

const deleteConversation = async (id: string) => {
  if (isStreaming.value || !userId.value) return;

  const index = conversations.value.findIndex((item) => item.id === id);
  if (index === -1) return;

  try {
    const res = await removeChatAssistant(id);
    if (!isApiOk(res)) return;
  } catch (error) {
    console.error(error);
    return;
  }

  conversations.value.splice(index, 1);

  if (activeConversationId.value !== id) return;

  const nextConversation = conversations.value[0];
  if (nextConversation) {
    void selectConversation(nextConversation.id);
    return;
  }

  startNewChat();
};

const finishStreaming = () => {
  isStreaming.value = false;
  abortController = null;
};

const appendDelta = (data: ChatStreamEvent) => {
  if (data.type === 'done') {
    finishStreaming();
    return;
  }
  if (data.type === 'error') {
    const last = list.value[list.value.length - 1];
    if (last?.role === 'ai' && !last.content) {
      last.content = data.error || 'AI 回复失败';
    }
    const activeConversation = getActiveConversation();
    if (activeConversation) {
      activeConversation.messages = [...list.value];
    }
    finishStreaming();
    return;
  }
  if (data.type !== 'delta') return;
  list.value[list.value.length - 1]!.content += data.content;

  const activeConversation = getActiveConversation();
  if (activeConversation) {
    activeConversation.messages = [...list.value];
  }
};

const abortMessage = () => {
  abortController?.abort();
  finishStreaming();
};

const ensureActiveConversation = async (message: string) => {
  const activeConversation = getActiveConversation();
  if (activeConversation) return activeConversation;
  if (!userId.value) {
    throw new Error('用户未登录');
  }

  const res = await createChatAssistant(message);
  if (!isApiOk(res) || !res.data?.id) {
    throw new Error(res?.message || '创建会话失败');
  }
  const id = res.data.id;

  const conversation: ConversationItem = {
    id,
    title: res.data.title || createConversationTitle(message),
    messages: [],
    assistantKey: res.data.assistantKey || id,
    updatedAt: Date.parse(res.data.updatedAt) || Date.now(),
  };

  conversations.value.push(conversation);
  activeConversationId.value = conversation.id;
  assistantKey.value = id;
  return conversation;
};

const sendMessage = async (message: string) => {
  if (isStreaming.value) return;

  let conversation: ConversationItem;
  try {
    conversation = await ensureActiveConversation(message);
  } catch (error) {
    console.error(error);
    return;
  }

  list.value.push({
    role: 'human',
    content: message,
  });
  list.value.push({
    role: 'ai',
    content: '',
  });

  const activeConversation = getActiveConversation();
  if (activeConversation) {
    activeConversation.messages = [...list.value];
  }

  const payload = {
    assistantKey: conversation.assistantKey,
    conversationId: conversation.id,
    content: message,
  };

  abortController = new AbortController();
  isStreaming.value = true;

  if (SSE_IMPL === 'library') {
    sse<ChatStreamEvent>(
      CHAT_URL,
      'POST',
      payload,
      appendDelta,
      (error) => {
        console.error(error);
        finishStreaming();
      },
      abortController.signal,
    );
    return;
  }

  fetchSse<ChatStreamEvent>({
    url: CHAT_URL,
    body: payload,
    signal: abortController.signal,
    onMessage: appendDelta,
    onError: (error) => {
      console.error(error);
      finishStreaming();
    },
    onDone: finishStreaming,
  });
};

onMounted(async () => {
  await loadConversations();

  const firstConversation = conversations.value[0];
  if (firstConversation) {
    void selectConversation(firstConversation.id);
  }
});
</script>
