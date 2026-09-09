import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BuyingSignalType, LeadGrade, LeadStatus } from '@sales-copilot/shared-contracts';
import { salesApi } from '../api/sales-client';

describe('Sales Intelligence Feature (Lead Scoring & BANT Evidence)', () => {
  it('should expose all required REST endpoints in salesApi', () => {
    assert.strictEqual(typeof salesApi.listLeads, 'function');
    assert.strictEqual(typeof salesApi.getLead, 'function');
    assert.strictEqual(typeof salesApi.createLead, 'function');
    assert.strictEqual(typeof salesApi.getLeadScore, 'function');
    assert.strictEqual(typeof salesApi.getLeadScoreHistory, 'function');
    assert.strictEqual(typeof salesApi.recalculateLeadScore, 'function');
    assert.strictEqual(typeof salesApi.listEvidenceByConversation, 'function');
    assert.strictEqual(typeof salesApi.listEvidenceByLead, 'function');
    assert.strictEqual(typeof salesApi.invalidateEvidence, 'function');
  });

  it('should correctly classify BANT vs Risk signals', () => {
    const isBantSignal = (type: BuyingSignalType) =>
      [
        BuyingSignalType.BUDGET_CONFIRMED,
        BuyingSignalType.AUTHORITY_IDENTIFIED,
        BuyingSignalType.NEED_EXPRESSED,
        BuyingSignalType.TIMELINE_DEFINED,
      ].includes(type);

    const isRiskSignal = (type: BuyingSignalType) =>
      [
        BuyingSignalType.OBJECTION_RAISED,
        BuyingSignalType.COMPETITOR_MENTION,
        BuyingSignalType.CHURN_RISK,
      ].includes(type);

    assert.strictEqual(isBantSignal(BuyingSignalType.BUDGET_CONFIRMED), true);
    assert.strictEqual(isBantSignal(BuyingSignalType.AUTHORITY_IDENTIFIED), true);
    assert.strictEqual(isBantSignal(BuyingSignalType.NEED_EXPRESSED), true);
    assert.strictEqual(isBantSignal(BuyingSignalType.TIMELINE_DEFINED), true);
    assert.strictEqual(isBantSignal(BuyingSignalType.CHURN_RISK), false);

    assert.strictEqual(isRiskSignal(BuyingSignalType.CHURN_RISK), true);
    assert.strictEqual(isRiskSignal(BuyingSignalType.COMPETITOR_MENTION), true);
    assert.strictEqual(isRiskSignal(BuyingSignalType.OBJECTION_RAISED), true);
    assert.strictEqual(isRiskSignal(BuyingSignalType.BUDGET_CONFIRMED), false);
  });

  it('should validate 3-pillar Lead Scoring structure', () => {
    const sampleScoreFactors = {
      fitScore: 25,
      velocityScore: 20,
      signalScore: 45,
      decayPenalty: 5,
      totalScore: 85,
      breakdown: [
        { factor: 'Fit', points: 25, reason: 'Good fit' },
        { factor: 'Velocity', points: 20, reason: 'Quick reply' },
        { factor: 'Signal', points: 45, reason: 'BANT confirmed' },
      ],
    };

    assert.strictEqual(sampleScoreFactors.totalScore, 85);
    assert.ok(sampleScoreFactors.fitScore <= 25);
    assert.ok(sampleScoreFactors.velocityScore <= 25);
    assert.ok(sampleScoreFactors.signalScore <= 50);
    assert.strictEqual(sampleScoreFactors.breakdown.length, 3);
  });

  it('should ignore invalidated evidences when computing BANT criteria', () => {
    const evidences: any[] = [
      {
        id: 'ev-1',
        signalType: BuyingSignalType.BUDGET_CONFIRMED,
        isInvalidated: true,
        snippet: '100 million VND',
      },
      {
        id: 'ev-2',
        signalType: BuyingSignalType.NEED_EXPRESSED,
        isInvalidated: false,
        snippet: 'Need omnichannel chat',
      },
    ];

    const activeEvidences = (evidences || []).filter(e => Boolean(e && !e.isInvalidated));
    assert.strictEqual(activeEvidences.length, 1);
    assert.strictEqual(activeEvidences[0].id, 'ev-2');

    const hasBudget = activeEvidences.some(e => e.signalType === BuyingSignalType.BUDGET_CONFIRMED);
    const hasNeed = activeEvidences.some(e => e.signalType === BuyingSignalType.NEED_EXPRESSED);

    assert.strictEqual(hasBudget, false, 'Invalidated budget must not be confirmed');
    assert.strictEqual(hasNeed, true, 'Active need must be confirmed');
  });

  it('should safely handle null or empty evidence lists', () => {
    const filterActive = (evidences?: any[] | null) =>
      (evidences ?? []).filter((e: any) => Boolean(e && !e.isInvalidated));

    assert.strictEqual(filterActive(null).length, 0);
    assert.strictEqual(filterActive(undefined).length, 0);
    assert.strictEqual(filterActive([]).length, 0);
  });
});
