import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
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
export class GeminiAdapter implements LlmProviderAdapter {
  private readonly logger = new Logger(GeminiAdapter.name);
  readonly providerName = LlmProvider.GEMINI;

  private readonly defaultApiKey?: string;
  private defaultClient?: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    this.defaultApiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (this.defaultApiKey) {
      this.defaultClient = new GoogleGenAI({ apiKey: this.defaultApiKey });
    }
  }

  private getClient(credentials?: ProviderCredentials): GoogleGenAI {
    const apiKey = credentials?.apiKey || this.defaultApiKey;
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please set GEMINI_API_KEY or provide workspace credentials.',
      );
    }

    if (credentials?.apiKey && credentials.apiKey !== this.defaultApiKey) {
      return new GoogleGenAI({ apiKey: credentials.apiKey });
    }

    if (!this.defaultClient) {
      this.defaultClient = new GoogleGenAI({ apiKey });
    }
    return this.defaultClient;
  }

  private prepareContentsAndSystem(messages: LlmMessage[]): {
    systemInstruction?: string;
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  } {
    let systemInstruction: string | undefined;
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemInstruction = systemInstruction
          ? `${systemInstruction}\n\n${msg.content}`
          : msg.content;
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    // Ensure at least one content exists
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: '' }] });
    }

    return { systemInstruction, contents };
  }

  private calculateMetrics(usage: any, startTime: number, model: string): LlmUsageMetrics {
    const latencyMs = Math.max(1, Date.now() - startTime);
    const promptTokens = usage?.promptTokenCount || 0;
    const completionTokens = usage?.candidatesTokenCount || 0;
    const totalTokens = usage?.totalTokenCount || promptTokens + completionTokens;

    // Cost estimation for Gemini 2.5 Flash: $0.075/1M input, $0.30/1M output
    const promptCost = (promptTokens / 1_000_000) * 0.075;
    const completionCost = (completionTokens / 1_000_000) * 0.3;
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
    const model = options?.model || 'gemini-2.5-flash';
    const { systemInstruction, contents } = this.prepareContentsAndSystem(messages);

    const startTime = Date.now();
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: options?.temperature ?? 0.2,
        maxOutputTokens: options?.maxTokens,
      },
    });

    const content = response.text || '';
    const metrics = this.calculateMetrics(response.usageMetadata, startTime, model);

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
    const model = options?.model || 'gemini-2.5-flash';
    const { systemInstruction, contents } = this.prepareContentsAndSystem(messages);

    const startTime = Date.now();
    const responseStream = await client.models.generateContentStream({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: options?.temperature ?? 0.7,
        maxOutputTokens: options?.maxTokens,
      },
    });

    let lastUsageMetadata: any;
    for await (const chunk of responseStream) {
      if (chunk.usageMetadata) {
        lastUsageMetadata = chunk.usageMetadata;
      }
      const text = chunk.text;
      if (text) {
        yield {
          chunk: text,
          isDone: false,
        };
      }
    }

    const metrics = this.calculateMetrics(lastUsageMetadata, startTime, model);
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
    const model = options.model || 'gemini-2.5-flash';
    const { systemInstruction, contents } = this.prepareContentsAndSystem(messages);

    const startTime = Date.now();
    const response = await client.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
        temperature: options.temperature ?? 0.1,
        maxOutputTokens: options.maxTokens,
        responseMimeType: 'application/json',
        responseSchema: options.jsonSchema,
      },
    });

    const rawText = response.text || '{}';
    let data: T;
    try {
      data = JSON.parse(rawText) as T;
    } catch (err: any) {
      this.logger.warn(`Failed to parse Gemini JSON output: ${err.message}. Raw: ${rawText}`);
      throw err;
    }

    const metrics = this.calculateMetrics(response.usageMetadata, startTime, model);
    return {
      data,
      rawText,
      metrics,
    };
  }
}
