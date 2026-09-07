import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  CopilotSuggestionType,
  DomainEvent,
  SuggestionStatus,
} from '@sales-copilot/shared-contracts';
import { CopilotService } from '../copilot.service';

describe('CopilotService (Lifecycle, Single Active Invariant & Metrics)', () => {
  let service: CopilotService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let suggestionsDb: Map<string, any>;
  let emittedEvents: Array<{ event: string; payload: any }>;

  const ws1 = 'ws-1111';
  const ws2 = 'ws-2222';
  const conv1 = 'conv-001';
  const conv2 = 'conv-002';

  beforeEach(() => {
    suggestionsDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      copilotSuggestion: {
        findFirst: async ({ where }: any) => {
          for (const s of suggestionsDb.values()) {
            let match = true;
            if (where.id && s.id !== where.id) match = false;
            if (where.workspaceId && s.workspaceId !== where.workspaceId) match = false;
            if (where.conversationId && s.conversationId !== where.conversationId) match = false;
            if (where.status && s.status !== where.status) match = false;
            if (match) return { ...s };
          }
          return null;
        },
        findMany: async ({ where }: any) => {
          const results: any[] = [];
          for (const s of suggestionsDb.values()) {
            let match = true;
            if (where.workspaceId && s.workspaceId !== where.workspaceId) match = false;
            if (where.conversationId && s.conversationId !== where.conversationId) match = false;
            if (where.status && s.status !== where.status) match = false;
            if (match) results.push({ ...s });
          }
          return results;
        },
        create: async ({ data }: any) => {
          const record = {
            id: `sug-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          suggestionsDb.set(record.id, record);
          return { ...record };
        },
        update: async ({ where, data }: any) => {
          const existing = suggestionsDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          suggestionsDb.set(where.id, updated);
          return { ...updated };
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [id, s] of suggestionsDb.entries()) {
            let match = true;
            if (where.workspaceId && s.workspaceId !== where.workspaceId) match = false;
            if (where.conversationId && s.conversationId !== where.conversationId) match = false;
            if (where.status && s.status !== where.status) match = false;
            if (where.expiresAt?.lt && !(s.expiresAt < where.expiresAt.lt)) match = false;
            if (match) {
              suggestionsDb.set(id, { ...s, ...data, updatedAt: new Date() });
              count++;
            }
          }
          return { count };
        },
        count: async ({ where }: any) => {
          let count = 0;
          for (const s of suggestionsDb.values()) {
            let match = true;
            if (where.workspaceId && s.workspaceId !== where.workspaceId) match = false;
            if (where.status && s.status !== where.status) match = false;
            if (match) count++;
          }
          return count;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new CopilotService(mockPrismaService, mockEventEmitter);
  });

  describe('BR-2.5.1: Single Active Suggestion Invariant', () => {
    it('should expire existing pending suggestions when creating new suggestions', async () => {
      // 1. Create first suggestion
      const firstItems = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Hello world',
          actionPayload: {},
          confidence: 0.85,
        },
      ];
      const res1 = await service.createSuggestions(ws1, conv1, firstItems);
      assert.strictEqual(res1.length, 1);
      assert.strictEqual(res1[0].status, SuggestionStatus.PENDING);

      // 2. Create second suggestion for same conversation
      const secondItems = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 2',
          content: 'Updated response',
          actionPayload: {},
          confidence: 0.95,
        },
      ];
      const res2 = await service.createSuggestions(ws1, conv1, secondItems);
      assert.strictEqual(res2.length, 1);
      assert.strictEqual(res2[0].status, SuggestionStatus.PENDING);

      // Verify first suggestion was marked as EXPIRED
      const firstRecord = suggestionsDb.get(res1[0].id);
      assert.strictEqual(firstRecord.status, SuggestionStatus.EXPIRED);
      assert.strictEqual(firstRecord.dismissedReason, 'SUPERSEDED_BY_NEW_SUGGESTION');

      // Verify event was emitted for new suggestion
      const emitted = emittedEvents
        .filter(e => e.event === DomainEvent.COPILOT_SUGGESTION_GENERATED)
        .pop();
      assert.ok(emitted);
      assert.strictEqual(emitted.payload.suggestionId, res2[0].id);
    });

    it('should support creating multiple distinct suggestion types simultaneously', async () => {
      const multiItems = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Reply Draft',
          content: 'Here is a suggested reply',
          actionPayload: {},
          confidence: 0.92,
        },
        {
          suggestionType: CopilotSuggestionType.NEXT_BEST_ACTION,
          title: 'Convert to Opportunity',
          content: 'Recommend creating an opportunity',
          actionPayload: { action: 'CONVERT_TO_OPPORTUNITY' },
          confidence: 0.88,
        },
        {
          suggestionType: CopilotSuggestionType.BATTLECARD,
          title: 'Competitor Battlecard',
          content: 'Key advantages vs Competitor',
          actionPayload: {},
          confidence: 0.85,
        },
      ];

      const res = await service.createSuggestions(ws1, conv1, multiItems);
      assert.strictEqual(res.length, 3);
      assert.strictEqual(res[0].suggestionType, CopilotSuggestionType.REPLY_DRAFT);
      assert.strictEqual(res[1].suggestionType, CopilotSuggestionType.NEXT_BEST_ACTION);
      assert.strictEqual(res[2].suggestionType, CopilotSuggestionType.BATTLECARD);

      const pending = await service.getPendingSuggestions(ws1, conv1);
      assert.strictEqual(pending.length, 3);
    });
  });

  describe('BR-2.5.2: Invalidation on Customer Message', () => {
    it('should expire all pending suggestions for a conversation and emit COPILOT_SUGGESTION_ACTED event', async () => {
      const items = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Answer',
          actionPayload: {},
          confidence: 0.9,
        },
      ];
      const created = await service.createSuggestions(ws1, conv1, items);
      assert.strictEqual(created[0].status, SuggestionStatus.PENDING);

      const expiredCount = await service.expireSuggestionsForConversation(
        ws1,
        conv1,
        'NEW_CUSTOMER_MESSAGE',
      );
      assert.strictEqual(expiredCount, 1);

      const record = suggestionsDb.get(created[0].id);
      assert.strictEqual(record.status, SuggestionStatus.EXPIRED);
      assert.strictEqual(record.dismissedReason, 'NEW_CUSTOMER_MESSAGE');

      // Verify realtime event was emitted
      const expiredEvent = emittedEvents.find(
        e =>
          e.event === DomainEvent.COPILOT_SUGGESTION_ACTED &&
          e.payload.action === SuggestionStatus.EXPIRED,
      );
      assert.ok(expiredEvent);
      assert.strictEqual(expiredEvent.payload.conversationId, conv1);
    });
  });

  describe('Suggestion Resolution & State Machine', () => {
    it('should resolve suggestion to APPLIED and emit event', async () => {
      const items = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Answer',
          actionPayload: {},
          confidence: 0.9,
        },
      ];
      const created = await service.createSuggestions(ws1, conv1, items);

      const resolved = await service.resolveSuggestion(
        ws1,
        created[0].id,
        SuggestionStatus.APPLIED,
        'user-123',
      );

      assert.strictEqual(resolved.status, SuggestionStatus.APPLIED);
      assert.strictEqual(resolved.resolvedByUserId, 'user-123');
      assert.ok(resolved.resolvedAt);

      const event = emittedEvents.find(e => e.event === DomainEvent.COPILOT_SUGGESTION_ACTED);
      assert.ok(event);
      assert.strictEqual(event.payload.action, SuggestionStatus.APPLIED);
    });

    it('should reject resolution if suggestion already resolved', async () => {
      const items = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Answer',
          actionPayload: {},
          confidence: 0.9,
        },
      ];
      const created = await service.createSuggestions(ws1, conv1, items);

      await service.resolveSuggestion(ws1, created[0].id, SuggestionStatus.ACCEPTED);

      await assert.rejects(
        () => service.resolveSuggestion(ws1, created[0].id, SuggestionStatus.DISMISSED),
        BadRequestException,
      );
    });

    it('should enforce tenant isolation on resolution', async () => {
      const items = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Answer',
          actionPayload: {},
          confidence: 0.9,
        },
      ];
      const created = await service.createSuggestions(ws1, conv1, items);

      // Attempting to resolve from ws2 should fail with NotFoundException
      await assert.rejects(
        () => service.resolveSuggestion(ws2, created[0].id, SuggestionStatus.ACCEPTED),
        NotFoundException,
      );
    });

    it('should reject resolution and mark as EXPIRED if suggestion has expired past TTL', async () => {
      const items = [
        {
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Draft 1',
          content: 'Answer',
          actionPayload: {},
          confidence: 0.9,
        },
      ];
      const created = await service.createSuggestions(ws1, conv1, items);

      // Manually set expiresAt in the past
      const record = suggestionsDb.get(created[0].id);
      record.expiresAt = new Date(Date.now() - 5000);
      suggestionsDb.set(created[0].id, record);

      await assert.rejects(
        () => service.resolveSuggestion(ws1, created[0].id, SuggestionStatus.ACCEPTED),
        (err: any) =>
          err instanceof BadRequestException &&
          (err.getResponse() as any)?.code === 'SUGGESTION_EXPIRED',
      );

      const updated = suggestionsDb.get(created[0].id);
      assert.strictEqual(updated.status, SuggestionStatus.EXPIRED);
      assert.strictEqual(updated.dismissedReason, 'EXPIRED_BY_TTL');
    });
  });

  describe('getMetrics', () => {
    it('should compute acceptance rates and dismissal reasons', async () => {
      suggestionsDb.set('s1', { workspaceId: ws1, status: SuggestionStatus.ACCEPTED });
      suggestionsDb.set('s2', { workspaceId: ws1, status: SuggestionStatus.APPLIED });
      suggestionsDb.set('s3', {
        workspaceId: ws1,
        status: SuggestionStatus.DISMISSED,
        dismissedReason: 'NOT_RELEVANT',
      });
      suggestionsDb.set('s4', { workspaceId: ws1, status: SuggestionStatus.EXPIRED });
      suggestionsDb.set('s5', { workspaceId: ws1, status: SuggestionStatus.PENDING });

      const metrics = await service.getMetrics(ws1);
      assert.strictEqual(metrics.totalSuggestions, 5);
      assert.strictEqual(metrics.acceptedCount, 1);
      assert.strictEqual(metrics.appliedCount, 1);
      assert.strictEqual(metrics.dismissedCount, 1);
      assert.strictEqual(metrics.expiredCount, 1);
      assert.strictEqual(metrics.pendingCount, 1);
      // Resolved count = 1 + 1 + 1 + 1 = 4. Accepted = 2. Rate = (2 / 4) * 100 = 50.0%
      assert.strictEqual(metrics.acceptanceRate, 50);
      assert.strictEqual(metrics.dismissalReasons['NOT_RELEVANT'], 1);
    });
  });
});
