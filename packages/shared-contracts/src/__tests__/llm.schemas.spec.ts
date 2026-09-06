import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  LlmProvider,
  LlmRole,
  llmMessageSchema,
  llmCompletionOptionsSchema,
  llmUsageMetricsSchema,
  promptTemplateCreateSchema,
  promptTemplateUpdateSchema,
  promptTemplateRenderSchema,
  promptTemplateTestSchema,
} from '../llm';

describe('LLM & Prompt Registry Shared Contracts', () => {
  describe('LLM Message & Options Schemas', () => {
    it('should validate valid user and system messages', () => {
      const userMsg = llmMessageSchema.parse({ role: 'user', content: 'Hello' });
      assert.strictEqual(userMsg.role, LlmRole.USER);
      assert.strictEqual(userMsg.content, 'Hello');

      const sysMsg = llmMessageSchema.parse({ role: 'system', content: 'You are helpful' });
      assert.strictEqual(sysMsg.role, LlmRole.SYSTEM);
    });

    it('should reject invalid message roles', () => {
      assert.throws(() => {
        llmMessageSchema.parse({ role: 'invalid_role', content: 'Hello' });
      });
    });

    it('should validate completion options with defaults', () => {
      const options = llmCompletionOptionsSchema.parse({
        temperature: 0.5,
        maxTokens: 500,
        model: 'gemini-2.5-flash',
      });
      assert.strictEqual(options.temperature, 0.5);
      assert.strictEqual(options.maxTokens, 500);
      assert.strictEqual(options.model, 'gemini-2.5-flash');
    });

    it('should validate usage metrics schema', () => {
      const metrics = llmUsageMetricsSchema.parse({
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
        latencyMs: 150,
        estimatedCostUsd: 0.000005,
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-flash',
      });
      assert.strictEqual(metrics.totalTokens, 30);
      assert.strictEqual(metrics.provider, LlmProvider.GEMINI);
    });
  });

  describe('Prompt Template Schemas', () => {
    it('should parse valid template creation payload with defaults', () => {
      const created = promptTemplateCreateSchema.parse({
        name: 'TEST_PROMPT',
        systemPrompt: 'System',
        userPromptTemplate: 'User {{name}}',
      });
      assert.strictEqual(created.name, 'TEST_PROMPT');
      assert.strictEqual(created.version, 1);
      assert.strictEqual(created.provider, LlmProvider.GEMINI);
      assert.strictEqual(created.model, 'gemini-2.5-flash');
      assert.strictEqual(created.temperature, 0.2);
      assert.strictEqual(created.maxTokens, 1024);
      assert.strictEqual(created.isDefault, false);
      assert.strictEqual(created.isActive, true);
    });

    it('should reject empty name or prompt templates', () => {
      assert.throws(() => {
        promptTemplateCreateSchema.parse({
          name: '',
          systemPrompt: '',
          userPromptTemplate: '',
        });
      });
    });

    it('should allow partial updates with update schema', () => {
      const updated = promptTemplateUpdateSchema.parse({
        temperature: 0.8,
        isActive: false,
      });
      assert.strictEqual(updated.temperature, 0.8);
      assert.strictEqual(updated.isActive, false);
    });

    it('should validate render payload', () => {
      const render = promptTemplateRenderSchema.parse({
        variables: { customerName: 'Alice', budget: '50M' },
      });
      assert.strictEqual(render.variables.customerName, 'Alice');
    });

    it('should validate test payload', () => {
      const test = promptTemplateTestSchema.parse({
        variables: { name: 'Bob' },
        provider: LlmProvider.OPENAI,
        model: 'gpt-4o-mini',
      });
      assert.strictEqual(test.provider, LlmProvider.OPENAI);
    });
  });
});
