import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCheckerPoint, createDeepSeek } from '../llm/llm.config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ChatDto } from '@en/common/chat';
import type { AIMessageChunk, ReactAgent } from 'langchain';
import type { ChatAssistantItem } from '../prompt/prompt.mode';
import { createAgent } from 'langchain';
import { ResponseService } from '@libs/shared';

@Injectable()
export class AgentService implements OnModuleInit {
  constructor(private readonly responseService: ResponseService) {}
  private checkerPoint!: PostgresSaver;
  private assistants: Map<string, ReactAgent> = new Map();

  async onModuleInit() {
    this.checkerPoint = await createCheckerPoint();
  }

  registerAssistant(mode: ChatAssistantItem) {
    const agent = createAgent({
      model: createDeepSeek(),
      checkpointer: this.checkerPoint,
      systemPrompt: mode.prompt,
    });
    this.assistants.set(mode.key, agent);
  }

  unregisterAssistant(key: string) {
    this.assistants.delete(key);
  }

  streamCompletion(chatDto: ChatDto, signal?: AbortSignal) {
    const agent = this.assistants.get(chatDto.assistantKey);
    if (!agent) {
      throw new Error('Agent not found');
    }
    const threadId = chatDto.conversationId.trim();
    if (!threadId) {
      throw new Error('Conversation not found');
    }
    return agent.stream(
      {
        messages: [{ role: 'human', content: chatDto.content }],
      },
      {
        configurable: {
          thread_id: threadId,
        },
        streamMode: 'messages',
        signal,
      },
    );
  }

  async findAll(
    conversationId: string,
    fallback?: { assistantKey?: string; userId?: string },
  ) {
    const threadId =
      conversationId?.trim() ||
      buildLegacyThreadId(fallback?.userId, fallback?.assistantKey);

    if (!threadId) return this.responseService.success([]);

    const messages = await this.checkerPoint.get({
      configurable: {
        thread_id: threadId,
      },
    });
    const list = messages?.channel_values.messages as AIMessageChunk[];
    if (!list) return this.responseService.success([]);
    return this.responseService.success(
      list.map((item) => ({
        content: item.content,
        role: item.type === 'ai' ? 'ai' : 'human',
      })),
    );
  }
}

function buildLegacyThreadId(userId?: string, assistantKey?: string) {
  if (!userId || !assistantKey) {
    return '';
  }

  return `${userId}-${assistantKey}`;
}
