<template>
  <Collapsible
    v-model:open="open"
    class="flex min-h-0 flex-1 flex-col px-2 pb-4"
  >
    <CollapsibleTrigger
      class="flex w-full items-center justify-between rounded-[5px] px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-purple-100"
    >
      <span>聊天记录</span>
      <ChevronDown
        class="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
        :class="open && 'rotate-180'"
      />
    </CollapsibleTrigger>

    <CollapsibleContent
      class="mt-1 flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <ScrollArea class="min-h-0 flex-1">
        <div class="flex flex-col gap-1 pr-2">
          <DropdownMenu
            v-for="conversation in conversations"
            :key="conversation.id"
            :open="hoveredId === conversation.id"
            @update:open="handleMenuOpenChange(conversation.id, $event)"
          >
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                :class="
                  cn(
                    'w-full rounded-[5px] px-3 py-2 text-left text-sm text-gray-700 transition-all duration-300',
                    activeId === conversation.id && 'bg-purple-300',
                  )
                "
                @mouseenter="hoveredId = conversation.id"
                @mouseleave="handleTriggerLeave"
                @click="handleSelect(conversation.id)"
              >
                <span class="block truncate">{{ conversation.title }}</span>
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="start"
              side="bottom"
              class="min-w-28"
              @mouseenter="hoveredId = conversation.id"
              @mouseleave="hoveredId = null"
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  @select="handleDelete(conversation.id)"
                >
                  <Trash2 />
                  删除
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <p
            v-if="conversations.length === 0"
            class="px-3 py-6 text-center text-sm text-muted-foreground"
          >
            暂无聊天记录
          </p>
        </div>
      </ScrollArea>
    </CollapsibleContent>
  </Collapsible>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDown, Trash2 } from 'lucide-vue-next';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ConversationItem } from '../types';

defineProps<{
  conversations: ConversationItem[];
  activeId: string | null;
}>();

const emits = defineEmits<{
  onSelectConversation: [id: string];
  onDeleteConversation: [id: string];
}>();

const open = ref(true);
const hoveredId = ref<string | null>(null);
let leaveTimer: ReturnType<typeof setTimeout> | null = null;

const clearLeaveTimer = () => {
  if (leaveTimer) {
    clearTimeout(leaveTimer);
    leaveTimer = null;
  }
};

const handleTriggerLeave = () => {
  clearLeaveTimer();
  leaveTimer = setTimeout(() => {
    hoveredId.value = null;
  }, 120);
};

const handleMenuOpenChange = (id: string, isOpen: boolean) => {
  hoveredId.value = isOpen ? id : null;
};

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
};

const handleDelete = (id: string) => {
  hoveredId.value = null;
  emits('onDeleteConversation', id);
};
</script>
