<template>
  <div class="w-[1200px] mx-auto flex mt-10">
    <Conversations @on-get-role="getRole" />
    <Bubble :list="list" @on-send-message="sendMessage" />
  </div>
</template>
<script setup lang="ts">
import Conversations from './components/Conversations.vue';
import Bubble from './components/Bubble.vue';
import { sse, CHAT_URL } from '@/apis/sse';
import { useUserStore } from '@/stores/user';
import { ref } from 'vue';
import type { ChatMessageList, ChatMessage } from '@en/common/chat';
import type { ChatRoleType } from '@en/common/chat/index.ts';
import { getChatHistory } from '@/apis/chat';
const userStore = useUserStore();
const list = ref<ChatMessageList>([]);
const userId = userStore.user?.id;
const role = ref<ChatRoleType>('normal');

const sendMessage = (message: string) => {
  list.value.push({
    role: 'human',
    content: message,
  });
  list.value.push({
    role: 'ai',
    content: '',
  });
  sse<ChatMessage>(
    CHAT_URL,
    'POST',
    {
      role: role.value,
      content: message,
      userId: userId!,
    },
    (data) => {
      list.value[list.value.length - 1]!.content += data.content;
      console.log(list.value, 'list.value');
    },
  );
};

const getRole = async (role: ChatRoleType) => {
  const res = await getChatHistory(userId!, role);
  list.value = res.data;
};
</script>
