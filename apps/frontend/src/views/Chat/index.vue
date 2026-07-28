<template>
  <div class="w-[1200px] mx-auto flex mt-10">
    <Conversations @on-get-role="getRole" />
    <Bubble :list="list" @on-send-message="sendMessage" />
  </div>
</template>
<script setup lang="ts">
import Conversations from './components/Conversations.vue';
import Bubble from './components/Bubble.vue';
import { sse, fetchSse, CHAT_URL } from '@/apis/sse';
import { useUserStore } from '@/stores/user';
import { ref } from 'vue';
import type { ChatMessageList, ChatStreamEvent } from '@en/common/chat';
import type { ChatRoleType } from '@en/common/chat/index.ts';
import { getChatHistory } from '@/apis/chat';

/** 测试开关：'library' 用 fetch-event-source，'custom' 用自研 fetchSse */
const SSE_IMPL = 'custom' as 'library' | 'custom';

const userStore = useUserStore();
const list = ref<ChatMessageList>([]);
const userId = userStore.user?.id;
const role = ref<ChatRoleType>('normal');

const appendDelta = (data: ChatStreamEvent) => {
  if (data.type !== 'delta') return;
  list.value[list.value.length - 1]!.content += data.content;
};

const sendMessage = (message: string) => {
  list.value.push({
    role: 'human',
    content: message,
  });
  list.value.push({
    role: 'ai',
    content: '',
  });

  const payload = {
    role: role.value,
    content: message,
    userId: userId!,
  };

  if (SSE_IMPL === 'library') {
    sse<ChatStreamEvent>(CHAT_URL, 'POST', payload, appendDelta, console.error);
    return;
  }

  fetchSse<ChatStreamEvent>({
    url: CHAT_URL,
    body: payload,
    onMessage: appendDelta,
    onError: console.error,
  });
};

const getRole = async (role: ChatRoleType) => {
  const res = await getChatHistory(userId!, role);
  list.value = res.data;
};
</script>
