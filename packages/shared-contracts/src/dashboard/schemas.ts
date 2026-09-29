import { z } from 'zod';

export const dashboardSummarySchema = z.object({
  date: z.string(),
  timezone: z.string(),
  orders: z.object({
    totalOrdersToday: z.number(),
    totalRevenueToday: z.number(),
    paidRevenueToday: z.number(),
  }),
  conversations: z.object({
    newConversationsToday: z.number(),
  }),
  contacts: z.object({
    newContactsToday: z.number(),
  }),
  aiCopilot: z.object({
    isActive: z.boolean(),
    enabledInboxesCount: z.number(),
    totalInboxesCount: z.number(),
    handledConversationsToday: z.number(),
  }),
});

export type DashboardSummaryDto = z.infer<typeof dashboardSummarySchema>;
