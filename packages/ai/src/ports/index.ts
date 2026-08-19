import { z } from 'zod';

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMMessage {
  role: LLMRole;
  content: string;
  name?: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  tools?: LLMToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  responseFormat?: { type: 'json_object' | 'text' };
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMCompletionResult {
  content: string | null;
  toolCalls?: LLMToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | string;
  usage: LLMUsage;
  rawResponse?: unknown;
}

export interface LLMStreamChunk {
  deltaContent?: string;
  toolCalls?: Partial<LLMToolCall>[];
  isFinished: boolean;
  finishReason?: string;
}

export interface LLMProvider {
  readonly providerName: 'openai' | 'gemini' | string;
  generateChat(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): Promise<LLMCompletionResult>;
  generateStructuredOutput<T>(
    messages: LLMMessage[],
    schema: z.ZodType<T>,
    options?: LLMCompletionOptions,
  ): Promise<{ data: T; usage: LLMUsage }>;
  generateStream?(
    messages: LLMMessage[],
    options?: LLMCompletionOptions,
  ): AsyncIterable<LLMStreamChunk>;
}
