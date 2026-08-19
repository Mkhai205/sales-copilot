import { z } from 'zod';
import { UserContext } from '@sales-copilot/shared';
import { LLMToolDefinition } from '../ports';

export interface ToolExecutionContext {
  context: UserContext;
  conversationId?: string;
  contactId?: string;
  leadId?: string;
  metadata?: Record<string, unknown>;
}

export interface ToolExecutionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
}

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodType<TInput>;
  toLLMDefinition(): LLMToolDefinition;
  execute(input: TInput, context: ToolExecutionContext): Promise<ToolExecutionResult<TOutput>>;
}
