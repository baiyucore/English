<template>
  <aside
    class="flex h-[750px] w-64 shrink-0 flex-col rounded-[5px] border border-gray-200 bg-purple-50"
  >
    <div class="flex flex-col gap-3 p-4">
      <Button class="w-full" variant="outline" @click="handleNewChat">
        <Plus class="size-4" data-icon="inline-start" />
        新聊天
      </Button>
      <Separator />
    </div>

    <ConversationDrawer
      :conversations="conversations"
      :active-id="activeId"
      @on-select-conversation="handleSelect"
      @on-delete-conversation="handleDelete"
    />
  </aside>
</template>

<script setup lang="ts">
import { Plus } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import ConversationDrawer from './ConversationDrawer.vue';
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
