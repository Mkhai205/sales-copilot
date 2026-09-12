import { z } from 'zod';
import { paginationParamsSchema } from '../common';
import { PlatformAuditAction, PlatformAuditTargetType } from './enums';

// ==========================================
// 1. Query Schemas
// ==========================================
export const queryPlatformAuditLogsSchema = paginationParamsSchema
  .extend({
    action: z.nativeEnum(PlatformAuditAction).optional(),
    targetType: z.nativeEnum(PlatformAuditTargetType).optional(),
    targetId: z.string().trim().optional(),
    actorEmail: z.string().trim().optional(),
    startDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().datetime())
      .or(
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date YYYY-MM-DD or ISO-8601 datetime'),
      )
      .optional(),
    endDate: z
      .string()
      .datetime({ offset: true })
      .or(z.string().datetime())
      .or(
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date YYYY-MM-DD or ISO-8601 datetime'),
      )
      .optional(),
  })
  .refine(
    data => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate).getTime() <= new Date(data.endDate).getTime();
      }
      return true;
    },
    {
      message: 'startDate must be before or equal to endDate',
      path: ['startDate'],
    },
  );

export type QueryPlatformAuditLogsDto = z.infer<typeof queryPlatformAuditLogsSchema>;

// ==========================================
// 2. Response DTOs
// ==========================================
export interface PlatformAuditLogDto {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
}
