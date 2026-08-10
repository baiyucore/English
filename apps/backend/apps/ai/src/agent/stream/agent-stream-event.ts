import type { ChatStreamEvent } from '@en/common/chat';

export type AgentStreamEvent = ChatStreamEvent;

export type AgentStreamEmit = (event: AgentStreamEvent) => void | Promise<void>;
