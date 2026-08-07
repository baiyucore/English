import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { PromptService } from './prompt.service';

@Controller('prompt')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  findAll(@Query('userId') userId: string) {
    return this.promptService.findAll(userId);
  }

  @Get('search')
  search(
    @Query('userId') userId: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.promptService.search(userId, keyword);
  }

  @Post()
  @HttpCode(200)
  create(
    @Query('userId') userId: string,
    @Query('title') title?: string,
  ) {
    return this.promptService.create(userId, title);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Query('userId') userId: string) {
    return this.promptService.remove(id, userId);
  }
}
