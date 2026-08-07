<template>
  <aside
    :class="
      cn(
        'relative flex h-full shrink-0 flex-col border-r border-gray-200 bg-purple-50 transition-[width] duration-300 ease-out',
        expanded ? 'w-64' : 'w-14',
      )
    "
  >
    <div
      :class="
        cn(
          'flex shrink-0 items-center gap-1 p-2',
          expanded ? 'justify-between' : 'flex-col',
        )
      "
    >
      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-[5px] text-gray-600 transition-colors hover:bg-purple-100"
        aria-label="新聊天"
        title="新聊天"
        @click="handleNewChat"
      >
        <SquarePen class="size-4" />
      </button>

      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-[5px] text-gray-600 transition-colors hover:bg-purple-100"
        aria-label="搜索聊天"
        title="搜索聊天"
        @click="searchOpen = true"
      >
        <Search class="size-4" />
      </button>

      <button
        type="button"
        class="flex size-9 items-center justify-center rounded-[5px] text-gray-600 transition-colors hover:bg-purple-100"
        :aria-label="expanded ? '收起侧边栏' : '展开侧边栏'"
        :title="expanded ? '收起侧边栏' : '展开侧边栏'"
        @click="expanded = !expanded"
      >
        <PanelLeftClose v-if="expanded" class="size-4" />
        <PanelLeftOpen v-else class="size-4" />
      </button>
    </div>

    <div v-show="expanded" class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div class="px-4 pb-2">
        <Button class="w-full" variant="outline" @click="handleNewChat">
          <Plus class="size-4" data-icon="inline-start" />
          新聊天
        </Button>
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
import { ref } from 'vue';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  SquarePen,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
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

const expanded = ref(true);
const searchOpen = ref(false);

const handleNewChat = () => {
  emits('onNewChat');
};

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
};

const handleDelete = (id: string) => {
  emits('onDeleteConversation', id);
};
</script>
