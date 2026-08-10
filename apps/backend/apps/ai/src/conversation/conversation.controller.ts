import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '@libs/shared';
import { ConversationService } from './conversation.service';

/**
 * 会话管理接口暂时保留 /prompt 路径，兼容现有客户端；实现已从 prompt
 * 模块移出，避免把持久化职责和运行时 Prompt 组装混在一起。
 */
@Controller('prompt')
@UseGuards(AuthGuard)
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  findAll(@CurrentUser('userId') userId: string) {
    return this.conversationService.findAll(userId);
  }

  @Get('search')
  search(
    @CurrentUser('userId') userId: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.conversationService.search(userId, keyword);
  }

  @Post()
  @HttpCode(200)
  create(
    @CurrentUser('userId') userId: string,
    @Query('title') title?: string,
  ) {
    return this.conversationService.create(userId, title);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.conversationService.remove(id, userId);
  }
}
