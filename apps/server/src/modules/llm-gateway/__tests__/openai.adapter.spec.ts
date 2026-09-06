import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LlmProvider } from '@sales-copilot/shared-contracts';
import { OpenAIAdapter } from '../adapters/openai.adapter';

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  let mockConfigService: any;
  let mockOpenAiClient: any;

  beforeEach(() => {
    mockOpenAiClient = {
      chat: {
        completions: {
          create: async (params: any) => {
            if (params.stream) {
              return (async function* () {
                yield { choices: [{ delta: { content: 'Hello ' } }] };
                yield { choices: [{ delta: { content: 'from OpenAI!' } }] };
                yield {
                  choices: [{ delta: {} }],
                  usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
                };
              })();
            }

            return {
              choices: [
                {
                  message: { content: 'OpenAI completion response' },
                },
              ],
              usage: {
                prompt_tokens: 25,
                completion_tokens: 30,
                total_tokens: 55,
              },
            };
          },
        },
      },
    };

    mockConfigService = {
      get: (key: string) => {
        if (key === 'OPENAI_API_KEY') return 'test_openai_key';
        return undefined;
      },
    };

    adapter = new OpenAIAdapter(mockConfigService);
    (adapter as any).defaultClient = mockOpenAiClient;
  });

  it('should have providerName OPENAI', () => {
    assert.strictEqual(adapter.providerName, LlmProvider.OPENAI);
  });

  it('should generate completion with valid metrics', async () => {
    const result = await adapter.generateCompletion([{ role: 'user', content: 'Hello' }]);

    assert.strictEqual(result.provider, LlmProvider.OPENAI);
    assert.strictEqual(result.content, 'OpenAI completion response');
    assert.strictEqual(result.metrics.promptTokens, 25);
    assert.strictEqual(result.metrics.completionTokens, 30);
    assert.strictEqual(result.metrics.totalTokens, 55);
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

    assert.strictEqual(chunks.join(''), 'Hello from OpenAI!');
    assert.ok(finalMetrics);
    assert.strictEqual(finalMetrics.totalTokens, 20);
  });

  it('should generate structured output adhering to schema', async () => {
    mockOpenAiClient.chat.completions.create = async () => ({
      choices: [{ message: { content: '{"status": "QUALIFIED", "score": 85}' } }],
      usage: { prompt_tokens: 15, completion_tokens: 15, total_tokens: 30 },
    });

    const result = await adapter.generateStructuredOutput<{ status: string; score: number }>(
      [{ role: 'user', content: 'Evaluate lead' }],
      {
        schemaName: 'lead_eval',
        jsonSchema: { type: 'object', properties: { status: { type: 'string' } } },
      },
    );

    assert.strictEqual(result.data.status, 'QUALIFIED');
    assert.strictEqual(result.data.score, 85);
  });
});
