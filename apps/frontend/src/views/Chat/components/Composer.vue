<template>
  <form class="mx-auto w-full max-w-3xl" @submit.prevent="sendMessage">
    <div
      class="rounded-[28px] border border-zinc-200 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-shadow focus-within:shadow-[0_8px_28px_rgba(0,0,0,0.1)]"
    >
      <label class="sr-only" for="chat-composer-input">给 AI 发送消息</label>
      <Textarea
        id="chat-composer-input"
        v-model="message"
        placeholder="给 AI 发送消息"
        :disabled="isStreaming"
        class="min-h-12 max-h-48 resize-none rounded-[28px] border-0 bg-transparent px-4 pt-3.5 pb-1 text-[15px] shadow-none focus-visible:ring-0"
        autofocus
        @keydown="handleTextareaKeydown"
      />
      <div class="flex items-center justify-end px-2.5 pb-2.5">
        <button
          v-if="isStreaming"
          type="button"
          class="flex size-11 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
          aria-label="停止生成"
          @click="abortMessage"
        >
          <SquareIcon class="size-3 fill-current" aria-hidden="true" />
        </button>
        <button
          v-else
          type="submit"
          class="flex size-11 items-center justify-center rounded-full bg-zinc-900 text-white transition-colors hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 disabled:bg-zinc-200 disabled:text-zinc-400"
          aria-label="发送消息"
          :disabled="!canSend"
        >
          <ArrowUpIcon class="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
    <p class="mt-2 text-center text-xs text-zinc-400">
      内容由 AI 生成，请注意甄别
    </p>
  </form>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ArrowUpIcon, SquareIcon } from 'lucide-vue-next';
import { Textarea } from '@/components/ui/textarea';

const message = defineModel<string>({ default: '' });

const props = defineProps<{
  isStreaming?: boolean;
}>();

const emits = defineEmits<{
  send: [message: string];
  abort: [];
}>();

const canSend = computed(() => {
  return !props.isStreaming && message.value.trim().length > 0;
});

const sendMessage = () => {
  const content = message.value.trim();
  if (props.isStreaming || !content) return;
  emits('send', content);
  message.value = '';
};

const abortMessage = () => {
  emits('abort');
};

const handleTextareaKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  event.preventDefault();
  sendMessage();
};
</script>
