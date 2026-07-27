import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CharModule } from './char/char.module';
import { PromptModule } from './prompt/prompt.module';
import { SharedModule } from '@libs/shared';

@Module({
  imports: [CharModule, PromptModule, SharedModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
