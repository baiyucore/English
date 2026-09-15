<template>
  <div class="flex h-[calc(100dvh-5rem)] w-full overflow-hidden bg-white">
    <button
      v-if="mobileSidebarOpen"
      type="button"
      class="fixed top-20 right-0 bottom-0 left-0 z-40 bg-black/40 lg:hidden"
      aria-label="关闭会话列表"
      @click="mobileSidebarOpen = false"
    />
    <Conversations
      v-model:mobile-open="mobileSidebarOpen"
      :conversations="conversations"
      :active-id="activeConversationId"
      @on-new-chat="startNewChat"
      @on-select-conversation="selectConversation"
      @on-delete-conversation="deleteConversation"
    />
    <Bubble
      :list="list"
      :is-streaming="isStreaming"
      :streaming-status="agentStatus"
      :execution-mode="executionMode"
      @on-send-message="sendMessage"
      @on-abort="abortMessage"
      @on-execution-mode-change="executionMode = $event"
      @on-new-chat="startNewChat"
      @open-sidebar="mobileSidebarOpen = true"
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
  ChatExecutionMode,
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
const agentStatus = ref<string | null>(null);
const executionMode = ref<ChatExecutionMode>('hybrid');
const mobileSidebarOpen = ref(false);
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
  agentStatus.value = null;
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
  if (data.type === 'agent_started') {
    agentStatus.value = '正在准备回答…';
    return;
  }
  if (data.type === 'route_selected') {
    agentStatus.value = `正在处理：${formatRouteName(data.route)}`;
    return;
  }
  if (data.type === 'tool_started') {
    agentStatus.value = `正在执行：${formatToolName(data.tool)}`;
    return;
  }
  if (data.type === 'tool_completed') {
    agentStatus.value = `已完成：${formatToolName(data.tool)}，正在整理结果…`;
    return;
  }
  if (data.type === 'tool_failed') {
    agentStatus.value = `${formatToolName(data.tool)} 未完成，正在尝试继续回答…`;
    return;
  }
  if (data.type === 'agent_result') {
    const last = list.value[list.value.length - 1];
    if (last?.role === 'ai') {
      // 专项能力不逐字流式输出；以统一结果补全最终文本并保留机器可读字段。
      last.content = data.result.content;
      last.metadata = {
        agentResult: data.result,
        agentResultVersion: 1,
      };
    }
    const activeConversation = getActiveConversation();
    if (activeConversation) {
      activeConversation.messages = [...list.value];
    }
    return;
  }
  if (data.type === 'agent_completed') {
    agentStatus.value = '回答已完成';
    return;
  }
  if (data.type === 'agent_failed') {
    agentStatus.value = data.error;
    return;
  }
  if (data.type === 'agent_cancelled') {
    agentStatus.value = null;
    return;
  }
  if (data.type !== 'delta') return;
  agentStatus.value = '正在生成回答…';
  list.value[list.value.length - 1]!.content += data.content;

  const activeConversation = getActiveConversation();
  if (activeConversation) {
    activeConversation.messages = [...list.value];
  }
};

const formatRouteName = (route: string) => {
  const names: Record<string, string> = {
    translation: '中译英',
    correction: '英文纠错',
    vocabulary: '词汇查询',
    learning_chat: '英语学习',
  };
  return names[route] || route;
};

const formatToolName = (tool: string) => {
  const names: Record<string, string> = {
    list_skills: '查询可用技能',
    load_skill: '加载技能策略',
    lookup_word: '查词',
    correct_english: '英文纠错',
    translate_zh_to_en: '中译英',
  };
  return names[tool] || tool;
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

  conversations.value.unshift(conversation);
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
    activeConversation.updatedAt = Date.now();
  }

  const payload = {
    assistantKey: conversation.assistantKey,
    conversationId: conversation.id,
    content: message,
    executionMode: executionMode.value,
  };

  abortController = new AbortController();
  isStreaming.value = true;
  agentStatus.value = '正在连接 AI…';

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
