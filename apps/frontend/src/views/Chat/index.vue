<template>
  <div class="mx-auto mt-10 flex w-[1200px]">
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
import { onMounted, ref } from 'vue';
import type {
  ChatAssistant,
  ChatAssistantKey,
  ChatMessageList,
  ChatStreamEvent,
} from '@en/common/chat';
import { getChatAssistants, getChatHistory } from '@/apis/chat';
import type { ConversationItem } from './types';

/** 测试开关：'library' 用 fetch-event-source，'custom' 用自研 fetchSse */
const SSE_IMPL = 'custom' as 'library' | 'custom';
const STORAGE_KEY = 'chat-conversations';
const DEFAULT_ASSISTANT: ChatAssistant = {
  id: 'default',
  key: 'normal',
  name: '智能助手',
};

const userStore = useUserStore();
const conversations = ref<ConversationItem[]>([]);
const activeConversationId = ref<string | null>(null);
const list = ref<ChatMessageList>([]);
const userId = userStore.user?.id;
const assistants = ref<ChatAssistant[]>([DEFAULT_ASSISTANT]);
const assistantKey = ref<ChatAssistantKey>(DEFAULT_ASSISTANT.key);
const assistantName = ref(DEFAULT_ASSISTANT.name);
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

const persistConversations = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value));
};

const sortConversations = () => {
  conversations.value.sort((a, b) => b.updatedAt - a.updatedAt);
};

const loadStoredConversations = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const stored = JSON.parse(raw) as ConversationItem[];
    if (!Array.isArray(stored)) return;

    conversations.value = stored.map((item) => ({
      id: item.id,
      title: item.title,
      messages: Array.isArray(item.messages) ? item.messages : [],
      assistantKey: item.assistantKey ?? DEFAULT_ASSISTANT.key,
      assistantName: item.assistantName ?? DEFAULT_ASSISTANT.name,
      updatedAt: item.updatedAt ?? Date.now(),
    }));
    sortConversations();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
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
  const defaultAssistant = assistants.value[0] ?? DEFAULT_ASSISTANT;
  assistantKey.value = defaultAssistant.key;
  assistantName.value = defaultAssistant.name;
  list.value = [];
};

const loadConversationHistory = async (conversation: ConversationItem) => {
  const res = await getChatHistory(conversation.id);
  conversation.messages = res.data;
  persistConversations();

  if (activeConversationId.value === conversation.id) {
    list.value = [...conversation.messages];
  }
};

const selectConversation = async (id: string) => {
  if (isStreaming.value) return;
  activeConversationId.value = id;
  const conversation = conversations.value.find((item) => item.id === id);
  assistantKey.value = conversation?.assistantKey ?? DEFAULT_ASSISTANT.key;
  assistantName.value = conversation?.assistantName ?? DEFAULT_ASSISTANT.name;
  syncListFromActiveConversation();

  if (conversation) {
    await loadConversationHistory(conversation);
  }
};

const deleteConversation = (id: string) => {
  if (isStreaming.value) return;

  const index = conversations.value.findIndex((item) => item.id === id);
  if (index === -1) return;

  conversations.value.splice(index, 1);
  persistConversations();

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
  if (data.type !== 'delta') return;
  list.value[list.value.length - 1]!.content += data.content;

  const activeConversation = getActiveConversation();
  if (activeConversation) {
    activeConversation.messages = [...list.value];
    activeConversation.updatedAt = Date.now();
    sortConversations();
    persistConversations();
  }
};

const abortMessage = () => {
  abortController?.abort();
  finishStreaming();
};

const ensureActiveConversation = (message: string) => {
  const activeConversation = getActiveConversation();
  if (activeConversation) return activeConversation;

  const conversation: ConversationItem = {
    id: crypto.randomUUID(),
    title: createConversationTitle(message),
    messages: [],
    assistantKey: assistantKey.value,
    assistantName: assistantName.value,
    updatedAt: Date.now(),
  };

  conversations.value.unshift(conversation);
  activeConversationId.value = conversation.id;
  persistConversations();
  return conversation;
};

const sendMessage = (message: string) => {
  if (isStreaming.value) return;

  const conversation = ensureActiveConversation(message);
  if (!conversation) return;

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
    activeConversation.updatedAt = Date.now();
    sortConversations();
    persistConversations();
  }

  const payload = {
    assistantKey: conversation.assistantKey,
    conversationId: conversation.id,
    content: message,
    userId: userId!,
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

const loadAssistants = async () => {
  try {
    const res = await getChatAssistants();
    assistants.value = res.data.length ? res.data : [DEFAULT_ASSISTANT];
  } catch {
    assistants.value = [DEFAULT_ASSISTANT];
  }

  if (!activeConversationId.value) {
    const firstAssistant = assistants.value[0] ?? DEFAULT_ASSISTANT;
    assistantKey.value = firstAssistant.key;
    assistantName.value = firstAssistant.name;
  }
};

onMounted(async () => {
  await loadAssistants();
  loadStoredConversations();

  const firstConversation = conversations.value[0];
  if (firstConversation) {
    await selectConversation(firstConversation.id);
  }
});
</script>
