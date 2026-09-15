<template>
  <div class="flex h-full min-w-0 flex-1 flex-col bg-white">
    <header class="flex h-14 shrink-0 items-center gap-1 px-2 md:px-3">
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 lg:hidden"
        aria-label="打开会话列表"
        @click="emits('openSidebar')"
      >
        <PanelLeft class="size-5" aria-hidden="true" />
      </button>

      <ExecutionModeSelect
        :mode="executionMode"
        :disabled="isStreaming"
        @change="changeExecutionMode"
      />

      <button
        type="button"
        class="ml-auto flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 lg:hidden"
        aria-label="新聊天"
        :disabled="isStreaming"
        @click="emits('onNewChat')"
      >
        <SquarePen class="size-5" aria-hidden="true" />
      </button>
    </header>

    <div
      v-if="showEmpty"
      class="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-10"
    >
      <h1
        class="text-center text-2xl font-semibold tracking-tight text-zinc-800 md:text-3xl"
      >
        有什么我能帮你的？
      </h1>
      <p class="mt-2 max-w-md text-center text-sm text-zinc-500">
        问我翻译、英文纠错或单词用法
      </p>
      <div class="mt-8 w-full">
        <Composer
          v-model="message"
          :is-streaming="isStreaming"
          @send="handleSend"
          @abort="abortMessage"
        />
      </div>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.label"
          type="button"
          class="min-h-11 rounded-full border border-zinc-200 bg-white px-4 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-400"
          @click="useSuggestion(suggestion.prompt)"
        >
          {{ suggestion.label }}
        </button>
      </div>
    </div>

    <template v-else>
      <div
        class="min-h-0 flex-1 overflow-y-auto px-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        <div class="mx-auto w-full max-w-3xl py-4 md:py-6">
          <article
            v-for="(item, index) in list"
            :key="index"
            class="mb-6 last:mb-2"
          >
            <div v-if="item.role === 'human'" class="flex justify-end">
              <div
                class="max-w-[85%] rounded-3xl bg-zinc-100 px-5 py-3 text-[15px] leading-7 whitespace-pre-wrap text-zinc-800 md:max-w-[70%]"
              >
                {{ item.content }}
              </div>
            </div>

            <div v-else class="flex gap-3">
              <div
                class="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-600"
                aria-hidden="true"
              >
                <Sparkles class="size-4" />
              </div>
              <div class="min-w-0 flex-1 pt-0.5">
                <div
                  v-if="item.content"
                  class="chat-markdown text-[15px] leading-7 text-zinc-800"
                  v-html="parseMarkdown(item.content)"
                />
                <div
                  v-if="
                    isStreaming &&
                    index === (list?.length ?? 0) - 1 &&
                    streamingStatus
                  "
                  class="flex items-center gap-2 text-sm text-zinc-500"
                  :class="{ 'mt-3': Boolean(item.content) }"
                >
                  <LoaderCircle
                    class="size-3.5 animate-spin"
                    aria-hidden="true"
                  />
                  <span>{{ streamingStatus }}</span>
                </div>
              </div>
            </div>
          </article>
          <div ref="chatRef" />
        </div>
      </div>

      <div
        class="relative shrink-0 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-5"
      >
        <div
          class="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-linear-to-t from-white to-transparent"
          aria-hidden="true"
        />
        <Composer
          v-model="message"
          :is-streaming="isStreaming"
          @send="handleSend"
          @abort="abortMessage"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { LoaderCircle, PanelLeft, Sparkles, SquarePen } from 'lucide-vue-next';
import { marked } from 'marked';
import type { ChatExecutionMode } from '@en/common/chat';
import Composer from './Composer.vue';
import ExecutionModeSelect from './ExecutionModeSelect.vue';

type ChatMessageList = Array<{
  role: 'human' | 'ai';
  content: string;
}>;

const suggestions = [
  { label: '帮我翻译', prompt: '请把下面这句话翻译成地道英文：' },
  { label: '纠正英文', prompt: '请纠正下面英文中的语法和用词问题：' },
  { label: '解释单词', prompt: '请解释这个单词的含义、用法和常见搭配：' },
];

const chatRef = useTemplateRef('chatRef');
const message = ref('');
const emits = defineEmits<{
  onSendMessage: [message: string];
  onAbort: [];
  onExecutionModeChange: [mode: ChatExecutionMode];
  onNewChat: [];
  openSidebar: [];
}>();

const props = defineProps<{
  list?: ChatMessageList;
  isStreaming?: boolean;
  streamingStatus?: string | null;
  executionMode: ChatExecutionMode;
}>();

const showEmpty = computed(() => {
  const hasMessages = (props.list?.length ?? 0) > 0;
  return !hasMessages && !props.isStreaming;
});

const handleSend = (content: string) => {
  emits('onSendMessage', content);
};

const abortMessage = () => {
  emits('onAbort');
};

const changeExecutionMode = (mode: ChatExecutionMode) => {
  if (!props.isStreaming) emits('onExecutionModeChange', mode);
};

const useSuggestion = (prompt: string) => {
  message.value = prompt;
  nextTick(() => {
    document.getElementById('chat-composer-input')?.focus();
  });
};

const parseMarkdown = (content: string) => {
  if (!content) return '';
  return marked.parse(content);
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

<style scoped>
.chat-markdown :deep(p) {
  margin: 0.6em 0;
}

.chat-markdown :deep(p:first-child) {
  margin-top: 0;
}

.chat-markdown :deep(p:last-child) {
  margin-bottom: 0;
}

.chat-markdown :deep(ul),
.chat-markdown :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.25em;
}

.chat-markdown :deep(li) {
  margin: 0.2em 0;
}

.chat-markdown :deep(code) {
  border-radius: 0.35rem;
  background: #f4f4f5;
  padding: 0.1em 0.35em;
  font-size: 0.9em;
}

.chat-markdown :deep(pre) {
  margin: 0.75em 0;
  overflow-x: auto;
  border-radius: 0.9rem;
  background: #f4f4f5;
  padding: 0.9em 1em;
}

.chat-markdown :deep(pre code) {
  background: transparent;
  padding: 0;
}

.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3) {
  margin: 0.9em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
}

.chat-markdown :deep(a) {
  color: #2563eb;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.chat-markdown :deep(blockquote) {
  margin: 0.6em 0;
  border-left: 3px solid #d4d4d8;
  padding-left: 0.9em;
  color: #52525b;
}
</style>
