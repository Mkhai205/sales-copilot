import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BuyingSignalType, DomainEvent } from '@sales-copilot/shared-contracts';
import { SalesEvidenceService } from '../sales-evidence.service';

describe('SalesEvidenceService (Evidence Ingestion, Filtering & Invalidation)', () => {
  let service: SalesEvidenceService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let leadsDb: Map<string, any>;
  let evidencesDb: Map<string, any>;

  const ws1 = 'ws_01';
  const ws2 = 'ws_02';

  const conv1 = 'conv-01';
  const conv2 = 'conv-02';
  const msg1 = 'msg-01';
  const msgOtherConv = 'msg-other-conv';
  const msgWs2 = 'msg-99';
  const lead1 = 'lead-01';

  beforeEach(() => {
    conversationsDb = new Map();
    messagesDb = new Map();
    leadsDb = new Map();
    evidencesDb = new Map();
    emittedEvents = [];

    // Seed conversations
    conversationsDb.set(conv1, {
      id: conv1,
      workspaceId: ws1,
      contactId: 'ct-01',
    });
    conversationsDb.set(conv2, {
      id: conv2,
      workspaceId: ws1,
      contactId: 'ct-02',
    });

    // Seed messages
    messagesDb.set(msg1, {
      id: msg1,
      workspaceId: ws1,
      conversationId: conv1,
      content: 'Ngân sách tối đa của bên mình cho dự án này là 200 triệu',
    });
    messagesDb.set(msgOtherConv, {
      id: msgOtherConv,
      workspaceId: ws1,
      conversationId: conv2,
      content: 'Tin nhắn ở hội thoại khác',
    });
    messagesDb.set(msgWs2, {
      id: msgWs2,
      workspaceId: ws2,
      conversationId: 'conv-ws2',
      content: 'Tin nhắn workspace khác',
    });

    // Seed lead
    leadsDb.set(lead1, {
      id: lead1,
      workspaceId: ws1,
      contactId: 'ct-01',
      score: 50,
    });

    // Setup Prisma client mock with in-memory stores
    clientMock = {
      conversation: {
        findFirst: async ({ where }: any) => {
          for (const c of conversationsDb.values()) {
            if (c.id === where.id && c.workspaceId === where.workspaceId) {
              return { ...c };
            }
          }
          return null;
        },
      },
      message: {
        findFirst: async ({ where }: any) => {
          for (const m of messagesDb.values()) {
            if (m.id === where.id && m.workspaceId === where.workspaceId) {
              return { ...m };
            }
          }
          return null;
        },
      },
      lead: {
        findFirst: async ({ where }: any) => {
          for (const l of leadsDb.values()) {
            if (l.id === where.id && l.workspaceId === where.workspaceId) {
              return { ...l };
            }
          }
          return null;
        },
      },
      salesEvidence: {
        create: async ({ data }: any) => {
          const id = `evi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const record = {
            id,
            ...data,
            isInvalidated: false,
            invalidationReason: null,
            invalidatedByUserId: null,
            invalidatedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          evidencesDb.set(id, record);
          return { ...record };
        },
        findFirst: async ({ where }: any) => {
          for (const e of evidencesDb.values()) {
            if (e.id === where.id && e.workspaceId === where.workspaceId) {
              return { ...e };
            }
          }
          return null;
        },
        findMany: async ({ where, skip = 0, take = 50, orderBy }: any) => {
          const results = Array.from(evidencesDb.values()).filter(e => {
            if (where.workspaceId && e.workspaceId !== where.workspaceId) return false;
            if (where.leadId && e.leadId !== where.leadId) return false;
            if (where.conversationId && e.conversationId !== where.conversationId) return false;
            if (where.messageId && e.messageId !== where.messageId) return false;
            if (where.isInvalidated !== undefined && e.isInvalidated !== where.isInvalidated)
              return false;
            if (where.signalType && e.signalType !== where.signalType) return false;
            if (where.confidence?.gte !== undefined && e.confidence < where.confidence.gte)
              return false;
            return true;
          });

          if (orderBy?.createdAt === 'desc') {
            results.sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            );
          }

          return results.slice(skip, skip + take);
        },
        count: async ({ where }: any) => {
          const results = Array.from(evidencesDb.values()).filter(e => {
            if (where.workspaceId && e.workspaceId !== where.workspaceId) return false;
            if (where.leadId && e.leadId !== where.leadId) return false;
            if (where.conversationId && e.conversationId !== where.conversationId) return false;
            if (where.isInvalidated !== undefined && e.isInvalidated !== where.isInvalidated)
              return false;
            if (where.signalType && e.signalType !== where.signalType) return false;
            if (where.confidence?.gte !== undefined && e.confidence < where.confidence.gte)
              return false;
            return true;
          });
          return results.length;
        },
        update: async ({ where, data }: any) => {
          const existing = evidencesDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          evidencesDb.set(where.id, updated);
          return { ...updated };
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    service = new SalesEvidenceService(mockPrismaService as any, mockEventEmitter as any);
  });

  // ==========================================================================
  // Story US-2.2.1: Ingestion with Verbatim Snippet & Confidence
  // ==========================================================================
  describe('US-2.2.1: Structured Sales Evidence Ingestion', () => {
    it('should successfully ingest a high-confidence budget signal and emit domain event', async () => {
      const result = await service.recordEvidence(ws1, {
        leadId: lead1,
        conversationId: conv1,
        messageId: msg1,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        confidence: 0.95,
        snippet: 'Ngân sách tối đa của bên mình cho dự án này là 200 triệu',
        reason: 'Khách hàng nêu rõ trần ngân sách dự toán là 200 triệu VND',
      });

      assert.ok(result.id);
      assert.strictEqual(result.workspaceId, ws1);
      assert.strictEqual(result.leadId, lead1);
      assert.strictEqual(result.confidence, 0.95);
      assert.strictEqual(result.signalType, BuyingSignalType.BUDGET_CONFIRMED);
      assert.strictEqual(result.isInvalidated, false);

      // Verify domain event emitted
      const detectedEvent = emittedEvents.find(
        e => e.event === DomainEvent.SALES_EVIDENCE_DETECTED,
      );
      assert.ok(detectedEvent);
      assert.strictEqual(detectedEvent.payload.workspaceId, ws1);
      assert.strictEqual(detectedEvent.payload.leadId, lead1);
      assert.strictEqual(detectedEvent.payload.conversationId, conv1);
      assert.strictEqual(detectedEvent.payload.evidence.confidence, 0.95);
    });

    it('should reject Sales Evidence with confidence out of bounds (> 1.0)', async () => {
      await assert.rejects(
        async () => {
          await service.recordEvidence(ws1, {
            leadId: lead1,
            conversationId: conv1,
            messageId: msg1,
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 1.25,
            snippet: 'Snippet',
            reason: 'Reason',
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_CONFIDENCE');
          return true;
        },
      );
      assert.strictEqual(evidencesDb.size, 0);
    });

    it('should reject Sales Evidence with confidence out of bounds (< 0.0)', async () => {
      await assert.rejects(
        async () => {
          await service.recordEvidence(ws1, {
            leadId: lead1,
            conversationId: conv1,
            signalType: BuyingSignalType.NEED_EXPRESSED,
            confidence: -0.1,
            snippet: 'Snippet',
            reason: 'Reason',
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          return true;
        },
      );
    });

    it('should prevent associating evidence with a message from another workspace', async () => {
      await assert.rejects(
        async () => {
          await service.recordEvidence(ws1, {
            leadId: lead1,
            conversationId: conv1,
            messageId: msgWs2, // from ws2
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.9,
            snippet: 'Cross-tenant text',
            reason: 'Cross-tenant reason',
          });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'MESSAGE_NOT_FOUND');
          return true;
        },
      );
    });

    it('should prevent associating evidence with a message from another conversation', async () => {
      await assert.rejects(
        async () => {
          await service.recordEvidence(ws1, {
            leadId: lead1,
            conversationId: conv1,
            messageId: msgOtherConv, // belongs to conv2
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.9,
            snippet: 'Snippet',
            reason: 'Reason',
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'MESSAGE_CONVERSATION_MISMATCH');
          return true;
        },
      );
    });
  });

  // ==========================================================================
  // Story US-2.2.2: Retrieval & Filtering
  // ==========================================================================
  describe('US-2.2.2: Sales Evidence Retrieval & Filtering', () => {
    beforeEach(async () => {
      // Seed 3 evidence records for lead1
      await service.recordEvidence(ws1, {
        leadId: lead1,
        conversationId: conv1,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        confidence: 0.95,
        snippet: 'Ngân sách 200 triệu',
        reason: 'Budget explicit',
      });
      await service.recordEvidence(ws1, {
        leadId: lead1,
        conversationId: conv1,
        signalType: BuyingSignalType.TIMELINE_DEFINED,
        confidence: 0.88,
        snippet: 'Cần triển khai xong trong tháng 10',
        reason: 'Timeline explicit',
      });
      await service.recordEvidence(ws1, {
        leadId: lead1,
        conversationId: conv1,
        signalType: BuyingSignalType.COMPETITOR_MENTION,
        confidence: 0.8,
        snippet: 'Đang cân nhắc giải pháp của bên B',
        reason: 'Competitor comparison',
      });
    });

    it('should retrieve all evidence for a Lead with pagination', async () => {
      const result = await service.listByLead(ws1, lead1, { page: 1, limit: 10 });
      assert.strictEqual(result.items.length, 3);
      assert.strictEqual(result.meta.total, 3);
      assert.strictEqual(result.meta.hasMore, false);
    });

    it('should filter evidence by specific signal type', async () => {
      const result = await service.listByLead(ws1, lead1, {
        page: 1,
        limit: 10,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
      });
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);
    });

    it('should filter evidence by minConfidence', async () => {
      const result = await service.listByLead(ws1, lead1, {
        page: 1,
        limit: 10,
        minConfidence: 0.85,
      });
      assert.strictEqual(result.items.length, 2); // 0.95 and 0.88
    });

    it('should retrieve evidence for a conversation', async () => {
      const result = await service.listByConversation(ws1, conv1);
      assert.strictEqual(result.length, 3);
    });
  });

  // ==========================================================================
  // Story US-2.2.4: False Positive Invalidation
  // ==========================================================================
  describe('US-2.2.4: False Positive Invalidation', () => {
    let createdEvidence: any;

    beforeEach(async () => {
      createdEvidence = await service.recordEvidence(ws1, {
        leadId: lead1,
        conversationId: conv1,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        confidence: 0.9,
        snippet: 'Khách hàng nói đùa về ngân sách',
        reason: 'Budget detected',
      });
      emittedEvents = [];
    });

    it('should mark evidence as invalidated and emit sales_evidence.invalidated event', async () => {
      const invalidated = await service.invalidateEvidence(
        ws1,
        createdEvidence.id,
        'usr_sales_rep',
        { invalidationReason: 'Khách hàng nói đùa, không phải ngân sách thật' },
      );

      assert.strictEqual(invalidated.isInvalidated, true);
      assert.strictEqual(
        invalidated.invalidationReason,
        'Khách hàng nói đùa, không phải ngân sách thật',
      );
      assert.strictEqual(invalidated.invalidatedByUserId, 'usr_sales_rep');
      assert.ok(invalidated.invalidatedAt);

      // Verify domain event
      const event = emittedEvents.find(e => e.event === DomainEvent.SALES_EVIDENCE_INVALIDATED);
      assert.ok(event);
      assert.strictEqual(event.payload.workspaceId, ws1);
      assert.strictEqual(event.payload.leadId, lead1);
      assert.strictEqual(event.payload.evidenceId, createdEvidence.id);
      assert.strictEqual(event.payload.invalidatedByUserId, 'usr_sales_rep');
    });

    it('should exclude invalidated evidence from lead evidence list by default', async () => {
      await service.invalidateEvidence(ws1, createdEvidence.id, 'usr_sales_rep');

      const activeList = await service.listByLead(ws1, lead1, { page: 1, limit: 10 });
      assert.strictEqual(activeList.items.length, 0);

      const allList = await service.listByLead(ws1, lead1, {
        page: 1,
        limit: 10,
        includeInvalidated: true,
      });
      assert.strictEqual(allList.items.length, 1);
      assert.strictEqual(allList.items[0].isInvalidated, true);
    });

    it('should throw NotFoundException if invalidating non-existent evidence', async () => {
      await assert.rejects(
        async () => {
          await service.invalidateEvidence(ws1, 'non_existent_id');
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'SALES_EVIDENCE_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('findByMessage (Encapsulated Message Deduplication Query)', () => {
    it('should return active evidence matching messageId and conversationId', async () => {
      await service.recordEvidence(ws1, {
        conversationId: conv1,
        messageId: msg1,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        confidence: 0.9,
        snippet: 'Ngân sách 200 triệu',
        reason: 'Budget stated',
      });

      const results = await service.findByMessage(ws1, conv1, msg1);
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].messageId, msg1);
      assert.strictEqual(results[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);

      const emptyResults = await service.findByMessage(ws1, conv1, 'non_existent_msg');
      assert.strictEqual(emptyResults.length, 0);
    });
  });
});
