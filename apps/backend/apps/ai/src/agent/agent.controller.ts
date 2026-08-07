import { Controller, Get, Post, Body, Res, Query } from '@nestjs/common';
import { AgentService } from './agent.service';
import type { ChatDto } from '@en/common/chat';
import type { Response } from 'express';
import { openSseReply, writeSseEvent } from './stream/sse';

@Controller('chat')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  async stream(@Body() chatDto: ChatDto, @Res() res: Response) {
    const abortController = new AbortController();

    res.on('close', () => {
      abortController.abort();
    });
    openSseReply(res);

    try {
      await this.agentService.stream(
        chatDto,
        (event) => {
          writeSseEvent(res, event);
        },
        { signal: abortController.signal },
      );
    } catch {
      writeSseEvent(res, {
        type: 'error',
        role: 'ai',
        error: 'AI 回复失败',
      });
    } finally {
      if (!res.writableEnded) {
        res.end();
      }
    }
  }

  @Get('history')
  findAll(
    @Query('conversationId') conversationId: string,
    @Query('userId') userId?: string,
  ) {
    return this.agentService.findAll(conversationId, userId);
  }
}
