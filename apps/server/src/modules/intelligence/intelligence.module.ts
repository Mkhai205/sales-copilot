import { Module } from '@nestjs/common';
import { LlmGatewayModule } from './llm-gateway/llm-gateway.module';

@Module({
  imports: [LlmGatewayModule],
  exports: [LlmGatewayModule],
})
export class IntelligenceModule {}
