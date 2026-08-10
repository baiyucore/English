import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import type { Response } from 'express';
import { openSseReply, writeSseEvent } from './stream/sse';
import { AuthGuard, CurrentUser } from '@libs/shared';
import { ChatRequestDto } from './dto/chat.dto';

@Controller('chat')
@UseGuards(AuthGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  async stream(
    @Body() chatDto: ChatRequestDto,
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const abortController = new AbortController();

    res.on('close', () => {
      abortController.abort();
    });
    openSseReply(res);

    try {
      await this.agentService.stream(
        { ...chatDto, userId },
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
    @CurrentUser('userId') userId: string,
  ) {
    return this.agentService.findAll(conversationId, userId);
  }
}
