import { Module } from '@nestjs/common';
import { InboxesModule } from '../inboxes';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
import { StructuredOutputService } from './structured-output.service';
import { LlmGatewayService } from './llm-gateway.service';

@Module({
  imports: [InboxesModule],
  providers: [
    GeminiAdapter,
    OpenAIAdapter,
    CircuitBreakerService,
    RateLimiterService,
    StructuredOutputService,
    LlmGatewayService,
  ],
  exports: [
    GeminiAdapter,
    OpenAIAdapter,
    CircuitBreakerService,
    RateLimiterService,
    StructuredOutputService,
    LlmGatewayService,
  ],
})
export class LlmGatewayModule {}
