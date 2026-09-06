import { z } from 'zod';
import { LlmProvider } from './llm.enums';
import { llmProviderSchema } from './llm.schemas';

export const promptTemplateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.number().int().positive().default(1),
  provider: llmProviderSchema.default(LlmProvider.GEMINI),
  model: z.string().min(1).default('gemini-2.5-flash'),
  systemPrompt: z.string().min(1),
  userPromptTemplate: z.string().min(1),
  inputVariables: z.array(z.string()).default([]),
  temperature: z.number().min(0).max(2).default(0.2),
  maxTokens: z.number().int().positive().default(1024),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type PromptTemplateCreateDto = z.infer<typeof promptTemplateCreateSchema>;

export const promptTemplateUpdateSchema = promptTemplateCreateSchema.partial().omit({ name: true });

export type PromptTemplateUpdateDto = z.infer<typeof promptTemplateUpdateSchema>;

export const promptTemplateFilterSchema = z.object({
  name: z.string().optional(),
  provider: llmProviderSchema.optional(),
  isActive: z.boolean().optional(),
});

export type PromptTemplateFilterDto = z.infer<typeof promptTemplateFilterSchema>;

export const promptTemplateRenderSchema = z.object({
  variables: z.record(z.any()),
});

export type PromptTemplateRenderDto = z.infer<typeof promptTemplateRenderSchema>;

export const promptTemplateTestSchema = z.object({
  variables: z.record(z.any()),
  provider: llmProviderSchema.optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type PromptTemplateTestDto = z.infer<typeof promptTemplateTestSchema>;

export const promptTemplateResponseSchema = promptTemplateCreateSchema.extend({
  id: z.string(),
  workspaceId: z.string().nullable().optional(),
  createdById: z.string().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()),
});

export type PromptTemplateResponseDto = z.infer<typeof promptTemplateResponseSchema>;
