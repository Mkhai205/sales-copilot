import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LlmProvider } from '@sales-copilot/shared-contracts';
import { GeminiAdapter } from '../adapters/gemini.adapter';

describe('GeminiAdapter', () => {
  let adapter: GeminiAdapter;
  let mockConfigService: any;
  let mockGenAiClient: any;

  beforeEach(() => {
    mockGenAiClient = {
      models: {
        generateContent: async (_params: any) => {
          return {
            text: 'Xin chào! Tôi có thể giúp gì cho bạn?',
            usageMetadata: {
              promptTokenCount: 15,
              candidatesTokenCount: 20,
              totalTokenCount: 35,
            },
          };
        },
        generateContentStream: async function* (_params: any) {
          yield { text: 'Xin ' };
          yield { text: 'chào!' };
          yield {
            text: '',
            usageMetadata: {
              promptTokenCount: 10,
              candidatesTokenCount: 15,
              totalTokenCount: 25,
            },
          };
        },
      },
    };

    mockConfigService = {
      get: (key: string) => {
        if (key === 'GEMINI_API_KEY') return 'test_gemini_key';
        return undefined;
      },
    };

    adapter = new GeminiAdapter(mockConfigService);
    // Inject mock client directly
    (adapter as any).defaultClient = mockGenAiClient;
  });

  it('should have providerName GEMINI', () => {
    assert.strictEqual(adapter.providerName, LlmProvider.GEMINI);
  });

  it('should successfully generate completion with token metrics', async () => {
    const result = await adapter.generateCompletion([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Chào bạn' },
    ]);

    assert.strictEqual(result.provider, LlmProvider.GEMINI);
    assert.strictEqual(result.content, 'Xin chào! Tôi có thể giúp gì cho bạn?');
    assert.strictEqual(result.metrics.promptTokens, 15);
    assert.strictEqual(result.metrics.completionTokens, 20);
    assert.strictEqual(result.metrics.totalTokens, 35);
    assert.ok(result.metrics.latencyMs >= 0);
  });

  it('should stream chunks asynchronously', async () => {
    const chunks: string[] = [];
    let finalMetrics: any;

    const stream = adapter.generateStream([{ role: 'user', content: 'Stream test' }]);

    for await (const chunk of stream) {
      if (!chunk.isDone) {
        chunks.push(chunk.chunk);
      } else {
        finalMetrics = chunk.metrics;
      }
    }

    assert.strictEqual(chunks.join(''), 'Xin chào!');
    assert.ok(finalMetrics);
    assert.strictEqual(finalMetrics.totalTokens, 25);
  });

  it('should generate structured output adhering to schema', async () => {
    // Override mock to return JSON
    mockGenAiClient.models.generateContent = async () => ({
      text: '{"intent": "PRICING_INQUIRY", "confidence": 0.95}',
      usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 },
    });

    const result = await adapter.generateStructuredOutput<{ intent: string; confidence: number }>(
      [{ role: 'user', content: 'Báo giá cho tôi' }],
      {
        schemaName: 'pricing_intent',
        jsonSchema: { type: 'object', properties: { intent: { type: 'string' } } },
      },
    );

    assert.strictEqual(result.data.intent, 'PRICING_INQUIRY');
    assert.strictEqual(result.data.confidence, 0.95);
    assert.strictEqual(result.metrics.totalTokens, 30);
  });
});
