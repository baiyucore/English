import { Controller, Get, Post, Body, Res, Query } from '@nestjs/common';
import { AgentService } from './agent.service';
import type { ChatAssistantKey, ChatDto } from '@en/common/chat';
import type { Response } from 'express';
@Controller('chat')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  async create(@Body() chatDto: ChatDto, @Res() res: Response) {
    const controller = new AbortController();

    res.on('close', () => {
      controller.abort();
    });
    // 设置 格式化SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const writeEvent = (payload: Record<string, unknown>) => {
      if (controller.signal.aborted || res.writableEnded) return;
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      const stream = await this.agentService.streamCompletion(
        chatDto,
        controller.signal,
      );
      for await (const chunk of stream) {
        if (controller.signal.aborted) break;
        const [msg] = chunk;
        if (msg.getType() !== 'ai' || !msg.content) continue;
        if (typeof msg.content !== 'string') continue;
        writeEvent({ type: 'delta', role: 'ai', content: msg.content });
      }
      if (!controller.signal.aborted) {
        writeEvent({ type: 'done', role: 'ai' });
      }
    } catch {
      if (!controller.signal.aborted) {
        writeEvent({
          type: 'error',
          role: 'ai',
          error: 'AI 回复失败',
        });
      }
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Get('history')
  findAll(
    @Query('conversationId') conversationId: string,
    @Query('assistantKey') assistantKey?: ChatAssistantKey,
    @Query('userId') userId?: string,
  ) {
    return this.agentService.findAll(conversationId, {
      assistantKey,
      userId,
    });
  }
}
