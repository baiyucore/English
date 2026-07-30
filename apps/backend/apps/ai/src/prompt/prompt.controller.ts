import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { PromptService } from './prompt.service';
import { CreatePromptDto } from './dto/create-prompt.dto';

@Controller('prompt')
export class PromptController {
  constructor(private readonly promptService: PromptService) {}

  @Get()
  findAll() {
    return this.promptService.findAll();
  }

  @Post()
  @HttpCode(200)
  create(@Body() createPromptDto: CreatePromptDto) {
    return this.promptService.create(createPromptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promptService.remove(id);
  }
}
