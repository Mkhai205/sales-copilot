import {
  BuyingSignalType,
  computeLeadGrade,
  LeadGrade,
  LeadScoreFactors,
  ScoreFactorBreakdown,
} from '@sales-copilot/shared-contracts';

export const FREEMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.com.vn',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'yandex.com',
  'gmx.com',
]);

export const SIGNAL_POINT_WEIGHTS: Record<BuyingSignalType, number> = {
  [BuyingSignalType.NEED_EXPRESSED]: 30,
  [BuyingSignalType.BUDGET_CONFIRMED]: 25,
  [BuyingSignalType.TIMELINE_DEFINED]: 25,
  [BuyingSignalType.AUTHORITY_IDENTIFIED]: 20,
  [BuyingSignalType.PURCHASE_INTENT]: 20,
  [BuyingSignalType.PAIN_POINT]: 15,
  [BuyingSignalType.POSITIVE_SENTIMENT]: 10,
  [BuyingSignalType.ENGAGEMENT_SPIKE]: 10,
  [BuyingSignalType.OBJECTION_RAISED]: -15,
  [BuyingSignalType.COMPETITOR_MENTION]: -20,
  [BuyingSignalType.CHURN_RISK]: -40,
};

export interface CalculatorSignalInput {
  signalType: BuyingSignalType;
  snippet?: string;
  reason?: string;
}

export interface LeadScoringCalculatorInput {
  email?: string | null;
  phoneNumber?: string | null;
  hasOrganizationOrTitle?: boolean;
  customerResponseTimeMs?: number | null;
  customerMessageCount?: number;
  signals?: CalculatorSignalInput[];
  lastActivityAt?: Date | string | null;
  createdAt?: Date | string;
  now?: Date;
}

export interface LeadScoringCalculationResult extends LeadScoreFactors {
  grade: LeadGrade;
}

export class LeadScoringCalculator {
  /**
   * Deterministic scoring calculation:
   * S(t) = min(100, max(0, S_fit + S_vel + S_sig - D(t)))
   */
  public static calculate(input: LeadScoringCalculatorInput): LeadScoringCalculationResult {
    const breakdown: ScoreFactorBreakdown[] = [];

    // ------------------------------------------------------------------------
    // 1. Profile Fit (Max 25 points)
    // ------------------------------------------------------------------------
    let rawFit = 0;

    if (input.email && input.email.includes('@')) {
      const domain = input.email.split('@')[1]?.toLowerCase().trim();
      if (domain && domain.includes('.')) {
        if (FREEMAIL_DOMAINS.has(domain)) {
          rawFit += 5;
          breakdown.push({
            factor: 'FIT_FREEMAIL',
            points: 5,
            reason: `Email thông thường (${input.email})`,
          });
        } else {
          rawFit += 15;
          breakdown.push({
            factor: 'FIT_CORPORATE_EMAIL',
            points: 15,
            reason: `Email doanh nghiệp (${input.email})`,
          });
        }
      }
    }

    if (input.phoneNumber && input.phoneNumber.trim().length >= 8) {
      rawFit += 10;
      breakdown.push({
        factor: 'FIT_PHONE_NUMBER',
        points: 10,
        reason: `Số điện thoại hợp lệ (${input.phoneNumber.trim()})`,
      });
    }

    if (input.hasOrganizationOrTitle) {
      rawFit += 5;
      breakdown.push({
        factor: 'FIT_ORGANIZATION_OR_TITLE',
        points: 5,
        reason: 'Có thông tin tổ chức, chức danh hoặc vị trí công tác',
      });
    }

    const fitScore = Math.min(25, rawFit);

    // ------------------------------------------------------------------------
    // 2. Engagement Velocity (Max 25 points)
    // ------------------------------------------------------------------------
    let rawVelocity = 0;

    if (
      input.customerResponseTimeMs !== null &&
      input.customerResponseTimeMs !== undefined &&
      input.customerResponseTimeMs > 0
    ) {
      const respMs = input.customerResponseTimeMs;
      if (respMs <= 2 * 60 * 1000) {
        rawVelocity += 20;
        breakdown.push({
          factor: 'VELOCITY_FAST_REPLY',
          points: 20,
          reason: 'Khách hàng phản hồi rất nhanh (≤ 2 phút)',
        });
      } else if (respMs <= 5 * 60 * 1000) {
        rawVelocity += 15;
        breakdown.push({
          factor: 'VELOCITY_QUICK_REPLY',
          points: 15,
          reason: 'Khách hàng phản hồi nhanh (≤ 5 phút)',
        });
      } else if (respMs <= 30 * 60 * 1000) {
        rawVelocity += 10;
        breakdown.push({
          factor: 'VELOCITY_MODERATE_REPLY',
          points: 10,
          reason: 'Khách hàng phản hồi tích cực (≤ 30 phút)',
        });
      } else if (respMs <= 24 * 3600 * 1000) {
        rawVelocity += 5;
        breakdown.push({
          factor: 'VELOCITY_DAY_REPLY',
          points: 5,
          reason: 'Khách hàng phản hồi trong ngày (≤ 24 giờ)',
        });
      }
    }

    const msgCount = input.customerMessageCount ?? 0;
    if (msgCount >= 5) {
      rawVelocity += 5;
      breakdown.push({
        factor: 'VELOCITY_MESSAGES_HIGH',
        points: 5,
        reason: `Mức độ tương tác cao (${msgCount} tin nhắn từ khách hàng)`,
      });
    } else if (msgCount >= 2) {
      rawVelocity += 3;
      breakdown.push({
        factor: 'VELOCITY_MESSAGES_MEDIUM',
        points: 3,
        reason: `Mức độ tương tác trung bình (${msgCount} tin nhắn từ khách hàng)`,
      });
    } else if (msgCount === 1) {
      rawVelocity += 1;
      breakdown.push({
        factor: 'VELOCITY_MESSAGES_LOW',
        points: 1,
        reason: 'Bắt đầu tương tác (1 tin nhắn từ khách hàng)',
      });
    }

    const velocityScore = Math.min(25, rawVelocity);

    // ------------------------------------------------------------------------
    // 3. Sales Signals (Max 50 points)
    // ------------------------------------------------------------------------
    // Deduplicate signals by signalType to avoid artificial score bloating
    const uniqueSignals = new Map<BuyingSignalType, CalculatorSignalInput>();
    if (input.signals && input.signals.length > 0) {
      for (const sig of input.signals) {
        if (!uniqueSignals.has(sig.signalType)) {
          uniqueSignals.set(sig.signalType, sig);
        }
      }
    }

    let rawPositiveSignals = 0;
    let negativeSignalsPenalty = 0;

    for (const [signalType, sig] of uniqueSignals.entries()) {
      const weight = SIGNAL_POINT_WEIGHTS[signalType] ?? 0;
      if (weight > 0) {
        rawPositiveSignals += weight;
        breakdown.push({
          factor: `SIGNAL_${signalType}`,
          points: weight,
          reason: sig.reason || `Phát hiện tín hiệu mua hàng tích cực: ${signalType}`,
        });
      } else if (weight < 0) {
        const absPoints = Math.abs(weight);
        negativeSignalsPenalty += absPoints;
        breakdown.push({
          factor: `SIGNAL_${signalType}`,
          points: weight,
          reason: sig.reason || `Phát hiện rủi ro / phản đối: ${signalType} (-${absPoints} điểm)`,
        });
      }
    }

    const cappedPositive = Math.min(50, rawPositiveSignals);
    const signalScore = Math.max(0, cappedPositive - negativeSignalsPenalty);

    // ------------------------------------------------------------------------
    // 4. Inactivity Decay (D(t))
    // ------------------------------------------------------------------------
    const now = input.now ? input.now.getTime() : Date.now();
    const lastTime = input.lastActivityAt
      ? new Date(input.lastActivityAt).getTime()
      : input.createdAt
        ? new Date(input.createdAt).getTime()
        : now;

    const deltaMs = Math.max(0, now - lastTime);
    const fortyEightHoursMs = 48 * 3600 * 1000;
    const twentyFourHoursMs = 24 * 3600 * 1000;

    let decayPenalty = 0;
    if (deltaMs > fortyEightHoursMs) {
      const periods = Math.floor((deltaMs - fortyEightHoursMs) / twentyFourHoursMs);
      decayPenalty = Math.min(50, Math.max(0, periods * 5));
      if (decayPenalty > 0) {
        const hoursInactive = Math.floor(deltaMs / (3600 * 1000));
        breakdown.push({
          factor: 'DECAY_INACTIVITY',
          points: -decayPenalty,
          reason: `Hao mòn điểm do không có tương tác sau ${hoursInactive} giờ (-${decayPenalty} điểm)`,
        });
      }
    }

    // ------------------------------------------------------------------------
    // 5. Total Score & Lead Grade Classification
    // ------------------------------------------------------------------------
    const rawTotal = fitScore + velocityScore + signalScore - decayPenalty;
    const totalScore = Math.min(100, Math.max(0, rawTotal));
    const grade = computeLeadGrade(totalScore);

    return {
      fitScore,
      velocityScore,
      signalScore,
      decayPenalty,
      totalScore,
      breakdown,
      grade,
    };
  }
}
