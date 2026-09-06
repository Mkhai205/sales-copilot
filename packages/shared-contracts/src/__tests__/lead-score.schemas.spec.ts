import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  LeadGrade,
  ScoreTriggerEvent,
  scoreTriggerEventSchema,
  scoreFactorBreakdownSchema,
  leadScoreFactorsSchema,
  leadScoreResponseSchema,
  leadScoreHistoryItemSchema,
  listLeadScoreHistoryQuerySchema,
  recalculateScoreSchema,
  LEAD_SCORING_QUEUE,
  RECALCULATE_LEAD_SCORE_JOB,
  leadScoreUpdatedEventPayloadSchema,
} from '../index';

describe('Lead Scoring Shared Contracts & Schemas', () => {
  describe('ScoreTriggerEvent Enum & Schema', () => {
    it('should validate all defined trigger events', () => {
      const triggers = [
        ScoreTriggerEvent.INITIAL_CALCULATION,
        ScoreTriggerEvent.MESSAGE_RECEIVED,
        ScoreTriggerEvent.EVIDENCE_DETECTED,
        ScoreTriggerEvent.EVIDENCE_INVALIDATED,
        ScoreTriggerEvent.STAGE_CHANGED,
        ScoreTriggerEvent.MANUAL_RECALCULATION,
        ScoreTriggerEvent.TIME_DECAY,
      ];

      for (const trigger of triggers) {
        assert.strictEqual(scoreTriggerEventSchema.parse(trigger), trigger);
      }
    });

    it('should reject invalid trigger event', () => {
      assert.throws(() => {
        scoreTriggerEventSchema.parse('INVALID_TRIGGER');
      });
    });
  });

  describe('scoreFactorBreakdownSchema', () => {
    it('should validate valid factor breakdown', () => {
      const parsed = scoreFactorBreakdownSchema.parse({
        factor: 'FIT_CORPORATE_EMAIL',
        points: 15,
        reason: 'Email doanh nghiệp',
      });
      assert.strictEqual(parsed.factor, 'FIT_CORPORATE_EMAIL');
      assert.strictEqual(parsed.points, 15);
      assert.strictEqual(parsed.reason, 'Email doanh nghiệp');
    });

    it('should allow negative points (e.g. for decay or objection)', () => {
      const parsed = scoreFactorBreakdownSchema.parse({
        factor: 'DECAY_INACTIVITY',
        points: -10,
        reason: 'Hao mòn điểm số 48h',
      });
      assert.strictEqual(parsed.points, -10);
    });
  });

  describe('leadScoreFactorsSchema', () => {
    it('should parse valid factors object within boundary bounds', () => {
      const parsed = leadScoreFactorsSchema.parse({
        fitScore: 25,
        velocityScore: 20,
        signalScore: 50,
        decayPenalty: 5,
        totalScore: 90,
        breakdown: [
          { factor: 'FIT_EMAIL', points: 15, reason: 'Corporate email' },
          { factor: 'FIT_PHONE', points: 10, reason: 'Valid phone' },
        ],
      });
      assert.strictEqual(parsed.fitScore, 25);
      assert.strictEqual(parsed.totalScore, 90);
      assert.strictEqual(parsed.breakdown.length, 2);
    });

    it('should reject out of bound fitScore (> 25)', () => {
      assert.throws(() => {
        leadScoreFactorsSchema.parse({
          fitScore: 30,
          velocityScore: 10,
          signalScore: 10,
          decayPenalty: 0,
          totalScore: 50,
          breakdown: [],
        });
      });
    });

    it('should reject out of bound totalScore (> 100 or < 0)', () => {
      assert.throws(() => {
        leadScoreFactorsSchema.parse({
          fitScore: 20,
          velocityScore: 10,
          signalScore: 10,
          decayPenalty: 0,
          totalScore: 105,
          breakdown: [],
        });
      });
    });
  });

  describe('leadScoreResponseSchema', () => {
    const validUuid = '11111111-1111-4111-8111-111111111111';

    it('should validate full lead score response payload', () => {
      const payload = {
        id: validUuid,
        workspaceId: validUuid,
        leadId: validUuid,
        score: 85,
        grade: LeadGrade.HOT,
        scoreFactors: {
          fitScore: 25,
          velocityScore: 20,
          signalScore: 40,
          decayPenalty: 0,
          totalScore: 85,
          breakdown: [],
        },
        calculatedAt: '2026-09-07T00:00:00.000Z',
        updatedAt: '2026-09-07T00:00:00.000Z',
      };

      const parsed = leadScoreResponseSchema.parse(payload);
      assert.strictEqual(parsed.score, 85);
      assert.strictEqual(parsed.grade, LeadGrade.HOT);
    });
  });

  describe('leadScoreHistoryItemSchema', () => {
    const validUuid = '11111111-1111-4111-8111-111111111111';

    it('should validate history item record', () => {
      const item = {
        id: validUuid,
        workspaceId: validUuid,
        leadId: validUuid,
        previousScore: 45,
        newScore: 75,
        delta: 30,
        previousGrade: LeadGrade.COLD,
        newGrade: LeadGrade.WARM,
        reason: 'Khách hàng gửi thêm thông tin ngân sách',
        eventTrigger: ScoreTriggerEvent.EVIDENCE_DETECTED,
        scoreFactors: {
          fitScore: 20,
          velocityScore: 15,
          signalScore: 40,
          decayPenalty: 0,
          totalScore: 75,
          breakdown: [],
        },
        createdAt: '2026-09-07T00:00:00.000Z',
      };

      const parsed = leadScoreHistoryItemSchema.parse(item);
      assert.strictEqual(parsed.delta, 30);
      assert.strictEqual(parsed.eventTrigger, ScoreTriggerEvent.EVIDENCE_DETECTED);
    });
  });

  describe('listLeadScoreHistoryQuerySchema', () => {
    it('should set default pagination values', () => {
      const parsed = listLeadScoreHistoryQuerySchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
    });

    it('should parse coerced number query params', () => {
      const parsed = listLeadScoreHistoryQuerySchema.parse({ page: '3', limit: '50' });
      assert.strictEqual(parsed.page, 3);
      assert.strictEqual(parsed.limit, 50);
    });
  });

  describe('recalculateScoreSchema', () => {
    it('should accept optional reason', () => {
      const parsed = recalculateScoreSchema.parse({ reason: 'Manual audit by agent' });
      assert.strictEqual(parsed.reason, 'Manual audit by agent');

      const empty = recalculateScoreSchema.parse({});
      assert.strictEqual(empty.reason, undefined);
    });
  });

  describe('Queue Constants & Realtime Event Schema', () => {
    it('should have exact queue and job names', () => {
      assert.strictEqual(LEAD_SCORING_QUEUE, 'ai-lead-scoring');
      assert.strictEqual(RECALCULATE_LEAD_SCORE_JOB, 'recalculate-lead-score');
    });

    it('should validate realtime lead score updated payload', () => {
      const validUuid = '11111111-1111-4111-8111-111111111111';
      const parsed = leadScoreUpdatedEventPayloadSchema.parse({
        workspaceId: validUuid,
        leadId: validUuid,
        score: 95,
        grade: LeadGrade.HOT,
        previousScore: 60,
        previousGrade: LeadGrade.WARM,
        scoreFactors: { totalScore: 95 },
        triggerReason: ScoreTriggerEvent.EVIDENCE_DETECTED,
      });

      assert.strictEqual(parsed.score, 95);
      assert.strictEqual(parsed.grade, LeadGrade.HOT);
    });
  });
});
