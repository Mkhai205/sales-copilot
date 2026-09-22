import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiDebugMetadataSchema, conversationAiUsageSchema } from '@sales-copilot/shared-contracts';

describe('Epic 4.2 — AI Observability Web UI Contracts & Utilities', () => {
  describe('aiDebugMetadataSchema validation', () => {
    it('validates a complete aiDebug object', () => {
      const payload = {
        provider: 'vertex-ai',
        model: 'gemini-2.5-flash',
        stepsCount: 3,
        totalDurationMs: 1850,
        usage: { input: 1200, output: 617, total: 1817 },
        estimatedCostUsd: 0.0005502,
        toolCalls: [
          {
            name: 'searchProducts',
            input: { query: 'tai nghe' },
            outputSummary: 'Found 3 products',
            durationMs: 245,
          },
        ],
      };

      const parsed = aiDebugMetadataSchema.parse(payload);
      assert.strictEqual(parsed.provider, 'vertex-ai');
      assert.strictEqual(parsed.model, 'gemini-2.5-flash');
      assert.strictEqual(parsed.stepsCount, 3);
      assert.strictEqual(parsed.totalDurationMs, 1850);
      assert.strictEqual(parsed.usage.total, 1817);
      assert.strictEqual(parsed.estimatedCostUsd, 0.0005502);
      assert.strictEqual(parsed.toolCalls.length, 1);
      assert.strictEqual(parsed.toolCalls[0].name, 'searchProducts');
      assert.strictEqual(parsed.toolCalls[0].durationMs, 245);
    });

    it('defaults toolCalls to empty array when omitted', () => {
      const payload = {
        provider: 'google-ai-studio',
        model: 'gemini-2.5-flash',
        stepsCount: 1,
        totalDurationMs: 450,
        usage: { input: 300, output: 50, total: 350 },
        estimatedCostUsd: 0.000075,
      };

      const parsed = aiDebugMetadataSchema.parse(payload);
      assert.deepStrictEqual(parsed.toolCalls, []);
    });
  });

  describe('conversationAiUsageSchema validation', () => {
    it('validates conversation rolled-up aiUsage', () => {
      const payload = {
        totalCostUsd: 0.0024,
        totalTokens: 5200,
        inputTokens: 4000,
        outputTokens: 1200,
        aiMessagesCount: 4,
        lastCalculatedAt: new Date().toISOString(),
      };

      const parsed = conversationAiUsageSchema.parse(payload);
      assert.strictEqual(parsed.totalCostUsd, 0.0024);
      assert.strictEqual(parsed.totalTokens, 5200);
      assert.strictEqual(parsed.aiMessagesCount, 4);
    });
  });
});
