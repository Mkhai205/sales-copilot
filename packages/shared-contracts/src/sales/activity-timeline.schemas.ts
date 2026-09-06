import { z } from 'zod';
import { timelineEventTypeSchema } from './enums';

// ============================================================================
// 1. Timeline Actor Schema
// ============================================================================

export const timelineActorSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['CONTACT', 'USER', 'SYSTEM']),
  avatarUrl: z.string().nullable().optional(),
});

export type TimelineActorDto = z.infer<typeof timelineActorSchema>;

// ============================================================================
// 2. Timeline Event Schema
// ============================================================================

export const timelineEventSchema = z.object({
  id: z.string(),
  type: timelineEventTypeSchema,
  timestamp: z.string(), // ISO 8601 format
  actor: timelineActorSchema,
  summary: z.string(),
  payload: z.record(z.unknown()).default({}),
});

export type TimelineEventDto = z.infer<typeof timelineEventSchema>;

// ============================================================================
// 3. Timeline Query Schema
// ============================================================================

export const timelineQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
  types: z
    .preprocess(val => {
      if (typeof val === 'string') {
        return val.split(',').map(s => s.trim().toUpperCase());
      }
      return val;
    }, z.array(timelineEventTypeSchema))
    .optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

export type TimelineQueryDto = z.input<typeof timelineQuerySchema>;
export type TimelineQueryOutput = z.output<typeof timelineQuerySchema>;

// ============================================================================
// 4. Timeline Response Schema
// ============================================================================

export const timelineResponseSchema = z.object({
  items: z.array(timelineEventSchema),
  meta: z.object({
    limit: z.number(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
});

export type TimelineResponseDto = z.infer<typeof timelineResponseSchema>;
