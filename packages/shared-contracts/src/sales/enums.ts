import { z } from 'zod';

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  ENGAGED = 'ENGAGED',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
  DISQUALIFIED = 'DISQUALIFIED',
}

export const leadStatusSchema = z.nativeEnum(LeadStatus);

export enum LeadStage {
  DISCOVERY = 'DISCOVERY',
  EVALUATION = 'EVALUATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export const leadStageSchema = z.nativeEnum(LeadStage);

export enum LeadGrade {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
  JUNK = 'JUNK',
}

export const leadGradeSchema = z.nativeEnum(LeadGrade);

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  CLOSED_WON = 'CLOSED_WON',
  CLOSED_LOST = 'CLOSED_LOST',
}

export const opportunityStageSchema = z.nativeEnum(OpportunityStage);

export const STAGE_DEFAULT_PROBABILITIES: Record<OpportunityStage, number> = {
  [OpportunityStage.PROSPECTING]: 10,
  [OpportunityStage.QUALIFICATION]: 25,
  [OpportunityStage.PROPOSAL]: 50,
  [OpportunityStage.NEGOTIATION]: 80,
  [OpportunityStage.CLOSED_WON]: 100,
  [OpportunityStage.CLOSED_LOST]: 0,
};

/**
 * Computes categorical LeadGrade from composite LeadScore (0 - 100).
 * - >= 80: HOT (Immediate agent priority)
 * - 50 - 79: WARM (Active nurture candidate)
 * - 20 - 49: COLD (Automated cadence)
 * - < 20: JUNK (Unqualified / Spam)
 */
export function computeLeadGrade(score: number): LeadGrade {
  if (score >= 80) {
    return LeadGrade.HOT;
  }
  if (score >= 50) {
    return LeadGrade.WARM;
  }
  if (score >= 20) {
    return LeadGrade.COLD;
  }
  return LeadGrade.JUNK;
}

export enum BuyingSignalType {
  BUDGET_CONFIRMED = 'BUDGET_CONFIRMED',
  AUTHORITY_IDENTIFIED = 'AUTHORITY_IDENTIFIED',
  NEED_EXPRESSED = 'NEED_EXPRESSED',
  TIMELINE_DEFINED = 'TIMELINE_DEFINED',
  COMPETITOR_MENTION = 'COMPETITOR_MENTION',
  OBJECTION_RAISED = 'OBJECTION_RAISED',
  PURCHASE_INTENT = 'PURCHASE_INTENT',
  CHURN_RISK = 'CHURN_RISK',
  ENGAGEMENT_SPIKE = 'ENGAGEMENT_SPIKE',
  PAIN_POINT = 'PAIN_POINT',
  POSITIVE_SENTIMENT = 'POSITIVE_SENTIMENT',
}

export const buyingSignalTypeSchema = z.preprocess(
  val => (val === 'TIMELINE_STATED' ? BuyingSignalType.TIMELINE_DEFINED : val),
  z.nativeEnum(BuyingSignalType),
);

export enum TimelineEventType {
  MESSAGE = 'MESSAGE',
  SALES_EVIDENCE = 'SALES_EVIDENCE',
  STATUS_CHANGE = 'STATUS_CHANGE',
  ASSIGNMENT = 'ASSIGNMENT',
  NOTE = 'NOTE',
}

export const timelineEventTypeSchema = z.nativeEnum(TimelineEventType);

export enum ScoreTriggerEvent {
  INITIAL_CALCULATION = 'INITIAL_CALCULATION',
  MESSAGE_RECEIVED = 'MESSAGE_RECEIVED',
  EVIDENCE_DETECTED = 'EVIDENCE_DETECTED',
  EVIDENCE_INVALIDATED = 'EVIDENCE_INVALIDATED',
  STAGE_CHANGED = 'STAGE_CHANGED',
  MANUAL_RECALCULATION = 'MANUAL_RECALCULATION',
  TIME_DECAY = 'TIME_DECAY',
}

export const scoreTriggerEventSchema = z.nativeEnum(ScoreTriggerEvent);
