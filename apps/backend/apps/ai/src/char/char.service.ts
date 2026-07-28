import { Injectable, OnModuleInit } from '@nestjs/common';
import { createCheckerPoint, createDeepSeek } from '../llm/llm.config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';
import { ChatRoleType, ChatDto } from '@en/common/chat';
import type { AIMessageChunk, ReactAgent } from 'langchain';
import { chatMode } from '../prompt/prompt.mode';
import { createAgent } from 'langchain';
import { ResponseService } from '@libs/shared';
@Injectable()
export class CharService implements OnModuleInit {
  constructor(private readonly responseService: ResponseService) {}
  private checkerPoint!: PostgresSaver;
  private agents: Map<ChatRoleType, ReactAgent> = new Map();
  async onModuleInit() {
    this.checkerPoint = await createCheckerPoint();
    for (const mode of chatMode) {
      const agent = createAgent({
        model: createDeepSeek(),
        checkpointer: this.checkerPoint,
        systemPrompt: mode.prompt,
      });
      this.agents.set(mode.role, agent);
    }
  }
  streamCompletion(createCharDto: ChatDto) {
    const agent = this.agents.get(createCharDto.role);
    if (!agent) {
      throw new Error('Agent not found');
    }
    const id = `${createCharDto.userId}-${createCharDto.role}`;
    const steam = agent.stream(
      {
        messages: [{ role: 'human', content: createCharDto.content }],
      },
      {
        configurable: {
          thread_id: id,
        },
        streamMode: 'messages',
      },
    );
    return steam;
  }

  async findAll(userId: string, role: ChatRoleType) {
    const messages = await this.checkerPoint.get({
      configurable: {
        thread_id: `${userId}-${role}`,
      },
    });
    const list = messages?.channel_values.messages as AIMessageChunk[];
    if (!list) return this.responseService.success([]);
    return this.responseService.success(
      list.map((item) => ({
        content: item.content,
        role: item.type,
      })),
    );
  }
}
