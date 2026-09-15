<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
      @click.self="handleClose"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-search-title"
        class="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl"
      >
        <h2 id="chat-search-title" class="sr-only">搜索聊天</h2>

        <div class="border-b border-zinc-100 px-3 py-3">
          <div
            class="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2.5"
          >
            <Search class="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="搜索聊天记录…"
              class="w-full bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400"
              aria-label="搜索聊天记录"
              @keydown.esc="handleClose"
            />
            <kbd
              class="hidden shrink-0 rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-400 sm:inline"
            >
              ESC
            </kbd>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-2">
          <p
            v-if="loading"
            class="px-3 py-10 text-center text-sm text-zinc-500"
          >
            搜索中…
          </p>

          <template v-else>
            <button
              v-for="item in results"
              :key="item.id"
              type="button"
              class="flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400"
              @click="handleSelect(item.id)"
            >
              <MessageSquare
                class="mt-0.5 size-4 shrink-0 text-zinc-400"
                aria-hidden="true"
              />
              <div class="min-w-0 flex-1">
                <p
                  class="truncate text-sm font-medium text-zinc-800"
                  v-html="highlight(item.title)"
                />
                <p
                  v-if="item.snippet"
                  class="mt-1 line-clamp-2 text-xs text-zinc-500"
                  v-html="highlight(item.snippet)"
                />
              </div>
            </button>

            <p
              v-if="results.length === 0"
              class="px-3 py-10 text-center text-sm text-zinc-500"
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
import { MessageSquare, Search } from 'lucide-vue-next';
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
  const userId = userStore.isLoggedIn ? userStore.user?.id : undefined;
  if (!userId) {
    results.value = [];
    return;
  }

  const seq = ++searchSeq;
  loading.value = true;
  try {
    const res = await searchChatConversations(keyword);
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
      `<mark class="rounded-sm bg-yellow-200 px-0.5 text-inherit">${match}</mark>`,
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
