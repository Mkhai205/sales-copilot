import { z } from 'zod';

export const auditLogListQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  action: z.string().optional(),
  actorId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z
    .string()
    .datetime({ message: 'startDate must be a valid ISO-8601 string' })
    .optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO-8601 string' }).optional(),
});
export type AuditLogListQueryDto = z.input<typeof auditLogListQuerySchema>;

export interface AuditLogUserSummaryDto {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface AuditLogDto {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  payload: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
  user?: AuditLogUserSummaryDto | null;
}
