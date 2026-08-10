import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AgentModule } from './agent/agent.module';
import { ConversationModule } from './conversation/conversation.module';
import { MetricsModule } from './metrics/metrics.module';
import { SharedModule } from '@libs/shared';

@Module({
  imports: [AgentModule, ConversationModule, MetricsModule, SharedModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
