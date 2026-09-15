<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        class="flex min-h-11 max-w-full items-center gap-1 rounded-lg px-2.5 py-1.5 text-left text-base font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="disabled"
        aria-label="选择 AI 执行模式"
      >
        <span class="truncate">{{ currentLabel }}</span>
        <ChevronDown class="size-4 shrink-0 text-zinc-400" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class="w-72 p-1.5">
      <DropdownMenuGroup>
        <DropdownMenuItem
          v-for="option in options"
          :key="option.value"
          class="items-start gap-3 rounded-lg px-3 py-2.5"
          :disabled="option.disabled"
          @select="selectMode(option)"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-zinc-800">{{ option.label }}</p>
            <p class="mt-0.5 text-xs leading-4 text-muted-foreground">
              {{ option.description }}
            </p>
          </div>
          <Check
            v-if="mode === option.value"
            class="mt-0.5 size-4 shrink-0 text-zinc-800"
            aria-hidden="true"
          />
        </DropdownMenuItem>
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Check, ChevronDown } from 'lucide-vue-next';
import type { ChatExecutionMode } from '@en/common/chat';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ModeOption = {
  value: ChatExecutionMode;
  label: string;
  description: string;
  disabled?: boolean;
};

const props = defineProps<{
  mode: ChatExecutionMode;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  change: [mode: ChatExecutionMode];
}>();

const options: ModeOption[] = [
  {
    value: 'langchain',
    label: 'LangChain 学习链',
    description: '直接使用英语学习 Prompt 生成回答',
  },
  {
    value: 'hybrid',
    label: '工作流',
    description: '按任务路由到对应技能后再回答',
  },
  {
    value: 'langgraph_agent',
    label: 'Graph Agent',
    description: 'SDK 即将接入',
    disabled: true,
  },
];

const currentLabel = computed(() => {
  return options.find((item) => item.value === props.mode)?.label ?? '选择模式';
});

const selectMode = (option: ModeOption) => {
  if (option.disabled || props.disabled || option.value === props.mode) return;
  emit('change', option.value);
};
</script>
