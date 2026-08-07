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
          <div
            v-for="conversation in conversations"
            :key="conversation.id"
            class="group relative"
          >
            <button
              type="button"
              :class="
                cn(
                  'w-full rounded-[5px] px-3 py-2 pr-9 text-left text-sm text-gray-700 transition-all duration-300',
                  activeId === conversation.id
                    ? 'bg-purple-300'
                    : 'hover:bg-purple-100',
                )
              "
              @click="handleSelect(conversation.id)"
            >
              <span class="block truncate">{{ conversation.title }}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="absolute top-1/2 right-1 flex size-7 -translate-y-1/2 items-center justify-center rounded-[5px] text-gray-500 opacity-0 transition-opacity hover:bg-purple-200 hover:text-gray-700 group-hover:opacity-100 data-[state=open]:opacity-100"
                  aria-label="更多操作"
                  @click.stop
                >
                  <Ellipsis class="size-4" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" side="bottom" class="min-w-28">
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
          </div>

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
import { ChevronDown, Ellipsis, Trash2 } from 'lucide-vue-next';
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

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
};

const handleDelete = (id: string) => {
  emits('onDeleteConversation', id);
};
</script>
