import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LeadGrade, ScoreTriggerEvent } from '@sales-copilot/shared-contracts';
import { LeadScoringController } from '../lead-scoring.controller';

describe('LeadScoringController', () => {
  let controller: LeadScoringController;
  let mockService: any;
  let serviceCalls: Record<string, any>;

  const workspaceContext: any = {
    workspaceId: '11111111-1111-4111-8111-111111111111',
    role: 'ADMIN',
  };
  const leadId = 'lead-ctrl-001';

  beforeEach(() => {
    serviceCalls = {};

    mockService = {
      getScore: async (wsId: string, lId: string) => {
        serviceCalls.getScore = { wsId, lId };
        return {
          id: 'score-1',
          workspaceId: wsId,
          leadId: lId,
          score: 80,
          grade: LeadGrade.HOT,
          scoreFactors: { totalScore: 80 },
          calculatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
      getHistory: async (wsId: string, lId: string, query: any) => {
        serviceCalls.getHistory = { wsId, lId, query };
        return {
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false },
        };
      },
      recalculateScore: async (wsId: string, lId: string, trigger: any, reason?: string) => {
        serviceCalls.recalculateScore = { wsId, lId, trigger, reason };
        return {
          id: 'score-recalc',
          workspaceId: wsId,
          leadId: lId,
          score: 85,
          grade: LeadGrade.HOT,
          scoreFactors: { totalScore: 85 },
          calculatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      },
    };

    controller = new LeadScoringController(mockService);
  });

  it('should delegate getScore to service with context workspaceId', async () => {
    const result = await controller.getScore(workspaceContext, leadId);
    assert.strictEqual(serviceCalls.getScore.wsId, workspaceContext.workspaceId);
    assert.strictEqual(serviceCalls.getScore.lId, leadId);
    assert.strictEqual(result.score, 80);
    assert.strictEqual(result.grade, LeadGrade.HOT);
  });

  it('should delegate getHistory to service with query and pagination', async () => {
    const query = { page: 2, limit: 10 };
    const result = await controller.getHistory(workspaceContext, leadId, query);
    assert.strictEqual(serviceCalls.getHistory.wsId, workspaceContext.workspaceId);
    assert.strictEqual(serviceCalls.getHistory.lId, leadId);
    assert.deepStrictEqual(serviceCalls.getHistory.query, query);
    assert.strictEqual(result.meta.page, 1);
  });

  it('should delegate recalculateScore with MANUAL_RECALCULATION trigger and custom reason', async () => {
    const dto = { reason: 'Auditing lead after phone call' };
    const result = await controller.recalculateScore(workspaceContext, leadId, dto);
    assert.strictEqual(serviceCalls.recalculateScore.wsId, workspaceContext.workspaceId);
    assert.strictEqual(serviceCalls.recalculateScore.lId, leadId);
    assert.strictEqual(
      serviceCalls.recalculateScore.trigger,
      ScoreTriggerEvent.MANUAL_RECALCULATION,
    );
    assert.strictEqual(serviceCalls.recalculateScore.reason, 'Auditing lead after phone call');
    assert.strictEqual(result.score, 85);
  });
});
