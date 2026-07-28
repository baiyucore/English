import { Controller, Get, Post, Body, Res, Query } from '@nestjs/common';
import { CharService } from './char.service';
import type { ChatDto, ChatRoleType } from '@en/common/chat';
import type { Response } from 'express';
@Controller('chat')
export class CharController {
  constructor(private readonly charService: CharService) {}

  @Post()
  async create(@Body() createCharDto: ChatDto, @Res() res: Response) {
    // 设置 格式化SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const stream = await this.charService.streamCompletion(createCharDto);
      for await (const chunk of stream) {
        const [msg] = chunk;
        if (msg.getType() !== 'ai' || !msg.content) continue;
        if (typeof msg.content !== 'string') continue;
        res.write(
          `data: ${JSON.stringify({ type: 'delta', role: 'ai', content: msg.content })}\n\n`,
        );
      }
      res.write(`data: ${JSON.stringify({ type: 'done', role: 'ai' })}\n\n`);
    } catch {
      res.write(
        `data: ${JSON.stringify({ type: 'error', role: 'ai', content: 'AI 回复失败' })}\n\n`,
      );
    } finally {
      res.end();
    }
  }

  @Get('history')
  findAll(@Query('userId') userId: string, @Query('role') role: ChatRoleType) {
    return this.charService.findAll(userId, role);
  }
}
