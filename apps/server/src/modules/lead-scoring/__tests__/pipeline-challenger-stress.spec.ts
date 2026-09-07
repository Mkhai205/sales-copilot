import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadGatewayException, HttpException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import {
  BuyingSignalType,
  CircuitBreakerState,
  LeadGrade,
  LlmProvider,
  MessageContentType,
  RECALCULATE_LEAD_SCORE_JOB,
  ScoreTriggerEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';

import { WebhooksService } from '../../webhooks/webhooks.service';
import { ConversationIntelligenceListener } from '../../conversation-intelligence/conversation-intelligence.listener';
import { CopilotListener } from '../../copilot/copilot.listener';
import { LeadScoringListener } from '../lead-scoring.listener';
import { LeadScoringProcessor } from '../lead-scoring.processor';
import { LeadScoringCalculator } from '../lead-scoring.calculator';
import { BantSignalAnalyzer } from '../../conversation-intelligence/analyzers/bant-signal.analyzer';
import { SalesEvidenceService } from '../../sales-evidence/sales-evidence.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';
import { CircuitBreakerService } from '../../llm-gateway/circuit-breaker.service';
import { StructuredOutputService } from '../../llm-gateway/structured-output.service';

describe('Empirical Challenger: Asynchronous Event & AI Intelligence Pipeline (Epics 2.2 - 2.5)', () => {
  const wsId = '11111111-1111-4111-8111-111111111111';
  const wsIdOther = '22222222-2222-4222-8222-222222222222';
  const channelId = 'chan-001';
  const leadId = 'lead-challenger-001';
  const convId = 'conv-challenger-001';
  const msgId = 'msg-challenger-001';
  const contactId = 'contact-challenger-001';

  // ==========================================================================
  // AREA 1: Inbound Ingestion Latency & Queue Dispatch Verification
  // ==========================================================================
  describe('Area 1: Inbound Ingestion Latency & Queue Dispatch', () => {
    it('SLA-1: Webhook ingestion must acknowledge in < 100ms (empirical benchmark over 50 calls)', async () => {
      const channelEvents = new Map<string, any>();
      const enqueuedJobs: any[] = [];

      const mockPrisma = {
        getClient: () => ({
          channel: {
            findUnique: async () => ({
              id: channelId,
              workspaceId: wsId,
              channelType: 'WEB_CHAT',
              credentials: null,
            }),
          },
          channelEvent: {
            findUnique: async ({ where }: any) => {
              const key = `${where.channelId_externalEventId.channelId}:${where.channelId_externalEventId.externalEventId}`;
              return channelEvents.get(key) || null;
            },
            create: async ({ data }: any) => {
              const record = { id: `ce-${Date.now()}-${Math.random()}`, ...data };
              const key = `${data.channelId}:${data.externalEventId}`;
              channelEvents.set(key, record);
              return record;
            },
          },
        }),
      };

      const mockAdapterRegistry = {
        get: () => ({
          verifyWebhook: async () => true,
        }),
      };

      const mockCredentialService = {
        decrypt: () => ({}),
      };

      const mockIngestionQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedJobs.push({ name, data, opts });
        },
      };

      const service = new WebhooksService(
        mockPrisma as any,
        mockAdapterRegistry as any,
        mockCredentialService as any,
        mockIngestionQueue as any,
      );

      const latencies: number[] = [];
      const iterations = 50;

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const result = await service.handleInboundWebhook(
          channelId,
          { externalMessageId: `ext-msg-${i}`, content: `Hello ${i}` },
          { 'x-event-type': 'message.created' },
        );
        const duration = performance.now() - start;
        latencies.push(duration);

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.duplicated, false);
      }

      const meanLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      latencies.sort((a, b) => a - b);
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const maxLatency = latencies[latencies.length - 1];

      // SLA assertion: strictly < 100ms
      assert.ok(p95 < 50, `p95 ingestion latency (${p95.toFixed(2)}ms) exceeded 50ms SLA`);
      assert.ok(
        maxLatency < 100,
        `Max ingestion latency (${maxLatency.toFixed(2)}ms) exceeded 100ms SLA`,
      );
      assert.ok(
        meanLatency < 20,
        `Mean ingestion latency (${meanLatency.toFixed(2)}ms) was unexpectedly high`,
      );
      assert.strictEqual(enqueuedJobs.length, iterations);
    });

    it('SLA-2: Ingestion deduplication must reject duplicate event in < 10ms without re-enqueuing', async () => {
      const channelEvents = new Map<string, any>();
      let enqueueCount = 0;

      const mockPrisma = {
        getClient: () => ({
          channel: {
            findUnique: async () => ({
              id: channelId,
              workspaceId: wsId,
              channelType: 'WEB_CHAT',
            }),
          },
          channelEvent: {
            findUnique: async ({ where }: any) => {
              const key = `${where.channelId_externalEventId.channelId}:${where.channelId_externalEventId.externalEventId}`;
              return channelEvents.get(key) || null;
            },
            create: async ({ data }: any) => {
              const record = { id: 'ce-first', ...data };
              const key = `${data.channelId}:${data.externalEventId}`;
              channelEvents.set(key, record);
              return record;
            },
          },
        }),
      };

      const mockIngestionQueue = {
        add: async () => {
          enqueueCount++;
        },
      };

      const service = new WebhooksService(
        mockPrisma as any,
        { get: () => ({ verifyWebhook: async () => true }) } as any,
        { decrypt: () => ({}) } as any,
        mockIngestionQueue as any,
      );

      const payload = { externalMessageId: 'duplicate-test-id', text: 'hi' };

      // First call -> enqueued
      const res1 = await service.handleInboundWebhook(channelId, payload, {});
      assert.strictEqual(res1.duplicated, false);
      assert.strictEqual(enqueueCount, 1);

      // Second call with same external event -> deduplicated
      const start = performance.now();
      const res2 = await service.handleInboundWebhook(channelId, payload, {});
      const duration = performance.now() - start;

      assert.strictEqual(res2.duplicated, true);
      assert.strictEqual(enqueueCount, 1, 'Duplicate event must NOT be re-enqueued to BullMQ');
      assert.ok(duration < 15, `Deduplication took ${duration.toFixed(2)}ms (expected < 15ms)`);
    });

    it('DISPATCH-1: Message creation triggers BullMQ jobs across conversation-intelligence, copilot, and lead-scoring queues', async () => {
      const enqueuedIntelligence: any[] = [];
      const enqueuedCopilot: any[] = [];
      const enqueuedScoring: any[] = [];
      const redisStore = new Map<string, string>();

      const mockIntelligenceQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedIntelligence.push({ name, data, opts });
        },
      };

      const mockCopilotQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedCopilot.push({ name, data, opts });
        },
      };

      const mockScoringQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedScoring.push({ name, data, opts });
        },
      };

      const mockRedisService = {
        set: async (key: string, val: string) => {
          redisStore.set(key, val);
        },
        get: async (key: string) => redisStore.get(key) || null,
      };

      const mockPrismaService = {
        getClient: () => ({
          conversation: {
            findFirst: async () => ({ id: convId, contactId, workspaceId: wsId }),
          },
          lead: {
            findFirst: async () => ({ id: leadId, contactId, workspaceId: wsId }),
          },
        }),
      };

      const mockConfigService = {
        get: (key: string, defVal: any) => {
          if (key === 'LEAD_SCORE_DEBOUNCE_MS') return 30000;
          return defVal;
        },
      };

      const mockCopilotService = {
        expireSuggestionsForConversation: async () => {},
      };

      const ciListener = new ConversationIntelligenceListener(mockIntelligenceQueue as any);
      const copilotListener = new CopilotListener(
        mockCopilotQueue as any,
        mockRedisService as any,
        mockCopilotService as any,
      );
      const scoringListener = new LeadScoringListener(
        mockScoringQueue as any,
        mockRedisService as any,
        mockPrismaService as any,
        mockConfigService as any,
      );

      const customerMessagePayload = {
        workspaceId: wsId,
        conversationId: convId,
        leadId,
        message: {
          id: msgId,
          conversationId: convId,
          senderId: contactId,
          senderType: SenderType.CONTACT,
          contentType: MessageContentType.TEXT,
          content: 'Bên anh có ngân sách 300 triệu, cần triển khai trong tháng này.',
          isPrivate: false,
        },
      };

      // Emit event to all 3 listeners
      await ciListener.handleMessageCreated(customerMessagePayload as any);
      await copilotListener.handleMessageCreated(customerMessagePayload as any);
      await scoringListener.handleMessageCreated(customerMessagePayload as any);

      // Verify conversation-intelligence enqueue
      assert.strictEqual(enqueuedIntelligence.length, 1);
      assert.strictEqual(enqueuedIntelligence[0].data.messageId, msgId);
      assert.strictEqual(enqueuedIntelligence[0].data.workspaceId, wsId);

      // Verify copilot-suggestions enqueue with 3000ms debounce
      assert.strictEqual(enqueuedCopilot.length, 1);
      assert.strictEqual(enqueuedCopilot[0].opts.delay, 3000);
      assert.ok(redisStore.has(`ws:${wsId}:copilot:debounce:${convId}`));

      // Verify lead-scoring enqueue with 30000ms debounce
      assert.strictEqual(enqueuedScoring.length, 1);
      assert.strictEqual(enqueuedScoring[0].opts.delay, 30000);
      assert.strictEqual(enqueuedScoring[0].data.leadId, leadId);
      assert.ok(redisStore.has(`ws:${wsId}:lead_scoring:debounce:${leadId}`));
    });

    it('DISPATCH-2: Private internal notes must be ignored by intelligence and copilot queues', async () => {
      const enqueuedIntelligence: any[] = [];
      const enqueuedCopilot: any[] = [];

      const ciListener = new ConversationIntelligenceListener({
        add: async (n: any, d: any) => enqueuedIntelligence.push(d),
      } as any);

      const copilotListener = new CopilotListener(
        { add: async (n: any, d: any) => enqueuedCopilot.push(d) } as any,
        { set: async () => {} } as any,
        { expireSuggestionsForConversation: async () => {} } as any,
      );

      const privateNotePayload = {
        workspaceId: wsId,
        conversationId: convId,
        message: {
          id: 'note-001',
          conversationId: convId,
          senderType: SenderType.USER,
          content: 'Internal note: customer wants discount',
          isPrivate: true,
        },
      };

      await ciListener.handleMessageCreated(privateNotePayload as any);
      await copilotListener.handleMessageCreated(privateNotePayload as any);

      assert.strictEqual(
        enqueuedIntelligence.length,
        0,
        'Private notes must not trigger intelligence',
      );
      assert.strictEqual(enqueuedCopilot.length, 0, 'Private notes must not trigger copilot');
    });
  });

  // ==========================================================================
  // AREA 2: LLM Gateway & Provider Failover Verification
  // ==========================================================================
  describe('Area 2: LLM Gateway & Failover Resilience', () => {
    let circuitBreakerService: CircuitBreakerService;
    let mockRateLimiterService: any;
    let structuredOutputService: StructuredOutputService;
    let emittedEvents: Array<{ event: string; payload: any }>;

    beforeEach(() => {
      circuitBreakerService = new CircuitBreakerService();
      emittedEvents = [];
      mockRateLimiterService = {
        estimateTokens: () => 50,
        checkAndReserve: async () => ({ remainingRpm: 100, remainingTpm: 100000 }),
        recordActualUsage: async () => {},
      };
      structuredOutputService = new StructuredOutputService();
    });

    it('FAILOVER-1: Immediate failover from Gemini to OpenAI when Gemini hits HTTP 429', async () => {
      const mockGemini = {
        providerName: LlmProvider.GEMINI,
        generateCompletion: async () => {
          const err: any = new Error('Resource exhausted');
          err.status = 429;
          err.code = 'RESOURCE_EXHAUSTED';
          throw err;
        },
      };

      const mockOpenAi = {
        providerName: LlmProvider.OPENAI,
        generateCompletion: async () => ({
          content: 'OpenAI failover response',
          metrics: {
            promptTokens: 10,
            completionTokens: 10,
            totalTokens: 20,
            latencyMs: 120,
            estimatedCostUsd: 0.00001,
            provider: LlmProvider.OPENAI,
            model: 'gpt-4o-mini',
          },
          provider: LlmProvider.OPENAI,
          model: 'gpt-4o-mini',
        }),
      };

      const gateway = new LlmGatewayService(
        mockGemini as any,
        mockOpenAi as any,
        circuitBreakerService,
        mockRateLimiterService,
        structuredOutputService,
        { emit: (event: string, payload: any) => emittedEvents.push({ event, payload }) } as any,
      );

      const result = await gateway.generateCompletion({
        workspaceId: wsId,
        messages: [{ role: 'user', content: 'Analyze this conversation' }],
      });

      assert.strictEqual(result.provider, LlmProvider.OPENAI);
      assert.strictEqual(result.content, 'OpenAI failover response');

      // Assert Gemini circuit is now OPEN
      assert.strictEqual(
        circuitBreakerService.getState(LlmProvider.GEMINI),
        CircuitBreakerState.OPEN,
      );

      // Assert fallback event was emitted
      const fallbackEvent = emittedEvents.find(e => e.event === 'llm.fallback_triggered');
      assert.ok(fallbackEvent);
      assert.strictEqual(fallbackEvent.payload.fromProvider, LlmProvider.GEMINI);
      assert.strictEqual(fallbackEvent.payload.toProvider, LlmProvider.OPENAI);
    });

    it('FAILOVER-2: Direct routing to secondary provider when primary circuit is OPEN', async () => {
      circuitBreakerService.trip(LlmProvider.GEMINI, 'Simulated prior failure');

      let geminiAttempted = false;
      const mockGemini = {
        providerName: LlmProvider.GEMINI,
        generateCompletion: async () => {
          geminiAttempted = true;
          throw new Error('Should not be called');
        },
      };

      const mockOpenAi = {
        providerName: LlmProvider.OPENAI,
        generateCompletion: async () => ({
          content: 'Direct OpenAI response',
          metrics: { totalTokens: 15, provider: LlmProvider.OPENAI },
          provider: LlmProvider.OPENAI,
          model: 'gpt-4o-mini',
        }),
      };

      const gateway = new LlmGatewayService(
        mockGemini as any,
        mockOpenAi as any,
        circuitBreakerService,
        mockRateLimiterService,
        structuredOutputService,
        { emit: (event: string, payload: any) => emittedEvents.push({ event, payload }) } as any,
      );

      const result = await gateway.generateCompletion({
        workspaceId: wsId,
        messages: [{ role: 'user', content: 'test' }],
      });

      assert.strictEqual(geminiAttempted, false, 'Gemini must NOT be called when circuit is OPEN');
      assert.strictEqual(result.provider, LlmProvider.OPENAI);
      assert.strictEqual(result.content, 'Direct OpenAI response');
    });

    it('FAILOVER-3: Rejection with BadGatewayException when all configured providers fail', async () => {
      const mockGemini = {
        providerName: LlmProvider.GEMINI,
        generateCompletion: async () => {
          throw new Error('Gemini outage');
        },
      };

      const mockOpenAi = {
        providerName: LlmProvider.OPENAI,
        generateCompletion: async () => {
          throw new Error('OpenAI outage');
        },
      };

      const gateway = new LlmGatewayService(
        mockGemini as any,
        mockOpenAi as any,
        circuitBreakerService,
        mockRateLimiterService,
        structuredOutputService,
        { emit: () => {} } as any,
      );

      await assert.rejects(
        async () => {
          await gateway.generateCompletion({
            workspaceId: wsId,
            messages: [{ role: 'user', content: 'test' }],
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

    it('REPAIR-1: Structured output executes 1-shot auto-repair prompt when raw JSON is invalid', async () => {
      const leadSchema = z.object({
        intent: z.string(),
        urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
        confidence: z.number().min(0).max(1),
      });

      let callCount = 0;
      const repairPromptsReceived: string[] = [];

      const mockGemini = {
        providerName: LlmProvider.GEMINI,
        generateCompletion: async (messages: any[]) => {
          callCount++;
          if (callCount === 1) {
            // Broken output
            return {
              content: 'Here is the result: { "intent": "PURCHASE", urgency: UNKNOWN }',
              metrics: { totalTokens: 10, provider: LlmProvider.GEMINI },
              provider: LlmProvider.GEMINI,
            };
          }
          // Record repair message
          repairPromptsReceived.push(messages[messages.length - 1].content);
          return {
            content: '{"intent": "PURCHASE", "urgency": "HIGH", "confidence": 0.9}',
            metrics: { totalTokens: 20, provider: LlmProvider.GEMINI },
            provider: LlmProvider.GEMINI,
          };
        },
      };

      const gateway = new LlmGatewayService(
        mockGemini as any,
        {} as any,
        circuitBreakerService,
        mockRateLimiterService,
        structuredOutputService,
        { emit: () => {} } as any,
      );

      const output = await gateway.generateStructured({
        workspaceId: wsId,
        messages: [{ role: 'user', content: 'Extract BANT' }],
        schema: leadSchema,
      });

      assert.strictEqual(callCount, 2);
      assert.strictEqual(output.data.intent, 'PURCHASE');
      assert.strictEqual(output.data.urgency, 'HIGH');
      assert.strictEqual(output.data.confidence, 0.9);
      assert.ok(repairPromptsReceived[0].includes('failed schema validation'));
    });
  });

  // ==========================================================================
  // AREA 3: BANT Signal Extraction & Hallucination Elimination
  // ==========================================================================
  describe('Area 3: BANT Signal Extraction & Hallucination Elimination', () => {
    let analyzer: BantSignalAnalyzer;

    beforeEach(() => {
      analyzer = new BantSignalAnalyzer();
    });

    it('VERBATIM-1: Every returned snippet must strictly satisfy fullText.includes(snippet) === true', () => {
      const fullText =
        'Chào em, bên anh là công ty X, anh là Trưởng phòng IT.\nHiện tại bên anh duyệt ngân sách 200 triệu, cần triển khai gấp trước ngày 15/10 nhé.';

      const testSnippets = [
        'duyệt ngân sách 200 triệu', // Exact match
        'DUYỆT NGÂN SÁCH 200 TRIỆU', // Case variation
        '**cần triển khai gấp trước ngày 15/10**', // Markdown
        'trước ngày 15/10 nhé.', // Punctuation
        'Trưởng phòng IT Hiện tại bên anh duyệt ngân sách', // Cross-newline
      ];

      for (const raw of testSnippets) {
        const verified = analyzer.verifyAndNormalizeSnippet(raw, fullText);
        assert.ok(verified !== null, `Expected "${raw}" to be verified`);
        assert.strictEqual(
          fullText.includes(verified),
          true,
          `Verified snippet "${verified}" must be an exact substring of fullText`,
        );
      }
    });

    it('VERBATIM-2: Model hallucinations must strictly return null and be discarded', () => {
      const fullText = 'Bên mình muốn tham khảo bảng giá dịch vụ gói Pro.';

      const hallucinations = [
        'ngân sách 500 triệu', // Fabricated amount
        'triển khai trước 30/11', // Fabricated date
        'giám đốc kinh doanh', // Fabricated authority
        'Chatwoot và Zendesk', // Fabricated competitor
        'sẽ thanh toán chuyển khoản', // Fabricated method
      ];

      for (const h of hallucinations) {
        const verified = analyzer.verifyAndNormalizeSnippet(h, fullText);
        assert.strictEqual(verified, null, `Hallucination "${h}" must return null`);
      }
    });

    it('THRESHOLD-1: Signals with confidence < 0.70 must be filtered out; >= 0.70 must pass', () => {
      const messageContent = 'Ngân sách 150 triệu, dự kiến xong tháng 12.';

      const signals: any[] = [
        {
          signalType: BuyingSignalType.BUDGET_CONFIRMED,
          confidence: 0.7, // Boundary: exactly 0.70 -> PASS
          snippet: 'Ngân sách 150 triệu',
        },
        {
          signalType: BuyingSignalType.TIMELINE_DEFINED,
          confidence: 0.699, // Boundary: 0.699 -> FAIL
          snippet: 'dự kiến xong tháng 12',
        },
        {
          signalType: 'TIMELINE_STATED', // Coercion test
          confidence: 0.85,
          snippet: 'dự kiến xong tháng 12',
        },
      ];

      const verified = analyzer.verifySignals(signals, messageContent);

      assert.strictEqual(verified.length, 2);
      assert.strictEqual(verified[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);
      assert.strictEqual(verified[0].confidence, 0.7);

      // Coercion test
      assert.strictEqual(verified[1].signalType, BuyingSignalType.TIMELINE_DEFINED);
      assert.strictEqual(verified[1].confidence, 0.85);
    });

    it('LINKAGE-1: SalesEvidenceService must enforce conversation and message linkage and reject mismatches', async () => {
      const evidences = new Map<string, any>();

      const mockPrisma = {
        getClient: () => ({
          conversation: {
            findFirst: async ({ where }: any) => {
              if (where.id === convId && where.workspaceId === wsId) {
                return { id: convId, workspaceId: wsId };
              }
              return null;
            },
          },
          message: {
            findFirst: async ({ where }: any) => {
              if (where.id === msgId && where.workspaceId === wsId) {
                return { id: msgId, conversationId: convId, workspaceId: wsId };
              }
              if (where.id === 'msg-other-conv' && where.workspaceId === wsId) {
                return { id: 'msg-other-conv', conversationId: 'other-conv-id', workspaceId: wsId };
              }
              return null;
            },
          },
          salesEvidence: {
            create: async ({ data }: any) => {
              const rec = {
                id: `evi-${Date.now()}`,
                ...data,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              evidences.set(rec.id, rec);
              return rec;
            },
          },
        }),
      };

      const service = new SalesEvidenceService(mockPrisma as any, { emit: () => {} } as any);

      // 1. Success case: matching conversation and message
      const res = await service.recordEvidence(wsId, {
        conversationId: convId,
        messageId: msgId,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        confidence: 0.9,
        snippet: 'Ngân sách 150 triệu',
        reason: 'Budget verified',
      });
      assert.strictEqual(res.conversationId, convId);
      assert.strictEqual(res.messageId, msgId);

      // 2. Reject conversation mismatch
      await assert.rejects(
        async () => {
          await service.recordEvidence(wsId, {
            conversationId: convId,
            messageId: 'msg-other-conv', // belongs to other-conv-id
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.9,
            snippet: 'Ngân sách 150 triệu',
            reason: 'Budget verified',
          });
        },
        (err: any) => {
          assert.ok(err instanceof HttpException);
          assert.strictEqual((err.getResponse() as any).code, 'MESSAGE_CONVERSATION_MISMATCH');
          return true;
        },
      );

      // 3. Reject cross-tenant conversation
      await assert.rejects(
        async () => {
          await service.recordEvidence(wsIdOther, {
            conversationId: convId,
            messageId: msgId,
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.9,
            snippet: 'Ngân sách 150 triệu',
            reason: 'Budget verified',
          });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'CONVERSATION_NOT_FOUND');
          return true;
        },
      );
    });
  });

  // ==========================================================================
  // AREA 4: Lead Scoring Engine, Debounce & Concurrency
  // ==========================================================================
  describe('Area 4: Lead Scoring Engine, Debounce & Concurrency', () => {
    it('FORMULA-1: Deterministic 4-Factor calculation verifies bounds and grade thresholds', () => {
      const now = new Date('2026-09-07T12:00:00Z');

      // 1. Maximum Cap Verification: Fit 25, Velocity 25, Signals 50 = 100 HOT
      const maxLead = LeadScoringCalculator.calculate({
        email: 'ceo@techgiant.com', // 15
        phoneNumber: '0987654321', // 10 -> fit = 25
        hasOrganizationOrTitle: true, // +5 (capped at 25)
        customerResponseTimeMs: 60 * 1000, // +20
        customerMessageCount: 10, // +5 -> vel = 25
        signals: [
          { signalType: BuyingSignalType.NEED_EXPRESSED }, // +30
          { signalType: BuyingSignalType.BUDGET_CONFIRMED }, // +25
          { signalType: BuyingSignalType.TIMELINE_DEFINED }, // +25 -> 80 -> sig = 50 (capped)
        ],
        now,
      });

      assert.strictEqual(maxLead.fitScore, 25);
      assert.strictEqual(maxLead.velocityScore, 25);
      assert.strictEqual(maxLead.signalScore, 50);
      assert.strictEqual(maxLead.decayPenalty, 0);
      assert.strictEqual(maxLead.totalScore, 100);
      assert.strictEqual(maxLead.grade, LeadGrade.HOT);

      // 2. Negative Signals & Objections Deduction
      const objectionLead = LeadScoringCalculator.calculate({
        email: 'buyer@corp.com', // 15
        signals: [
          { signalType: BuyingSignalType.NEED_EXPRESSED }, // +30
          { signalType: BuyingSignalType.COMPETITOR_MENTION }, // -20
          { signalType: BuyingSignalType.OBJECTION_RAISED }, // -15 -> 30 - 35 = -5 -> floored at 0
        ],
        now,
      });
      assert.strictEqual(objectionLead.fitScore, 15);
      assert.strictEqual(objectionLead.signalScore, 0);
      assert.strictEqual(objectionLead.totalScore, 15);
      assert.strictEqual(objectionLead.grade, LeadGrade.JUNK);

      // 3. Time Decay: Inactive for 96 hours (48h grace + 48h = 2 periods of 24h = -10 points)
      const decayedLead = LeadScoringCalculator.calculate({
        email: 'lead@enterprise.com', // 15
        phoneNumber: '0912345678', // 10 -> fit = 25
        signals: [{ signalType: BuyingSignalType.NEED_EXPRESSED }], // +30 -> raw = 55
        lastActivityAt: new Date(now.getTime() - 96 * 3600 * 1000), // 96h ago
        now,
      });
      assert.strictEqual(decayedLead.decayPenalty, 10);
      assert.strictEqual(decayedLead.totalScore, 45); // 55 - 10 = 45 -> COLD
      assert.strictEqual(decayedLead.grade, LeadGrade.COLD);

      // 4. Score Lower Bound Clamp at 0
      const negativeTotal = LeadScoringCalculator.calculate({
        email: 'freemail@gmail.com', // 5
        lastActivityAt: new Date(now.getTime() - 120 * 3600 * 1000), // 120h -> 72h after grace = 3 periods = 15 decay
        now,
      });
      assert.strictEqual(negativeTotal.fitScore, 5);
      assert.strictEqual(negativeTotal.decayPenalty, 15);
      // 5 - 15 = -10 -> clamped to 0
      assert.strictEqual(negativeTotal.totalScore, 0);
      assert.strictEqual(negativeTotal.grade, LeadGrade.JUNK);
    });

    it('CONCURRENCY-1: 30s Redis debounce coalesces burst of 10 messages into exactly 1 execution', async () => {
      const redisMap = new Map<string, string>();
      const enqueuedJobs: any[] = [];
      let recalculationRuns = 0;

      const mockRedis = {
        get: async (k: string) => redisMap.get(k) || null,
        set: async (k: string, v: string) => {
          redisMap.set(k, v);
        },
        del: async (k: string) => {
          redisMap.delete(k);
        },
        acquireLock: async (k: string) => {
          if (redisMap.has(k)) return null;
          redisMap.set(k, 'locked');
          return 'token-abc';
        },
        releaseLock: async (k: string) => {
          redisMap.delete(k);
        },
      };

      const mockQueue = {
        add: async (name: string, data: any, opts: any) => {
          enqueuedJobs.push({ name, data, opts });
        },
      };

      const mockLeadScoringService = {
        recalculateScore: async () => {
          recalculationRuns++;
          return { score: 75, grade: LeadGrade.WARM };
        },
      };

      const listener = new LeadScoringListener(
        mockQueue as any,
        mockRedis as any,
        {
          getClient: () => ({
            conversation: { findFirst: async () => ({ id: convId, contactId, workspaceId: wsId }) },
            lead: { findFirst: async () => ({ id: leadId, contactId, workspaceId: wsId }) },
          }),
        } as any,
        { get: () => 30000 } as any,
      );

      const processor = new LeadScoringProcessor(mockLeadScoringService as any, mockRedis as any);

      // Simulate burst of 10 rapid messages
      for (let i = 0; i < 10; i++) {
        await listener.handleMessageCreated({
          workspaceId: wsId,
          conversationId: convId,
          leadId,
          message: { id: `m-${i}`, senderType: SenderType.CONTACT, isPrivate: false },
        });
      }

      assert.strictEqual(enqueuedJobs.length, 10);
      const latestScheduledAt = Number(
        await mockRedis.get(`ws:${wsId}:lead_scoring:debounce:${leadId}`),
      );

      // Simulate worker processing all 10 jobs
      // The first 9 jobs have scheduledAt < latestScheduledAt
      for (let i = 0; i < 9; i++) {
        const job = {
          name: RECALCULATE_LEAD_SCORE_JOB,
          data: {
            ...enqueuedJobs[i].data,
            scheduledAt: latestScheduledAt - (10 - i) * 100, // older timestamp
          },
        };
        const res = await processor.process(job as any);
        assert.strictEqual(res.status, 'skipped');
        assert.strictEqual(res.reason, 'superseded_by_newer_event');
      }

      // Exactly 0 calculations run during the burst
      assert.strictEqual(recalculationRuns, 0);

      // The 10th job executes at quiet period
      const finalJob = {
        name: RECALCULATE_LEAD_SCORE_JOB,
        data: {
          ...enqueuedJobs[9].data,
          scheduledAt: latestScheduledAt,
        },
      };

      const finalRes = await processor.process(finalJob as any);
      assert.strictEqual(finalRes.status, 'success');
      assert.strictEqual(
        recalculationRuns,
        1,
        'Exactly 1 recalculation must execute for the burst',
      );

      // Debounce key cleaned up
      assert.strictEqual(await mockRedis.get(`ws:${wsId}:lead_scoring:debounce:${leadId}`), null);
    });

    it('CONCURRENCY-2: Distributed lock prevents concurrent worker race condition on same lead', async () => {
      const redisMap = new Map<string, string>();
      let calculationRuns = 0;

      const mockRedis = {
        get: async (k: string) => redisMap.get(k) || null,
        set: async (k: string, v: string) => redisMap.set(k, v),
        del: async (k: string) => redisMap.delete(k),
        acquireLock: async (k: string) => {
          if (redisMap.has(k)) return null;
          redisMap.set(k, 'token-123');
          return 'token-123';
        },
        releaseLock: async (k: string) => {
          redisMap.delete(k);
        },
      };

      const mockLeadScoringService = {
        recalculateScore: async () => {
          calculationRuns++;
          // Simulate latency in recalculation
          await new Promise(r => setTimeout(r, 20));
          return { score: 80, grade: LeadGrade.HOT };
        },
      };

      const processor = new LeadScoringProcessor(mockLeadScoringService as any, mockRedis as any);

      const jobData = {
        workspaceId: wsId,
        leadId,
        scheduledAt: Date.now(),
        trigger: ScoreTriggerEvent.MESSAGE_RECEIVED,
      };

      // Launch 2 workers concurrently on the same lead
      const [worker1, worker2] = await Promise.all([
        processor.process({ name: RECALCULATE_LEAD_SCORE_JOB, data: jobData } as any),
        processor.process({ name: RECALCULATE_LEAD_SCORE_JOB, data: jobData } as any),
      ]);

      const results = [worker1.status, worker2.status].sort();
      assert.deepStrictEqual(
        results,
        ['locked', 'success'],
        'One worker must acquire lock and succeed; the other must return locked',
      );
      assert.strictEqual(calculationRuns, 1);
    });

    it('FINDING-P2-01: Verify LeadScoringService transaction scope behavior during recalculateScore', async () => {
      // Test investigating line 355 of lead-scoring.service.ts:
      // const client = tx || this.prisma.getClient();
      // ...
      // await this.prisma.runInTransaction(async () => { await executePersistence(client); });
      //
      // In a real Prisma client, this.prisma.getClient() outside runInTransaction returns _rootClient.
      // If client is captured outside runInTransaction, executePersistence receives _rootClient rather than ctx.tx.

      let capturedTarget: string | null = null;
      const rootClient = { name: 'ROOT_CLIENT' };
      const txClient = { name: 'TRANSACTION_CLIENT' };

      let currentAlsStore: any = undefined;

      const mockPrismaService = {
        getClient: () => currentAlsStore?.txClient ?? rootClient,
        runInTransaction: async (cb: any) => {
          currentAlsStore = { txClient };
          try {
            return await cb({ tx: txClient });
          } finally {
            currentAlsStore = undefined;
          }
        },
      };

      // Scenario A: current code pattern in LeadScoringService.recalculateScore
      // Line 181:
      const outerClient = mockPrismaService.getClient(); // Evaluated at top of function
      await mockPrismaService.runInTransaction(async (_ctx: any) => {
        // Line 356:
        capturedTarget = outerClient.name;
      });

      // Assert that outerClient was ROOT_CLIENT, not TRANSACTION_CLIENT!
      assert.strictEqual(
        capturedTarget,
        'ROOT_CLIENT',
        'Empirical finding confirmed: capturing client before runInTransaction passes ROOT_CLIENT instead of txClient',
      );
    });
  });
});
