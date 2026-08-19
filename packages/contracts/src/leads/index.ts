import { z } from 'zod';
import { LeadStatus } from '@sales-copilot/shared';

export const createLeadSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1),
  value: z.number().nonnegative().optional(),
  status: z.nativeEnum(LeadStatus).default(LeadStatus.NEW),
  customAttributes: z.record(z.unknown()).optional(),
});
export type CreateLeadDto = z.infer<typeof createLeadSchema>;

export const updateLeadScoreSchema = z.object({
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  signals: z.array(z.string()).optional(),
});
export type UpdateLeadScoreDto = z.infer<typeof updateLeadScoreSchema>;

export interface LeadIntelligenceDto {
  id: string;
  leadId: string;
  score: number;
  confidence: number;
  intent: string;
  sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  keySignals: string[];
  suggestedAction?: string;
  lastEvaluatedAt: string;
}

export interface LeadResponseDto {
  id: string;
  contactId: string;
  title: string;
  value?: number;
  status: LeadStatus;
  intelligence?: LeadIntelligenceDto;
  customAttributes: Record<string, unknown>;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
