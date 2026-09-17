import { Module } from '@nestjs/common';
import { AiAgentModule } from './ai-agent/ai-agent.module';

@Module({
  imports: [AiAgentModule],
  exports: [AiAgentModule],
})
export class IntelligenceModule {}
