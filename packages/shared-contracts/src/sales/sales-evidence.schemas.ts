import { z } from 'zod';
import { buyingSignalTypeSchema } from './enums';

// ============================================================================
// 1. Create Sales Evidence DTO Schema
// ============================================================================

export const createSalesEvidenceSchema = z.object({
  leadId: z.string().uuid('Invalid leadId format').optional().nullable(),
  conversationId: z.string().uuid('Invalid conversationId format'),
  messageId: z.string().optional().nullable(),
  signalType: buyingSignalTypeSchema,
  signalCategory: z.string().trim().optional().nullable(),
  confidence: z
    .number({ required_error: 'Confidence is required' })
    .min(0.0, 'Confidence must be between 0.0 and 1.0')
    .max(1.0, 'Confidence must be between 0.0 and 1.0'),
  snippet: z.string().min(1, 'Snippet is required'),
  reason: z.string().min(1, 'Reason is required'),
  metadata: z.record(z.unknown()).optional().default({}),
});

export type CreateSalesEvidenceDto = z.input<typeof createSalesEvidenceSchema>;
export type CreateSalesEvidenceOutput = z.output<typeof createSalesEvidenceSchema>;

// ============================================================================
// 2. Sales Evidence Response DTO Schema
// ============================================================================

export const salesEvidenceResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string(),
  leadId: z.string().uuid().nullable(),
  conversationId: z.string().uuid(),
  messageId: z.string().nullable(),
  signalType: buyingSignalTypeSchema,
  signalCategory: z.string().nullable(),
  confidence: z.number(),
  snippet: z.string(),
  reason: z.string(),
  metadata: z.record(z.unknown()),
  isInvalidated: z.boolean(),
  invalidationReason: z.string().nullable(),
  invalidatedByUserId: z.string().nullable(),
  invalidatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type SalesEvidenceResponseDto = z.infer<typeof salesEvidenceResponseSchema>;

// ============================================================================
// 3. Query Schemas
// ============================================================================

export const listLeadEvidenceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  signalType: buyingSignalTypeSchema.optional(),
  minConfidence: z.coerce.number().min(0.0).max(1.0).optional(),
  includeInvalidated: z.coerce.boolean().optional().default(false),
});

export type ListLeadEvidenceQueryDto = z.input<typeof listLeadEvidenceQuerySchema>;
export type ListLeadEvidenceQueryOutput = z.output<typeof listLeadEvidenceQuerySchema>;

// ============================================================================
// 4. Invalidation Schema
// ============================================================================

export const invalidateSalesEvidenceSchema = z.object({
  invalidationReason: z.string().min(1, 'invalidationReason is required'),
});

export type InvalidateSalesEvidenceDto = z.infer<typeof invalidateSalesEvidenceSchema>;
