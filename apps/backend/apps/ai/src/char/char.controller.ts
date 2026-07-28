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
    const stream = await this.charService.streamCompletion(createCharDto);
    for await (const chunk of stream) {
      const [msg] = chunk;
      if (msg.getType() !== 'ai' || !msg.content) continue;
      if (typeof msg.content !== 'string') continue;
      res.write(
        `data: ${JSON.stringify({ content: msg.content, role: 'ai' })}\n\n`,
      );
    }
    res.end();
  }

  @Get('history')
  findAll(@Query('userId') userId: string, @Query('role') role: ChatRoleType) {
    return this.charService.findAll(userId, role);
  }
}
