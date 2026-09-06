import { BadGatewayException, Injectable, Logger, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import {
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
} from '@sales-copilot/shared-contracts';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { OpenAIAdapter } from './adapters/openai.adapter';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
import { StructuredOutputService } from './structured-output.service';
import { LlmProviderAdapter, ProviderCredentials } from './interfaces/llm-provider.interface';
import { ChannelCredentialService } from '../inboxes/channel-credential.service';
import { PrismaService } from '../../infrastructure/database';

export interface GatewayCompletionRequest {
  workspaceId: string;
  messages: LlmMessage[];
  options?: LlmCompletionOptions;
  preferredProvider?: LlmProvider;
}

export interface GatewayStructuredRequest<T> extends GatewayCompletionRequest {
  schema: z.ZodType<T, z.ZodTypeDef, any>;
  jsonSchema?: Record<string, any>;
  schemaName?: string;
}

@Injectable()
export class LlmGatewayService {
  private readonly logger = new Logger(LlmGatewayService.name);
  private readonly adapters = new Map<LlmProvider, LlmProviderAdapter>();

  constructor(
    private readonly geminiAdapter: GeminiAdapter,
    private readonly openAiAdapter: OpenAIAdapter,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly rateLimiterService: RateLimiterService,
    private readonly structuredOutputService: StructuredOutputService,
    private readonly eventEmitter: EventEmitter2,
    @Optional() private readonly prismaService?: PrismaService,
    @Optional() private readonly channelCredentialService?: ChannelCredentialService,
  ) {
    this.adapters.set(LlmProvider.GEMINI, this.geminiAdapter);
    this.adapters.set(LlmProvider.OPENAI, this.openAiAdapter);
  }

  /**
   * Retrieves provider adapter by enum.
   */
  getAdapter(provider: LlmProvider): LlmProviderAdapter {
    const adapter = this.adapters.get(provider);
    if (!adapter) {
      throw new BadGatewayException({
        code: 'LLM_PROVIDER_NOT_SUPPORTED',
        message: `Provider ${provider} is not registered or supported`,
      });
    }
    return adapter;
  }

  /**
   * Resolves provider credentials for workspace (BYOK vs system default).
   */
  async resolveCredentials(
    workspaceId: string,
    provider: LlmProvider,
  ): Promise<ProviderCredentials | undefined> {
    if (!this.prismaService) return undefined;

    try {
      const workspace = await this.prismaService.client.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });

      const settings = (workspace?.settings || {}) as Record<string, any>;
      const llmCredsCipher = settings.llmCredentials?.[provider];

      if (llmCredsCipher && this.channelCredentialService) {
        return this.channelCredentialService.decrypt<ProviderCredentials>(llmCredsCipher);
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to resolve BYOK credentials for workspace ${workspaceId}: ${err.message}`,
      );
    }

    return undefined;
  }

  /**
   * Executes completion with rate limit check, circuit breaker protection, and automatic failover.
   */
  async generateCompletion(request: GatewayCompletionRequest): Promise<LlmCompletionResult> {
    const { workspaceId, messages, options, preferredProvider } = request;

    // 1. Pre-flight rate limiting & quota reservation
    const estimatedTokens = this.rateLimiterService.estimateTokens(
      messages.map(m => m.content).join(' '),
    );
    await this.rateLimiterService.checkAndReserve(workspaceId, estimatedTokens);

    // 2. Determine primary and secondary providers
    const primaryProvider = preferredProvider || LlmProvider.GEMINI;
    const secondaryProvider =
      primaryProvider === LlmProvider.GEMINI ? LlmProvider.OPENAI : LlmProvider.GEMINI;

    let result: LlmCompletionResult | null = null;
    let lastError: any = null;

    // 3. Try primary provider if circuit permits
    if (this.circuitBreakerService.canExecute(primaryProvider)) {
      try {
        const credentials = await this.resolveCredentials(workspaceId, primaryProvider);
        const adapter = this.getAdapter(primaryProvider);

        result = await adapter.generateCompletion(messages, options, credentials);
        this.circuitBreakerService.recordSuccess(primaryProvider);
      } catch (err: any) {
        lastError = err;
        this.circuitBreakerService.recordFailure(primaryProvider, err);

        this.logger.warn(
          `Primary LLM provider ${primaryProvider} failed for workspace ${workspaceId}: ${err.message}. Initiating failover to ${secondaryProvider}...`,
        );

        this.eventEmitter.emit('llm.fallback_triggered', {
          workspaceId,
          fromProvider: primaryProvider,
          toProvider: secondaryProvider,
          reason: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      this.logger.warn(
        `Primary LLM provider ${primaryProvider} circuit is ${this.circuitBreakerService.getState(primaryProvider)}. Immediately routing to fallback ${secondaryProvider}`,
      );

      this.eventEmitter.emit('llm.fallback_triggered', {
        workspaceId,
        fromProvider: primaryProvider,
        toProvider: secondaryProvider,
        reason: `Circuit Breaker state: ${this.circuitBreakerService.getState(primaryProvider)}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 4. Fallback execution if primary failed or was blocked
    if (!result) {
      if (this.circuitBreakerService.canExecute(secondaryProvider)) {
        try {
          const credentials = await this.resolveCredentials(workspaceId, secondaryProvider);
          const adapter = this.getAdapter(secondaryProvider);

          result = await adapter.generateCompletion(messages, options, credentials);
          this.circuitBreakerService.recordSuccess(secondaryProvider);
        } catch (err: any) {
          this.circuitBreakerService.recordFailure(secondaryProvider, err);
          this.logger.error(
            `Secondary LLM provider ${secondaryProvider} also failed: ${err.message}`,
          );
          lastError = err;
        }
      } else {
        this.logger.error(
          `Secondary LLM provider ${secondaryProvider} circuit is also not accessible.`,
        );
      }
    }

    // 5. If both failed, throw BadGatewayException
    if (!result) {
      throw new BadGatewayException({
        code: 'LLM_ALL_PROVIDERS_UNAVAILABLE',
        message:
          'All configured LLM providers failed to complete the request. Please try again shortly.',
        details: lastError?.message || 'Circuit breakers open or upstream service error',
      });
    }

    // 6. Reconcile token consumption
    await this.rateLimiterService.recordActualUsage(
      workspaceId,
      result.metrics.totalTokens,
      estimatedTokens,
    );

    // 7. Emit consumption event
    this.eventEmitter.emit('llm.token_consumed', {
      workspaceId,
      ...result.metrics,
      timestamp: new Date().toISOString(),
    });

    return result;
  }

  /**
   * Generates streaming tokens asynchronously with fallback handling.
   */
  async *generateStream(request: GatewayCompletionRequest): AsyncIterable<LlmStreamChunk> {
    const { workspaceId, messages, options, preferredProvider } = request;

    const estimatedTokens = this.rateLimiterService.estimateTokens(
      messages.map(m => m.content).join(' '),
    );
    await this.rateLimiterService.checkAndReserve(workspaceId, estimatedTokens);

    let activeProvider = preferredProvider || LlmProvider.GEMINI;
    if (!this.circuitBreakerService.canExecute(activeProvider)) {
      activeProvider =
        activeProvider === LlmProvider.GEMINI ? LlmProvider.OPENAI : LlmProvider.GEMINI;
      this.logger.warn(
        `Primary provider circuit not ready. Streaming routed directly to fallback ${activeProvider}`,
      );
    }

    const credentials = await this.resolveCredentials(workspaceId, activeProvider);
    const adapter = this.getAdapter(activeProvider);

    let finalMetrics: any;
    try {
      const stream = adapter.generateStream(messages, options, credentials);
      for await (const chunk of stream) {
        if (chunk.metrics) {
          finalMetrics = chunk.metrics;
        }
        yield chunk;
      }
      this.circuitBreakerService.recordSuccess(activeProvider);
    } catch (err: any) {
      this.circuitBreakerService.recordFailure(activeProvider, err);
      this.logger.error(`Streaming failed on ${activeProvider}: ${err.message}`);
      throw new BadGatewayException({
        code: 'LLM_STREAMING_FAILED',
        message: `Streaming error from ${activeProvider}`,
        details: err.message,
      });
    }

    if (finalMetrics) {
      await this.rateLimiterService.recordActualUsage(
        workspaceId,
        finalMetrics.totalTokens,
        estimatedTokens,
      );
      this.eventEmitter.emit('llm.token_consumed', {
        workspaceId,
        ...finalMetrics,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Generates type-safe structured JSON output validated against Zod schema with 1-shot auto-repair.
   */
  async generateStructured<T>(
    request: GatewayStructuredRequest<T>,
  ): Promise<{ data: T; result: LlmCompletionResult }> {
    const { schema, ...completionRequest } = request;

    // Define repair executor that queries the gateway again if attempt 1 fails
    const repairExecutor = async (repairPrompt: string): Promise<string> => {
      const repairMessages: LlmMessage[] = [
        ...completionRequest.messages,
        { role: 'user', content: repairPrompt },
      ];
      const repairResult = await this.generateCompletion({
        ...completionRequest,
        messages: repairMessages,
        options: {
          ...completionRequest.options,
          temperature: 0.1,
        },
      });
      return repairResult.content;
    };

    const completion = await this.generateCompletion(completionRequest);

    const validatedData = await this.structuredOutputService.parseAndValidate<T>({
      schema,
      rawOutput: completion.content,
      repairExecutor,
    });

    return {
      data: validatedData,
      result: completion,
    };
  }
}
