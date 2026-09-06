import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmUsageMetrics,
} from '@sales-copilot/shared-contracts';
import {
  LlmProviderAdapter,
  ProviderCredentials,
  StructuredOutputOptions,
  StructuredOutputResult,
} from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIAdapter implements LlmProviderAdapter {
  private readonly logger = new Logger(OpenAIAdapter.name);
  readonly providerName = LlmProvider.OPENAI;

  private readonly defaultApiKey?: string;
  private defaultClient?: OpenAI;

  constructor(private readonly configService: ConfigService) {
    this.defaultApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (this.defaultApiKey) {
      this.defaultClient = new OpenAI({ apiKey: this.defaultApiKey });
    }
  }

  private getClient(credentials?: ProviderCredentials): OpenAI {
    const apiKey = credentials?.apiKey || this.defaultApiKey;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key is not configured. Please set OPENAI_API_KEY or provide workspace credentials.',
      );
    }

    if (credentials?.apiKey && credentials.apiKey !== this.defaultApiKey) {
      return new OpenAI({
        apiKey: credentials.apiKey,
        baseURL: credentials.baseUrl,
        organization: credentials.organizationId,
      });
    }

    if (!this.defaultClient) {
      this.defaultClient = new OpenAI({ apiKey });
    }
    return this.defaultClient;
  }

  private calculateMetrics(
    usage: OpenAI.Completions.CompletionUsage | undefined,
    startTime: number,
    model: string,
  ): LlmUsageMetrics {
    const latencyMs = Math.max(1, Date.now() - startTime);
    const promptTokens = usage?.prompt_tokens || 0;
    const completionTokens = usage?.completion_tokens || 0;
    const totalTokens = usage?.total_tokens || promptTokens + completionTokens;

    // Cost estimation for GPT-4o-mini: $0.15/1M input, $0.60/1M output
    const promptCost = (promptTokens / 1_000_000) * 0.15;
    const completionCost = (completionTokens / 1_000_000) * 0.6;
    const estimatedCostUsd = parseFloat((promptCost + completionCost).toFixed(6));

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      latencyMs,
      estimatedCostUsd,
      provider: this.providerName,
      model,
    };
  }

  async generateCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    credentials?: ProviderCredentials,
  ): Promise<LlmCompletionResult> {
    const client = this.getClient(credentials);
    const model = options?.model || 'gpt-4o-mini';

    const startTime = Date.now();
    const completion = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxTokens,
    });

    const content = completion.choices[0]?.message?.content || '';
    const metrics = this.calculateMetrics(completion.usage, startTime, model);

    return {
      content,
      metrics,
      provider: this.providerName,
      model,
    };
  }

  async *generateStream(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    credentials?: ProviderCredentials,
  ): AsyncIterable<LlmStreamChunk> {
    const client = this.getClient(credentials);
    const model = options?.model || 'gpt-4o-mini';

    const startTime = Date.now();
    const stream = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
      stream: true,
      stream_options: { include_usage: true },
    });

    let lastUsage: OpenAI.Completions.CompletionUsage | undefined;
    for await (const chunk of stream) {
      if (chunk.usage) {
        lastUsage = chunk.usage;
      }
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        yield {
          chunk: delta,
          isDone: false,
        };
      }
    }

    const metrics = this.calculateMetrics(lastUsage, startTime, model);
    yield {
      chunk: '',
      isDone: true,
      metrics,
    };
  }

  async generateStructuredOutput<T = unknown>(
    messages: LlmMessage[],
    options: StructuredOutputOptions,
    credentials?: ProviderCredentials,
  ): Promise<StructuredOutputResult<T>> {
    const client = this.getClient(credentials);
    const model = options.model || 'gpt-4o-mini';

    const startTime = Date.now();
    const completion = await client.chat.completions.create({
      model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: options.schemaName || 'structured_output',
          schema: options.jsonSchema,
          strict: false,
        },
      },
    });

    const rawText = completion.choices[0]?.message?.content || '{}';
    let data: T;
    try {
      data = JSON.parse(rawText) as T;
    } catch (err: any) {
      this.logger.warn(`Failed to parse OpenAI JSON output: ${err.message}. Raw: ${rawText}`);
      throw err;
    }

    const metrics = this.calculateMetrics(completion.usage, startTime, model);
    return {
      data,
      rawText,
      metrics,
    };
  }
}
