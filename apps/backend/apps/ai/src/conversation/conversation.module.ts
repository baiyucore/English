import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';

@Module({
  imports: [AgentModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}
