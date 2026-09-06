import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BuyingSignalType, LeadGrade } from '@sales-copilot/shared-contracts';
import { LeadScoringCalculator } from '../lead-scoring.calculator';

describe('LeadScoringCalculator (Deterministic Scoring & Classification)', () => {
  // ==========================================================================
  // US-2.5.1 Acceptance Criteria 1 & 2: Composite Formulation
  // ==========================================================================
  describe('US-2.5.1 Scenario: Comprehensive High-Value Lead (HOT Grade)', () => {
    it('should compute score 95 and grade HOT for corporate email, phone, fast reply and high buying signals', () => {
      const now = new Date('2026-09-07T12:00:00Z');
      const result = LeadScoringCalculator.calculate({
        email: 'ceo@acmecorp.vn', // Corporate: +15
        phoneNumber: '+84987654321', // Valid phone: +10 -> fit = 25 (max)
        hasOrganizationOrTitle: true, // +5 (fit still capped at 25)
        customerResponseTimeMs: 90 * 1000, // 1.5 minutes (<= 2m): +20 -> vel = 20
        customerMessageCount: 1, // +1 -> vel = 21
        signals: [
          { signalType: BuyingSignalType.NEED_EXPRESSED, reason: 'Nhu cầu mở rộng hệ thống' }, // +30
          { signalType: BuyingSignalType.BUDGET_CONFIRMED, reason: 'Ngân sách 500 triệu' }, // +25 -> sig = 50 (max 50)
        ],
        lastActivityAt: new Date('2026-09-07T11:58:00Z'), // Active recently -> decay = 0
        createdAt: new Date('2026-09-07T10:00:00Z'),
        now,
      });

      assert.strictEqual(result.fitScore, 25);
      assert.strictEqual(result.velocityScore, 21);
      assert.strictEqual(result.signalScore, 50);
      assert.strictEqual(result.decayPenalty, 0);
      // Raw: 25 + 21 + 50 = 96, capped at 96 <= 100
      assert.strictEqual(result.totalScore, 96);
      assert.strictEqual(result.grade, LeadGrade.HOT);
      assert.ok(result.breakdown.length >= 4);
    });

    it('should match US-2.5.1 baseline calculation (fit 25, vel 20, sig 50 = 95 HOT)', () => {
      const result = LeadScoringCalculator.calculate({
        email: 'director@enterprise.com', // +15
        phoneNumber: '0901234567', // +10 -> fit = 25
        customerResponseTimeMs: 110 * 1000, // <= 2m: +20 -> vel = 20
        signals: [
          { signalType: BuyingSignalType.NEED_EXPRESSED }, // +30
          { signalType: BuyingSignalType.BUDGET_CONFIRMED }, // +25 -> 55 -> sig = 50
        ],
        lastActivityAt: new Date(),
        now: new Date(),
      });

      assert.strictEqual(result.fitScore, 25);
      assert.strictEqual(result.velocityScore, 20);
      assert.strictEqual(result.signalScore, 50);
      assert.strictEqual(result.decayPenalty, 0);
      assert.strictEqual(result.totalScore, 95);
      assert.strictEqual(result.grade, LeadGrade.HOT);
    });
  });

  // ==========================================================================
  // Dimension 1: Profile Fit (S_fit, Max 25)
  // ==========================================================================
  describe('Profile Fit Scoring (Max 25)', () => {
    it('should grant 15 points for corporate email and 5 for freemail', () => {
      const corporate = LeadScoringCalculator.calculate({ email: 'contact@acme.ai' });
      const freemail = LeadScoringCalculator.calculate({ email: 'john.doe@gmail.com' });
      const yahoo = LeadScoringCalculator.calculate({ email: 'client@yahoo.com.vn' });
      const empty = LeadScoringCalculator.calculate({ email: '' });

      assert.strictEqual(corporate.fitScore, 15);
      assert.strictEqual(freemail.fitScore, 5);
      assert.strictEqual(yahoo.fitScore, 5);
      assert.strictEqual(empty.fitScore, 0);
    });

    it('should grant 10 points for valid phone number (>= 8 digits)', () => {
      const valid = LeadScoringCalculator.calculate({ phoneNumber: '0912345678' });
      const short = LeadScoringCalculator.calculate({ phoneNumber: '1234' });

      assert.strictEqual(valid.fitScore, 10);
      assert.strictEqual(short.fitScore, 0);
    });

    it('should grant 5 points for organization or title', () => {
      const withOrg = LeadScoringCalculator.calculate({ hasOrganizationOrTitle: true });
      assert.strictEqual(withOrg.fitScore, 5);
    });

    it('should cap fitScore at 25 points even when all criteria are met', () => {
      const all = LeadScoringCalculator.calculate({
        email: 'founder@techcorp.io', // 15
        phoneNumber: '+84988776655', // 10
        hasOrganizationOrTitle: true, // 5 -> raw = 30
      });

      assert.strictEqual(all.fitScore, 25);
    });
  });

  // ==========================================================================
  // Dimension 2: Engagement Velocity (S_vel, Max 25)
  // ==========================================================================
  describe('Engagement Velocity Scoring (Max 25)', () => {
    it('should correctly score response time tiers', () => {
      const under2m = LeadScoringCalculator.calculate({ customerResponseTimeMs: 60 * 1000 });
      const under5m = LeadScoringCalculator.calculate({ customerResponseTimeMs: 4 * 60 * 1000 });
      const under30m = LeadScoringCalculator.calculate({ customerResponseTimeMs: 25 * 60 * 1000 });
      const under24h = LeadScoringCalculator.calculate({
        customerResponseTimeMs: 12 * 3600 * 1000,
      });
      const over24h = LeadScoringCalculator.calculate({ customerResponseTimeMs: 30 * 3600 * 1000 });

      assert.strictEqual(under2m.velocityScore, 20);
      assert.strictEqual(under5m.velocityScore, 15);
      assert.strictEqual(under30m.velocityScore, 10);
      assert.strictEqual(under24h.velocityScore, 5);
      assert.strictEqual(over24h.velocityScore, 0);
    });

    it('should correctly score customer message counts', () => {
      const fiveMsgs = LeadScoringCalculator.calculate({ customerMessageCount: 6 });
      const threeMsgs = LeadScoringCalculator.calculate({ customerMessageCount: 3 });
      const oneMsg = LeadScoringCalculator.calculate({ customerMessageCount: 1 });
      const zeroMsgs = LeadScoringCalculator.calculate({ customerMessageCount: 0 });

      assert.strictEqual(fiveMsgs.velocityScore, 5);
      assert.strictEqual(threeMsgs.velocityScore, 3);
      assert.strictEqual(oneMsg.velocityScore, 1);
      assert.strictEqual(zeroMsgs.velocityScore, 0);
    });

    it('should cap velocityScore at 25 points', () => {
      const fastAndFrequent = LeadScoringCalculator.calculate({
        customerResponseTimeMs: 50 * 1000, // +20
        customerMessageCount: 10, // +5 -> 25
      });
      assert.strictEqual(fastAndFrequent.velocityScore, 25);
    });
  });

  // ==========================================================================
  // Dimension 3: Sales Signals (S_sig, Max 50)
  // ==========================================================================
  describe('Sales Signals Scoring (Max 50)', () => {
    it('should cap positive signals at 50 points', () => {
      const signals = [
        { signalType: BuyingSignalType.NEED_EXPRESSED }, // 30
        { signalType: BuyingSignalType.TIMELINE_DEFINED }, // 25
        { signalType: BuyingSignalType.AUTHORITY_IDENTIFIED }, // 20 -> 75
      ];
      const result = LeadScoringCalculator.calculate({ signals });
      assert.strictEqual(result.signalScore, 50);
    });

    it('should penalize negative signals and objections', () => {
      const signals = [
        { signalType: BuyingSignalType.NEED_EXPRESSED }, // +30
        { signalType: BuyingSignalType.OBJECTION_RAISED }, // -15
      ];
      const result = LeadScoringCalculator.calculate({ signals });
      // 30 - 15 = 15
      assert.strictEqual(result.signalScore, 15);
    });

    it('should not allow signalScore to fall below 0', () => {
      const signals = [
        { signalType: BuyingSignalType.CHURN_RISK }, // -40
        { signalType: BuyingSignalType.COMPETITOR_MENTION }, // -20
      ];
      const result = LeadScoringCalculator.calculate({ signals });
      assert.strictEqual(result.signalScore, 0);
    });

    it('should deduplicate repeated signal types', () => {
      const signals = [
        { signalType: BuyingSignalType.NEED_EXPRESSED },
        { signalType: BuyingSignalType.NEED_EXPRESSED },
        { signalType: BuyingSignalType.NEED_EXPRESSED },
      ];
      const result = LeadScoringCalculator.calculate({ signals });
      assert.strictEqual(result.signalScore, 30);
    });
  });

  // ==========================================================================
  // Dimension 4: Inactivity Decay D(t)
  // ==========================================================================
  describe('Inactivity Time-Decay (D(t))', () => {
    const baselineNow = new Date('2026-09-07T12:00:00Z');

    it('should apply 0 penalty if inactivity is <= 48 hours', () => {
      const activity47h = new Date(baselineNow.getTime() - 47 * 3600 * 1000);
      const activity48h = new Date(baselineNow.getTime() - 48 * 3600 * 1000);

      const res47 = LeadScoringCalculator.calculate({
        email: 'pro@corp.com',
        lastActivityAt: activity47h,
        now: baselineNow,
      });
      const res48 = LeadScoringCalculator.calculate({
        email: 'pro@corp.com',
        lastActivityAt: activity48h,
        now: baselineNow,
      });

      assert.strictEqual(res47.decayPenalty, 0);
      assert.strictEqual(res48.decayPenalty, 0);
    });

    it('should deduct 5 points at 72h (48h + 24h)', () => {
      const activity72h = new Date(baselineNow.getTime() - 72 * 3600 * 1000);
      const res72 = LeadScoringCalculator.calculate({
        email: 'pro@corp.com', // 15
        lastActivityAt: activity72h,
        now: baselineNow,
      });

      assert.strictEqual(res72.decayPenalty, 5);
      assert.strictEqual(res72.totalScore, 10); // 15 - 5 = 10
    });

    it('should deduct 10 points at 96h (48h + 48h)', () => {
      const activity96h = new Date(baselineNow.getTime() - 96 * 3600 * 1000);
      const res96 = LeadScoringCalculator.calculate({
        email: 'pro@corp.com', // 15
        lastActivityAt: activity96h,
        now: baselineNow,
      });

      assert.strictEqual(res96.decayPenalty, 10);
      assert.strictEqual(res96.totalScore, 5); // 15 - 10 = 5
    });

    it('should cap decay penalty at 50 points even after prolonged dormancy', () => {
      const dormant180Days = new Date(baselineNow.getTime() - 180 * 24 * 3600 * 1000);
      const resDormant = LeadScoringCalculator.calculate({
        email: 'pro@corp.com',
        signals: [{ signalType: BuyingSignalType.NEED_EXPRESSED }], // 15 + 30 = 45
        lastActivityAt: dormant180Days,
        now: baselineNow,
      });

      assert.strictEqual(resDormant.decayPenalty, 50);
      assert.strictEqual(resDormant.totalScore, 0); // 45 - 50 = max(0, -5) = 0
    });
  });

  // ==========================================================================
  // Boundary Values & Classification
  // ==========================================================================
  describe('Boundary Clamping & LeadGrade Classification', () => {
    it('should clamp score strictly between 0 and 100', () => {
      const now = new Date('2026-09-07T12:00:00Z');
      const negativeResult = LeadScoringCalculator.calculate({
        email: 'test@gmail.com', // 5
        lastActivityAt: new Date(now.getTime() - 96 * 3600 * 1000), // 96h inactivity -> decay = 10 (5 - 10 = -5 -> clamp to 0)
        now,
      });
      assert.strictEqual(negativeResult.totalScore, 0);
      assert.strictEqual(negativeResult.grade, LeadGrade.JUNK);

      const highResult = LeadScoringCalculator.calculate({
        email: 'exec@firm.com', // 15
        phoneNumber: '0912345678', // 10
        hasOrganizationOrTitle: true, // 5 -> fit = 25
        customerResponseTimeMs: 60 * 1000, // 20
        customerMessageCount: 10, // 5 -> vel = 25
        signals: [
          { signalType: BuyingSignalType.NEED_EXPRESSED }, // 30
          { signalType: BuyingSignalType.BUDGET_CONFIRMED }, // 25 -> sig = 50
        ],
      });
      // 25 + 25 + 50 = 100
      assert.strictEqual(highResult.totalScore, 100);
      assert.strictEqual(highResult.grade, LeadGrade.HOT);
    });

    it('should properly classify HOT, WARM, COLD, JUNK thresholds', () => {
      // 80 -> HOT
      const hot = LeadScoringCalculator.calculate({
        email: 'ceo@bigcorp.com', // 15
        phoneNumber: '0988776655', // 10
        customerResponseTimeMs: 60 * 1000, // 20
        signals: [{ signalType: BuyingSignalType.NEED_EXPRESSED }], // 30 -> 15+10+20+30 = 75 + 5 (msg) = 80
        customerMessageCount: 5, // 5 -> vel = 25 -> 25+25+30 = 80
      });
      assert.strictEqual(hot.totalScore, 80);
      assert.strictEqual(hot.grade, LeadGrade.HOT);

      // 50 -> WARM
      const warm = LeadScoringCalculator.calculate({
        email: 'user@company.com', // 15
        phoneNumber: '0988776655', // 10 -> fit = 25
        signals: [{ signalType: BuyingSignalType.TIMELINE_DEFINED }], // 25 -> sig = 25 -> 50
      });
      assert.strictEqual(warm.totalScore, 50);
      assert.strictEqual(warm.grade, LeadGrade.WARM);

      // 20 -> COLD
      const cold = LeadScoringCalculator.calculate({
        email: 'contact@acme.org', // 15
        customerMessageCount: 5, // 5 -> vel = 5 -> 20
      });
      assert.strictEqual(cold.totalScore, 20);
      assert.strictEqual(cold.grade, LeadGrade.COLD);

      // 19 -> JUNK
      const junk = LeadScoringCalculator.calculate({
        email: 'contact@acme.org', // 15
        customerMessageCount: 2, // 3 -> vel = 3 -> 18
        customerResponseTimeMs: null,
      });
      assert.strictEqual(junk.totalScore, 18);
      assert.strictEqual(junk.grade, LeadGrade.JUNK);
    });
  });
});
