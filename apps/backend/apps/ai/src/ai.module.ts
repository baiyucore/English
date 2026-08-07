import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentModule } from './agent/agent.module';
import { PromptModule } from './prompt/prompt.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharedModule } from '@libs/shared';

@Module({
  imports: [AgentModule, PromptModule, MetricsModule, SharedModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
