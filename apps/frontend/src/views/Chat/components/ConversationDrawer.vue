<template>
  <nav class="flex min-h-0 flex-1 flex-col" aria-label="聊天记录">
    <ScrollArea class="min-h-0 flex-1 px-2 pb-3">
      <div v-if="grouped.length === 0" class="px-3 py-8 text-center">
        <p class="text-sm text-muted-foreground">暂无聊天记录</p>
      </div>

      <section v-for="group in grouped" :key="group.label" class="mb-4">
        <h2
          class="px-2 pb-1 pt-2 text-xs font-medium tracking-wide text-zinc-500"
        >
          {{ group.label }}
        </h2>

        <ul class="flex flex-col gap-0.5">
          <li
            v-for="conversation in group.items"
            :key="conversation.id"
            class="group relative"
          >
            <button
              type="button"
              :class="
                cn(
                  'flex min-h-11 w-full items-center rounded-lg px-3 py-2 pr-9 text-left text-sm text-zinc-700 transition-colors',
                  activeId === conversation.id
                    ? 'bg-zinc-200/80'
                    : 'hover:bg-zinc-200/50',
                )
              "
              :aria-current="activeId === conversation.id ? 'page' : undefined"
              @click="handleSelect(conversation.id)"
            >
              <span class="block truncate">{{ conversation.title }}</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <button
                  type="button"
                  class="absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-300/70 hover:text-zinc-800 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
                  aria-label="更多操作"
                  @click.stop
                >
                  <Ellipsis class="size-4" aria-hidden="true" />
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
          </li>
        </ul>
      </section>
    </ScrollArea>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Ellipsis, Trash2 } from 'lucide-vue-next';
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

const props = defineProps<{
  conversations: ConversationItem[];
  activeId: string | null;
}>();

const emits = defineEmits<{
  onSelectConversation: [id: string];
  onDeleteConversation: [id: string];
}>();

const DAY = 86_400_000;
const GROUP_ORDER = [
  '今天',
  '昨天',
  '最近 7 天',
  '最近 30 天',
  '更早',
] as const;

const startOfDay = (timestamp: number) => {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const groupLabel = (updatedAt: number) => {
  const today = startOfDay(Date.now());
  const day = startOfDay(updatedAt || 0);
  if (day === today) return '今天';
  if (day === today - DAY) return '昨天';
  if (day > today - 7 * DAY) return '最近 7 天';
  if (day > today - 30 * DAY) return '最近 30 天';
  return '更早';
};

const grouped = computed(() => {
  const sorted = [...props.conversations].sort(
    (left, right) => right.updatedAt - left.updatedAt,
  );
  const buckets = new Map<string, ConversationItem[]>();

  for (const conversation of sorted) {
    const label = groupLabel(conversation.updatedAt);
    const items = buckets.get(label) ?? [];
    items.push(conversation);
    buckets.set(label, items);
  }

  return GROUP_ORDER.filter((label) => buckets.has(label)).map((label) => ({
    label,
    items: buckets.get(label) ?? [],
  }));
});

const handleSelect = (id: string) => {
  emits('onSelectConversation', id);
};

const handleDelete = (id: string) => {
  emits('onDeleteConversation', id);
};
</script>
