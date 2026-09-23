import { Module } from '@nestjs/common';
import { AiAgentModule } from './ai-agent/ai-agent.module';
import { KnowledgeModule } from './knowledge/knowledge.module';

@Module({
  imports: [AiAgentModule, KnowledgeModule],
  exports: [AiAgentModule, KnowledgeModule],
})
export class IntelligenceModule {}
