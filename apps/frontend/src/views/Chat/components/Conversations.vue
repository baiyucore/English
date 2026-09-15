<template>
  <aside
    :class="
      cn(
        'flex h-full flex-col overflow-hidden bg-zinc-50',
        'max-lg:fixed max-lg:top-20 max-lg:bottom-0 max-lg:left-0 max-lg:z-50 max-lg:w-72 max-lg:border-r max-lg:border-zinc-200 max-lg:shadow-xl max-lg:transition-transform max-lg:duration-200 motion-reduce:transition-none',
        mobileOpen ? 'max-lg:translate-x-0' : 'max-lg:-translate-x-full',
        'lg:relative lg:shrink-0 lg:border-r lg:border-zinc-100 lg:transition-[width] lg:duration-200 lg:ease-out motion-reduce:lg:transition-none',
        expanded ? 'lg:w-64' : 'lg:w-14',
      )
    "
    aria-label="会话侧边栏"
  >
    <div
      :class="
        cn(
          'flex-col items-center gap-1 p-2',
          expanded ? 'hidden' : 'hidden lg:flex',
        )
      "
    >
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
        aria-label="展开侧边栏"
        title="展开侧边栏"
        @click="expanded = true"
      >
        <PanelLeftOpen class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
        aria-label="新聊天"
        title="新聊天"
        @click="handleNewChat"
      >
        <SquarePen class="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        class="flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
        aria-label="搜索聊天"
        title="搜索聊天"
        @click="searchOpen = true"
      >
        <Search class="size-4" aria-hidden="true" />
      </button>
    </div>

    <div
      :class="
        cn(
          'min-h-0 flex-1 flex-col overflow-hidden',
          expanded ? 'flex' : 'hidden max-lg:flex',
        )
      "
    >
      <div class="flex shrink-0 items-center justify-between px-2 pt-2 pb-1">
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
          :aria-label="expanded ? '收起侧边栏' : '关闭侧边栏'"
          :title="expanded ? '收起侧边栏' : '关闭侧边栏'"
          @click="handleToggleSidebar"
        >
          <PanelLeftClose class="size-4" aria-hidden="true" />
        </button>
      </div>

      <div class="flex shrink-0 flex-col gap-0.5 px-2 pb-2">
        <button
          type="button"
          class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-zinc-800 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
          @click="handleNewChat"
        >
          <SquarePen class="size-4 shrink-0" aria-hidden="true" />
          新聊天
        </button>
        <button
          type="button"
          class="flex min-h-11 items-center gap-2.5 rounded-lg px-3 text-sm text-zinc-800 transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-zinc-400"
          @click="searchOpen = true"
        >
          <Search class="size-4 shrink-0" aria-hidden="true" />
          搜索聊天
        </button>
      </div>

      <ConversationDrawer
        :conversations="conversations"
        :active-id="activeId"
        @on-select-conversation="handleSelect"
        @on-delete-conversation="handleDelete"
      />
    </div>

    <SearchModal
      v-model:open="searchOpen"
      @on-select-conversation="handleSelect"
    />
  </aside>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
} from 'lucide-vue-next';
import { cn } from '@/lib/utils';
import ConversationDrawer from './ConversationDrawer.vue';
import SearchModal from './SearchModal.vue';
import type { ConversationItem } from '../types';

defineProps<{
  conversations: ConversationItem[];
  activeId: string | null;
}>();

const emits = defineEmits<{
  onNewChat: [];
  onSelectConversation: [id: string];
  onDeleteConversation: [id: string];
}>();

const mobileOpen = defineModel<boolean>('mobileOpen', { default: false });
const expanded = ref(true);
const searchOpen = ref(false);

const handleNewChat = () => {
  emits('onNewChat');
  mobileOpen.value = false;
};

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
  mobileOpen.value = false;
};

const handleDelete = (id: string) => {
  emits('onDeleteConversation', id);
};

const handleToggleSidebar = () => {
  if (window.matchMedia('(max-width: 1023px)').matches) {
    mobileOpen.value = false;
    return;
  }
  expanded.value = !expanded.value;
};

const handleGlobalKeydown = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    searchOpen.value = true;
    return;
  }
  if (event.key === 'Escape' && mobileOpen.value) {
    mobileOpen.value = false;
  }
};

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
});
</script>
