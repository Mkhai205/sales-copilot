import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadGatewayException } from '@nestjs/common';
import { z } from 'zod';
import { CircuitBreakerState, LlmProvider } from '@sales-copilot/shared-contracts';
import { LlmGatewayService } from '../llm-gateway.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { StructuredOutputService } from '../structured-output.service';

describe('LlmGatewayService (Multi-Provider Failover Orchestrator)', () => {
  let gateway: LlmGatewayService;
  let mockGeminiAdapter: any;
  let mockOpenAiAdapter: any;
  let circuitBreakerService: CircuitBreakerService;
  let mockRateLimiterService: any;
  let structuredOutputService: StructuredOutputService;
  let emittedEvents: Array<{ event: string; payload: any }>;

  const wsId = 'ws_orchestrator_test';

  beforeEach(() => {
    emittedEvents = [];

    mockGeminiAdapter = {
      providerName: LlmProvider.GEMINI,
      generateCompletion: async () => ({
        content: 'Response from Gemini',
        metrics: {
          promptTokens: 10,
          completionTokens: 10,
          totalTokens: 20,
          latencyMs: 150,
          estimatedCostUsd: 0.000003,
          provider: LlmProvider.GEMINI,
          model: 'gemini-2.5-flash',
        },
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-flash',
      }),
      generateStream: async function* () {
        yield { chunk: 'Gemini stream', isDone: false };
        yield {
          chunk: '',
          isDone: true,
          metrics: {
            promptTokens: 5,
            completionTokens: 5,
            totalTokens: 10,
            latencyMs: 100,
            estimatedCostUsd: 0.000001,
            provider: LlmProvider.GEMINI,
            model: 'gemini-2.5-flash',
          },
        };
      },
    };

    mockOpenAiAdapter = {
      providerName: LlmProvider.OPENAI,
      generateCompletion: async () => ({
        content: 'Response from OpenAI Fallback',
        metrics: {
          promptTokens: 15,
          completionTokens: 15,
          totalTokens: 30,
          latencyMs: 180,
          estimatedCostUsd: 0.00001,
          provider: LlmProvider.OPENAI,
          model: 'gpt-4o-mini',
        },
        provider: LlmProvider.OPENAI,
        model: 'gpt-4o-mini',
      }),
      generateStream: async function* () {
        yield { chunk: 'OpenAI fallback stream', isDone: false };
        yield {
          chunk: '',
          isDone: true,
          metrics: {
            promptTokens: 8,
            completionTokens: 8,
            totalTokens: 16,
            latencyMs: 120,
            estimatedCostUsd: 0.000005,
            provider: LlmProvider.OPENAI,
            model: 'gpt-4o-mini',
          },
        };
      },
    };

    circuitBreakerService = new CircuitBreakerService();

    mockRateLimiterService = {
      estimateTokens: () => 100,
      checkAndReserve: async () => ({ remainingRpm: 100, remainingTpm: 100000 }),
      recordActualUsage: async () => {},
    };

    structuredOutputService = new StructuredOutputService();

    const mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    gateway = new LlmGatewayService(
      mockGeminiAdapter,
      mockOpenAiAdapter,
      circuitBreakerService,
      mockRateLimiterService,
      structuredOutputService,
      mockEventEmitter as any,
    );
  });

  it('US-2.3.1: should successfully invoke primary provider (Gemini) when healthy', async () => {
    const result = await gateway.generateCompletion({
      workspaceId: wsId,
      messages: [{ role: 'user', content: 'Test message' }],
    });

    assert.strictEqual(result.provider, LlmProvider.GEMINI);
    assert.strictEqual(result.content, 'Response from Gemini');
    assert.strictEqual(
      circuitBreakerService.getState(LlmProvider.GEMINI),
      CircuitBreakerState.CLOSED,
    );

    const consumedEvent = emittedEvents.find(e => e.event === 'llm.token_consumed');
    assert.ok(consumedEvent);
    assert.strictEqual(consumedEvent.payload.provider, LlmProvider.GEMINI);
    assert.strictEqual(consumedEvent.payload.totalTokens, 20);
  });

  it('US-2.3.1: should automatically failover to OpenAI when Gemini returns HTTP 429', async () => {
    // Make Gemini throw 429
    mockGeminiAdapter.generateCompletion = async () => {
      const err: any = new Error('Resource exhausted');
      err.status = 429;
      err.code = 'RESOURCE_EXHAUSTED';
      throw err;
    };

    const result = await gateway.generateCompletion({
      workspaceId: wsId,
      messages: [{ role: 'user', content: 'Trigger failover' }],
    });

    assert.strictEqual(result.provider, LlmProvider.OPENAI);
    assert.strictEqual(result.content, 'Response from OpenAI Fallback');

    // Verify Gemini circuit tripped
    assert.strictEqual(
      circuitBreakerService.getState(LlmProvider.GEMINI),
      CircuitBreakerState.OPEN,
    );

    // Verify fallback event was emitted
    const fallbackEvent = emittedEvents.find(e => e.event === 'llm.fallback_triggered');
    assert.ok(fallbackEvent);
    assert.strictEqual(fallbackEvent.payload.fromProvider, LlmProvider.GEMINI);
    assert.strictEqual(fallbackEvent.payload.toProvider, LlmProvider.OPENAI);
  });

  it('US-2.3.1: should route directly to fallback when primary circuit is already OPEN', async () => {
    circuitBreakerService.trip(LlmProvider.GEMINI, 'Pre-tripped in test');
    let geminiCalled = false;
    mockGeminiAdapter.generateCompletion = async () => {
      geminiCalled = true;
      return {} as any;
    };

    const result = await gateway.generateCompletion({
      workspaceId: wsId,
      messages: [{ role: 'user', content: 'Direct to fallback' }],
    });

    assert.strictEqual(geminiCalled, false);
    assert.strictEqual(result.provider, LlmProvider.OPENAI);
    assert.strictEqual(result.content, 'Response from OpenAI Fallback');
  });

  it('US-2.3.1: should throw BadGatewayException with LLM_ALL_PROVIDERS_UNAVAILABLE when both fail', async () => {
    mockGeminiAdapter.generateCompletion = async () => {
      throw new Error('Gemini down');
    };
    mockOpenAiAdapter.generateCompletion = async () => {
      throw new Error('OpenAI down');
    };

    await assert.rejects(
      async () => {
        await gateway.generateCompletion({
          workspaceId: wsId,
          messages: [{ role: 'user', content: 'Catastrophic failure' }],
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadGatewayException);
        const res = err.getResponse() as any;
        assert.strictEqual(res.code, 'LLM_ALL_PROVIDERS_UNAVAILABLE');
        return true;
      },
    );
  });

  it('US-2.3.5: should generate streaming chunks with token consumption audit', async () => {
    const chunks: string[] = [];
    const stream = gateway.generateStream({
      workspaceId: wsId,
      messages: [{ role: 'user', content: 'Stream request' }],
    });

    for await (const chunk of stream) {
      if (!chunk.isDone) {
        chunks.push(chunk.chunk);
      }
    }

    assert.strictEqual(chunks.join(''), 'Gemini stream');
    const tokenEvent = emittedEvents.find(e => e.event === 'llm.token_consumed');
    assert.ok(tokenEvent);
    assert.strictEqual(tokenEvent.payload.totalTokens, 10);
  });

  it('US-2.3.3: should generate type-safe structured output with 1-shot auto-repair', async () => {
    const leadSchema = z.object({
      intent: z.string(),
      score: z.number(),
    });

    // On 1st attempt: return malformed JSON
    // On 2nd attempt (repair): return valid JSON
    let callCount = 0;
    mockGeminiAdapter.generateCompletion = async () => {
      callCount++;
      if (callCount === 1) {
        return {
          content: 'Malformed JSON here',
          metrics: {
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            latencyMs: 50,
            estimatedCostUsd: 0,
            provider: LlmProvider.GEMINI,
            model: 'gemini-2.5-flash',
          },
          provider: LlmProvider.GEMINI,
          model: 'gemini-2.5-flash',
        };
      }
      return {
        content: '{"intent": "BUYING_INQUIRY", "score": 90}',
        metrics: {
          promptTokens: 20,
          completionTokens: 10,
          totalTokens: 30,
          latencyMs: 60,
          estimatedCostUsd: 0,
          provider: LlmProvider.GEMINI,
          model: 'gemini-2.5-flash',
        },
        provider: LlmProvider.GEMINI,
        model: 'gemini-2.5-flash',
      };
    };

    const structured = await gateway.generateStructured({
      workspaceId: wsId,
      messages: [{ role: 'user', content: 'Extract intent' }],
      schema: leadSchema,
    });

    assert.strictEqual(callCount, 2); // 1 initial + 1 repair
    assert.strictEqual(structured.data.intent, 'BUYING_INQUIRY');
    assert.strictEqual(structured.data.score, 90);
  });
});
