<template>
  <div class="flex-1 h-[750px] p-5 bg-purple-50 flex flex-col">
      <div class="flex-1 overflow-y-auto">
          <div v-for="(item, index) in list" :key="index">
              <div class="flex justify-end items-center  gap-4 mt-5 mb-5 mr-5" v-if="item.role === 'human'">
                  <div class="text-sm text-white max-w-[80%] rounded-lg p-2 bg-blue-500 shadow-md">
                      {{ item.content }}
                  </div>
                  <div>
                      <el-avatar :size="35">user</el-avatar>
                  </div>
              </div>
              <div class="flex justify-start items-center gap-4 mt-5 mb-5" v-else>
                  <div> <el-avatar :size="35">AI</el-avatar></div>
                  <div v-if="item.role === 'ai' && item.content !== ''" class="text-sm text-gray-700 max-w-[80%] bg-white rounded-lg p-2 shadow-md" v-html="parseMarkdown(item.content)" />
              </div>
          </div>
          <div ref="chatRef"></div>
      </div>
      <div class="flex p-5 border-t border-gray-200 box-border">
          <el-input @keyup.enter="sendMessage" type="textarea" :rows="2" v-model="message" placeholder="请输入内容" />
          <el-button class="ml-2"  :icon="Position" type="primary" @click="sendMessage"></el-button>
      </div>
  </div>
</template>

<script setup lang="ts">
import { Position } from '@element-plus/icons-vue'
import type { ChatMessageList } from '@en/common/chat'
import { ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { marked } from 'marked'
import { sse, CHAT_URL } from '@/apis/sse'

const userStore = useUserStore()
const message = ref('')
const props = defineProps<{
    list?: ChatMessageList
}>()


const sendMessage = ()=> {
    const userId = userStore.getUser?.id
    sse<ChatMessage>(CHAT_URL, 'POST', {
      role: 'normal',
      content: message.value,
      userId: userId,
    }, (data) => {
      console.log(data)
    })
    message.value = ''
}

const parseMarkdown = (content: string) => {
    if(!content) return ''
    return marked.parse(content)
}
</script>