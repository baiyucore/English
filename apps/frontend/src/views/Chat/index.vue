<template>
  <div class="w-[1200px] mx-auto flex mt-10">
      <Conversations />
      <Bubble @onSendMessage="sendMessage" />
  </div>
</template>
<script setup lang="ts">
import Conversations from './components/Conversations.vue'
import Bubble from './components/Bubble.vue'
import { sse, CHAT_URL } from '@/apis/sse'
import { useUserStore } from '@/stores/user'
import { ref } from 'vue'
import type { ChatMessageList, ChatMessage } from '@/types/chat'
import type { ChatRoleType } from '@en/common/chat/index.ts'

const userStore = useUserStore()
const list = ref<ChatMessageList>([])
const userId = userStore.user?.id
const role = ref<ChatRoleType>('normal')


  
const sendMessage = (message: string) => {
  list.value.push({
    role: 'human',
    content: message,
  })
  list.value.push({
    role: 'ai',
    content: '',
  })
  sse<ChatMessage>(CHAT_URL, 'POST', {
    role: role.value,
    content: message,
    userId: userId!,
    }, (data) => {
      console.log(data)
  })
}

</script>