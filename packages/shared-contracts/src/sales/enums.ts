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
