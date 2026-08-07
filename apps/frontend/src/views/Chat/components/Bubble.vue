<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-purple-50">
    <div
      v-if="showEmpty"
      class="flex flex-1 flex-col items-center justify-center gap-3 px-5"
    >
      <div
        class="flex size-16 items-center justify-center rounded-full bg-white shadow-md"
      >
        <MessageSquare class="size-8 text-purple-400" />
      </div>
      <h2 class="text-lg font-medium text-gray-700">开始新对话</h2>
      <p class="max-w-sm text-center text-sm text-muted-foreground">
        输入你的问题，AI 助手将为你解答英语学习相关问题
      </p>
      <div class="mt-4 w-full max-w-3xl">
        <div class="rounded-3xl border bg-background p-2 shadow-sm">
          <Textarea
            v-model="message"
            placeholder="给 AI 发送消息"
            :disabled="isStreaming"
            class="min-h-24 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
            @keydown="handleTextareaKeydown"
          />
          <div class="flex justify-end">
            <Button
              v-if="isStreaming"
              type="button"
              variant="destructive"
              size="icon"
              aria-label="中断回复"
              @click="abortMessage"
            >
              <SquareIcon />
            </Button>
            <Button
              v-else
              type="button"
              size="icon"
              aria-label="发送消息"
              :disabled="!canSend"
              @click="sendMessage"
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      </div>
    </div>

    <template v-else>
      <div class="min-h-0 flex-1 overflow-y-auto px-5">
        <div class="mx-auto max-w-3xl">
          <div v-for="(item, index) in list" :key="index">
            <div
              v-if="item.role === 'human'"
              class="mb-5 mt-5 flex items-center justify-end gap-4"
            >
              <div
                class="max-w-[80%] rounded-lg bg-blue-500 p-2 text-sm text-white shadow-md"
              >
                {{ item.content }}
              </div>
              <div>
                <el-avatar :size="35"> user </el-avatar>
              </div>
            </div>
            <div v-else class="mb-5 mt-5 flex items-center justify-start gap-4">
              <div>
                <el-avatar :size="35"> AI </el-avatar>
              </div>
              <div
                v-if="item.role === 'ai' && item.content !== ''"
                class="max-w-[80%] rounded-lg bg-white p-2 text-sm text-gray-700 shadow-md"
                v-html="parseMarkdown(item.content)"
              />
            </div>
          </div>
          <div ref="chatRef" />
        </div>
      </div>

      <div class="shrink-0 border-t border-gray-200 px-5 pt-4 pb-5">
        <div
          class="mx-auto w-full max-w-3xl rounded-3xl border bg-background p-2 shadow-sm"
        >
          <Textarea
            v-model="message"
            placeholder="给 AI 发送消息"
            :disabled="isStreaming"
            class="min-h-20 resize-none border-0 bg-transparent px-3 py-2 shadow-none focus-visible:ring-0"
            @keydown="handleTextareaKeydown"
          />
          <div class="flex justify-end">
            <Button
              v-if="isStreaming"
              type="button"
              variant="destructive"
              size="icon"
              aria-label="中断回复"
              @click="abortMessage"
            >
              <SquareIcon />
            </Button>
            <Button
              v-else
              type="button"
              size="icon"
              aria-label="发送消息"
              :disabled="!canSend"
              @click="sendMessage"
            >
              <ArrowUpIcon />
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ArrowUpIcon, MessageSquare, SquareIcon } from 'lucide-vue-next';
import { computed, ref, useTemplateRef, watch, nextTick } from 'vue';
import { marked } from 'marked';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type ChatMessageList = Array<{
  role: 'human' | 'ai';
  content: string;
}>;

const chatRef = useTemplateRef('chatRef');
const emits = defineEmits<{
  onSendMessage: [message: string];
  onAbort: [];
}>();
const message = ref('');
const props = defineProps<{
  list?: ChatMessageList;
  isStreaming?: boolean;
}>();

const showEmpty = computed(() => {
  const hasMessages = (props.list?.length ?? 0) > 0;
  return !hasMessages && !props.isStreaming;
});

const canSend = computed(() => {
  return !props.isStreaming && message.value.trim().length > 0;
});

const sendMessage = () => {
  const content = message.value.trim();
  if (props.isStreaming || !content) return;
  emits('onSendMessage', content);
  message.value = '';
};

const abortMessage = () => {
  emits('onAbort');
};

const parseMarkdown = (content: string) => {
  if (!content) return '';
  return marked.parse(content);
};

const handleTextareaKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  sendMessage();
};

watch(
  () => props.list,
  () => {
    nextTick(() => {
      chatRef.value?.scrollIntoView({ behavior: 'smooth' });
    });
  },
  {
    immediate: true,
    deep: true,
  },
);
</script>
