import { z } from 'zod';

// ==========================================
// Platform Overview Metrics Schemas & DTOs
// ==========================================

export const systemServiceHealthStatusSchema = z.enum(['HEALTHY', 'DEGRADED', 'DOWN']);
export type SystemServiceHealthStatus = z.infer<typeof systemServiceHealthStatusSchema>;

export const platformSystemHealthSchema = z.object({
  postgres: systemServiceHealthStatusSchema,
  redis: systemServiceHealthStatusSchema,
  storage: systemServiceHealthStatusSchema.optional(),
});
export type PlatformSystemHealthDto = z.infer<typeof platformSystemHealthSchema>;

export const platformMetricsOverviewSchema = z.object({
  totalWorkspaces: z.number().int().nonnegative(),
  activeWorkspaces: z.number().int().nonnegative(),
  suspendedWorkspaces: z.number().int().nonnegative(),
  totalUsers: z.number().int().nonnegative(),
  systemHealth: platformSystemHealthSchema,
});
export type PlatformMetricsOverviewDto = z.infer<typeof platformMetricsOverviewSchema>;
