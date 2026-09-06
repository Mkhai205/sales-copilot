import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import {
  BuyingSignalType,
  DomainEvent,
  LeadGrade,
  LeadStage,
  LeadStatus,
  ScoreTriggerEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { LeadScoringService } from '../lead-scoring.service';

describe('LeadScoringService (Tenant Scoping, Calculation & Audit History)', () => {
  let service: LeadScoringService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  // In-memory data stores
  let leadsDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let evidencesDb: Map<string, any>;
  let leadScoresDb: Map<string, any>;
  let leadScoreHistoriesDb: Map<string, any>;

  const ws1 = '11111111-1111-4111-8111-111111111111';
  const ws2 = '22222222-2222-4222-8222-222222222222';
  const lead1 = 'lead-001';
  const leadWs2 = 'lead-ws2';
  const contact1 = 'ct-001';
  const conv1 = 'conv-001';

  beforeEach(() => {
    leadsDb = new Map();
    contactsDb = new Map();
    conversationsDb = new Map();
    messagesDb = new Map();
    evidencesDb = new Map();
    leadScoresDb = new Map();
    leadScoreHistoriesDb = new Map();
    emittedEvents = [];

    // Seed contact
    contactsDb.set(contact1, {
      id: contact1,
      workspaceId: ws1,
      name: 'Nguyen Van A',
      email: 'a.nguyen@enterprise.vn', // Corporate email: +15
      phoneNumber: '0987654321', // Valid phone: +10 -> fit = 25
      customAttributes: { company: 'Enterprise VN' },
    });

    // Seed lead in ws1
    leadsDb.set(lead1, {
      id: lead1,
      workspaceId: ws1,
      contactId: contact1,
      status: LeadStatus.NEW,
      stage: LeadStage.DISCOVERY,
      score: 0,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    });

    // Seed lead in ws2 (cross-tenant test)
    leadsDb.set(leadWs2, {
      id: leadWs2,
      workspaceId: ws2,
      contactId: 'ct-ws2',
      status: LeadStatus.NEW,
      stage: LeadStage.DISCOVERY,
      score: 50,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      metadata: {},
    });

    // Seed conversation in ws1
    conversationsDb.set(conv1, {
      id: conv1,
      workspaceId: ws1,
      contactId: contact1,
      lastActivityAt: new Date(),
    });

    // Seed messages
    const now = Date.now();
    messagesDb.set('msg-agent-1', {
      id: 'msg-agent-1',
      conversationId: conv1,
      workspaceId: ws1,
      senderType: SenderType.USER,
      senderId: 'usr-agent-1',
      createdAt: new Date(now - 120 * 1000), // 2m ago
    });
    messagesDb.set('msg-client-1', {
      id: 'msg-client-1',
      conversationId: conv1,
      workspaceId: ws1,
      senderType: SenderType.CONTACT,
      senderId: contact1,
      createdAt: new Date(now - 60 * 1000), // 1m ago (response time = 60s <= 2m -> +20)
    });

    // Setup Prisma client mock
    clientMock = {
      lead: {
        findFirst: async ({ where, include }: any) => {
          for (const l of leadsDb.values()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            if (where.contactId && l.contactId !== where.contactId) continue;

            const res = { ...l };
            if (include?.contact) {
              res.contact = contactsDb.get(l.contactId) || null;
            }
            return res;
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          const l = leadsDb.get(where.id);
          if (!l) throw new Error('Lead not found');
          const updated = { ...l, ...data, updatedAt: new Date() };
          leadsDb.set(where.id, updated);
          return updated;
        },
      },
      conversation: {
        findFirst: async ({ where, include }: any) => {
          for (const c of conversationsDb.values()) {
            if (where.id && c.id !== where.id) continue;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            if (where.contactId && c.contactId !== where.contactId) continue;

            const res = { ...c };
            if (include?.messages) {
              res.messages = Array.from(messagesDb.values())
                .filter((m: any) => m.conversationId === c.id)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            }
            return res;
          }
          return null;
        },
      },
      salesEvidence: {
        findMany: async ({ where }: any) => {
          return Array.from(evidencesDb.values()).filter((e: any) => {
            if (where.workspaceId && e.workspaceId !== where.workspaceId) return false;
            if (where.leadId && e.leadId !== where.leadId) return false;
            if (where.isInvalidated !== undefined && e.isInvalidated !== where.isInvalidated)
              return false;
            return true;
          });
        },
      },
      leadScore: {
        findFirst: async ({ where }: any) => {
          for (const s of leadScoresDb.values()) {
            if (where.workspaceId && s.workspaceId !== where.workspaceId) continue;
            if (where.leadId && s.leadId !== where.leadId) continue;
            if (where.id && s.id !== where.id) continue;
            return { ...s };
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = `score-${Date.now()}-${Math.random()}`;
          const record = {
            id,
            ...data,
            calculatedAt: new Date(),
            updatedAt: new Date(),
          };
          leadScoresDb.set(id, record);
          return { ...record };
        },
        update: async ({ where, data }: any) => {
          const s = leadScoresDb.get(where.id);
          if (!s) throw new Error('LeadScore not found');
          const updated = { ...s, ...data, updatedAt: new Date() };
          leadScoresDb.set(where.id, updated);
          return { ...updated };
        },
      },
      leadScoreHistory: {
        create: async ({ data }: any) => {
          const id = `hist-${Date.now()}-${Math.random()}`;
          const record = {
            id,
            ...data,
            createdAt: new Date(),
          };
          leadScoreHistoriesDb.set(id, record);
          return { ...record };
        },
        findMany: async ({ where, skip = 0, take = 20 }: any) => {
          const results = Array.from(leadScoreHistoriesDb.values()).filter((h: any) => {
            if (where.workspaceId && h.workspaceId !== where.workspaceId) return false;
            if (where.leadId && h.leadId !== where.leadId) return false;
            return true;
          });
          results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return results.slice(skip, skip + take);
        },
        count: async ({ where }: any) => {
          return Array.from(leadScoreHistoriesDb.values()).filter((h: any) => {
            if (where.workspaceId && h.workspaceId !== where.workspaceId) return false;
            if (where.leadId && h.leadId !== where.leadId) return false;
            return true;
          }).length;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      runInTransaction: async (cb: any) => cb(clientMock),
    };

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    service = new LeadScoringService(mockPrismaService, mockEventEmitter);
  });

  // ==========================================================================
  // 1. Tenant Scoping & Isolation Invariants
  // ==========================================================================
  describe('Tenant Scoping & Security', () => {
    it('should prevent workspace A from reading lead score belonging to workspace B', async () => {
      await assert.rejects(
        async () => {
          await service.getScore(ws1, leadWs2);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'LEAD_NOT_FOUND');
          return true;
        },
      );
    });

    it('should prevent workspace A from recalculating score for lead in workspace B', async () => {
      await assert.rejects(
        async () => {
          await service.recalculateScore(ws1, leadWs2, ScoreTriggerEvent.MANUAL_RECALCULATION);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });

    it('should prevent workspace A from reading audit history of lead in workspace B', async () => {
      await assert.rejects(
        async () => {
          await service.getHistory(ws1, leadWs2, { page: 1, limit: 10 });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });
  });

  // ==========================================================================
  // 2. Score Recalculation & State Updates
  // ==========================================================================
  describe('recalculateScore', () => {
    it('should compute initial score, update Lead.score, and emit LEAD_SCORE_UPDATED', async () => {
      // Add a buying signal
      evidencesDb.set('evi-1', {
        id: 'evi-1',
        workspaceId: ws1,
        leadId: lead1,
        signalType: BuyingSignalType.NEED_EXPRESSED, // +30
        isInvalidated: false,
        reason: 'Explicit requirement',
      });

      const result = await service.recalculateScore(
        ws1,
        lead1,
        ScoreTriggerEvent.INITIAL_CALCULATION,
        'Initial setup',
      );

      // Fit = 25 (email + phone + company), Vel = 21 (fast reply 20 + 1 msg), Sig = 30 -> 76 (WARM)
      assert.strictEqual(result.scoreFactors.fitScore, 25);
      assert.strictEqual(result.scoreFactors.velocityScore, 21);
      assert.strictEqual(result.scoreFactors.signalScore, 30);
      assert.strictEqual(result.scoreFactors.totalScore, 76);
      assert.strictEqual(result.score, 76);
      assert.strictEqual(result.grade, LeadGrade.WARM);

      // Verify Lead.score was updated in DB
      const updatedLead = leadsDb.get(lead1);
      assert.strictEqual(updatedLead.score, 76);

      // Verify LeadScore was persisted
      assert.strictEqual(leadScoresDb.size, 1);

      // Verify initial history was recorded
      assert.strictEqual(leadScoreHistoriesDb.size, 1);
      const hist = Array.from(leadScoreHistoriesDb.values())[0];
      assert.strictEqual(hist.previousScore, 0);
      assert.strictEqual(hist.newScore, 76);
      assert.strictEqual(hist.eventTrigger, ScoreTriggerEvent.INITIAL_CALCULATION);

      // Verify domain event was emitted
      const emitted = emittedEvents.find(e => e.event === DomainEvent.LEAD_SCORE_UPDATED);
      assert.ok(emitted);
      assert.strictEqual(emitted.payload.leadId, lead1);
      assert.strictEqual(emitted.payload.score, 76);
      assert.strictEqual(emitted.payload.grade, LeadGrade.WARM);
    });

    it('should update Lead.lastActivityAt when trigger is MESSAGE_RECEIVED', async () => {
      const pastDate = new Date('2026-09-01T00:00:00Z');
      leadsDb.set(lead1, { ...leadsDb.get(lead1), lastActivityAt: pastDate });

      await service.recalculateScore(
        ws1,
        lead1,
        ScoreTriggerEvent.MESSAGE_RECEIVED,
        'New customer message',
      );

      const updatedLead = leadsDb.get(lead1);
      assert.ok(new Date(updatedLead.lastActivityAt).getTime() > pastDate.getTime());
    });
  });

  // ==========================================================================
  // 3. History Ledger Pruning (Avoiding redundant audit rows)
  // ==========================================================================
  describe('History Ledger Optimization & Pruning', () => {
    it('should not record a new history item if score and grade remain unchanged', async () => {
      // First calculation
      await service.recalculateScore(ws1, lead1, ScoreTriggerEvent.INITIAL_CALCULATION);
      assert.strictEqual(leadScoreHistoriesDb.size, 1);

      // Second calculation with identical inputs and non-manual trigger
      await service.recalculateScore(ws1, lead1, ScoreTriggerEvent.MESSAGE_RECEIVED);
      // History size should still be 1 (pruned!)
      assert.strictEqual(leadScoreHistoriesDb.size, 1);
    });

    it('should record a new history item on MANUAL_RECALCULATION even if score is identical', async () => {
      await service.recalculateScore(ws1, lead1, ScoreTriggerEvent.INITIAL_CALCULATION);
      assert.strictEqual(leadScoreHistoriesDb.size, 1);

      await service.recalculateScore(
        ws1,
        lead1,
        ScoreTriggerEvent.MANUAL_RECALCULATION,
        'Agent audit check',
      );
      assert.strictEqual(leadScoreHistoriesDb.size, 2);
    });

    it('should record history when score changes due to newly added signal', async () => {
      await service.recalculateScore(ws1, lead1, ScoreTriggerEvent.INITIAL_CALCULATION);
      assert.strictEqual(leadScoreHistoriesDb.size, 1);

      // Add high-intent signal (+25)
      evidencesDb.set('evi-budget', {
        id: 'evi-budget',
        workspaceId: ws1,
        leadId: lead1,
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        isInvalidated: false,
      });

      await service.recalculateScore(ws1, lead1, ScoreTriggerEvent.EVIDENCE_DETECTED);
      assert.strictEqual(leadScoreHistoriesDb.size, 2);

      const latestHist = Array.from(leadScoreHistoriesDb.values())[1];
      assert.ok(latestHist.newScore > latestHist.previousScore);
      assert.strictEqual(latestHist.eventTrigger, ScoreTriggerEvent.EVIDENCE_DETECTED);
    });
  });

  // ==========================================================================
  // 4. getScore & getHistory Retrieval
  // ==========================================================================
  describe('getScore and getHistory', () => {
    it('should return existing score without recalculating if already present', async () => {
      // Seed an existing score record
      leadScoresDb.set('score-existing', {
        id: 'score-existing',
        workspaceId: ws1,
        leadId: lead1,
        score: 88,
        grade: LeadGrade.HOT,
        scoreFactors: { totalScore: 88 },
        calculatedAt: new Date(),
        updatedAt: new Date(),
      });

      const score = await service.getScore(ws1, lead1);
      assert.strictEqual(score.score, 88);
      assert.strictEqual(score.grade, LeadGrade.HOT);
      assert.strictEqual(score.leadId, lead1);
    });

    it('should paginate score history correctly', async () => {
      // Seed 3 history records
      for (let i = 1; i <= 3; i++) {
        leadScoreHistoriesDb.set(`hist-${i}`, {
          id: `hist-${i}`,
          workspaceId: ws1,
          leadId: lead1,
          previousScore: 40 + i,
          newScore: 50 + i,
          delta: 10,
          previousGrade: LeadGrade.COLD,
          newGrade: LeadGrade.WARM,
          reason: `Step ${i}`,
          eventTrigger: ScoreTriggerEvent.MESSAGE_RECEIVED,
          scoreFactors: { totalScore: 50 + i },
          createdAt: new Date(Date.now() - (10 - i) * 1000),
        });
      }

      const paged = await service.getHistory(ws1, lead1, { page: 1, limit: 2 });
      assert.strictEqual(paged.items.length, 2);
      assert.strictEqual(paged.meta.total, 3);
      assert.strictEqual(paged.meta.totalPages, 2);
      assert.strictEqual(paged.meta.hasMore, true);
    });
  });
});
