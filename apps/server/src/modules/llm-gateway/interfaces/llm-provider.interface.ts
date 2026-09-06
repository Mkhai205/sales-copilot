import {
  LlmCompletionOptions,
  LlmCompletionResult,
  LlmMessage,
  LlmProvider,
  LlmStreamChunk,
  LlmUsageMetrics,
} from '@sales-copilot/shared-contracts';

export interface ProviderCredentials {
  apiKey: string;
  baseUrl?: string;
  organizationId?: string;
  [key: string]: unknown;
}

export interface StructuredOutputOptions extends LlmCompletionOptions {
  schemaName?: string;
  jsonSchema: Record<string, any>;
}

export interface StructuredOutputResult<T = unknown> {
  data: T;
  rawText: string;
  metrics: LlmUsageMetrics;
}

export interface LlmProviderAdapter {
  readonly providerName: LlmProvider;

  generateCompletion(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    credentials?: ProviderCredentials,
  ): Promise<LlmCompletionResult>;

  generateStream(
    messages: LlmMessage[],
    options?: LlmCompletionOptions,
    credentials?: ProviderCredentials,
  ): AsyncIterable<LlmStreamChunk>;

  generateStructuredOutput<T = unknown>(
    messages: LlmMessage[],
    options: StructuredOutputOptions,
    credentials?: ProviderCredentials,
  ): Promise<StructuredOutputResult<T>>;
}
