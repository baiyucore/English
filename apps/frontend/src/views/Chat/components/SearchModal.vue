<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      @click.self="handleClose"
    >
      <div
        class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        <div class="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 class="text-sm font-medium text-gray-800">搜索聊天</h2>
          <div class="flex items-center gap-1">
            <button
              type="button"
              class="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-700"
              @click="query = ''"
            >
              清除
            </button>
            <button
              type="button"
              class="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="关闭"
              @click="handleClose"
            >
              <X class="size-4" />
            </button>
          </div>
        </div>

        <div class="border-b border-gray-100 px-4 py-3">
          <div
            class="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <Search class="size-4 shrink-0 text-muted-foreground" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="搜索聊天记录…"
              class="w-full bg-transparent text-sm text-gray-700 outline-none placeholder:text-muted-foreground"
              @keydown.esc="handleClose"
            />
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <p
            v-if="loading"
            class="px-3 py-10 text-center text-sm text-muted-foreground"
          >
            搜索中…
          </p>

          <template v-else>
            <button
              v-for="item in results"
              :key="item.id"
              type="button"
              class="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-purple-50"
              @click="handleSelect(item.id)"
            >
              <MessageSquare class="mt-0.5 size-4 shrink-0 text-purple-400" />
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium text-gray-800"
                  v-html="highlight(item.title)"
                />
                <p
                  v-if="item.snippet"
                  class="mt-1 line-clamp-2 text-xs text-muted-foreground"
                  v-html="highlight(item.snippet)"
                />
              </div>
            </button>

            <p
              v-if="results.length === 0"
              class="px-3 py-10 text-center text-sm text-muted-foreground"
            >
              {{ query.trim() ? '未找到相关聊天' : '暂无聊天记录' }}
            </p>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { MessageSquare, Search, X } from 'lucide-vue-next';
import { searchChatConversations } from '@/apis/chat';
import { useUserStore } from '@/stores/user';
import type { ChatConversation } from '@en/common/chat';

const props = defineProps<{
  open: boolean;
}>();

const emits = defineEmits<{
  'update:open': [value: boolean];
  onSelectConversation: [id: string];
}>();

const userStore = useUserStore();
const query = ref('');
const results = ref<ChatConversation[]>([]);
const loading = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchSeq = 0;

const isApiOk = <T,>(res: { code?: number; data?: T } | null | undefined) => {
  return res?.code === 200;
};

const runSearch = async (keyword: string) => {
  const userId = userStore.user?.id;
  if (!userId) {
    results.value = [];
    return;
  }

  const seq = ++searchSeq;
  loading.value = true;
  try {
    const res = await searchChatConversations(userId, keyword);
    if (seq !== searchSeq) return;
    if (!isApiOk(res) || !Array.isArray(res.data)) {
      results.value = [];
      return;
    }
    results.value = res.data;
  } catch (error) {
    if (seq !== searchSeq) return;
    console.error(error);
    results.value = [];
  } finally {
    if (seq === searchSeq) {
      loading.value = false;
    }
  }
};

const scheduleSearch = (keyword: string) => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    void runSearch(keyword);
  }, 250);
};

const escapeHtml = (value: string) => {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const highlight = (value: string) => {
  const safe = escapeHtml(value);
  const keyword = query.value.trim();
  if (!keyword) return safe;

  const escapedKeyword = escapeHtml(keyword).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return safe.replace(
    new RegExp(escapedKeyword, 'gi'),
    (match: string) =>
      `<mark class="rounded-sm bg-yellow-300/80 px-0.5 text-inherit">${match}</mark>`,
  );
};

const handleClose = () => {
  emits('update:open', false);
};

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
  handleClose();
};

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      query.value = '';
      results.value = [];
      return;
    }
    await nextTick();
    inputRef.value?.focus();
    void runSearch('');
  },
);

watch(query, (value) => {
  if (!props.open) return;
  scheduleSearch(value);
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});
</script>
