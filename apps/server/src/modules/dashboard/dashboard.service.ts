import { Injectable, Logger } from '@nestjs/common';
import type { DashboardSummaryDto } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Computes startOfDay (00:00:00.000) and endOfDay (23:59:59.999) instants for a given timezone.
 */
export function getDayTimezoneRange(
  timezone: string = 'Asia/Ho_Chi_Minh',
  targetDate: Date = new Date(),
): {
  startOfDay: Date;
  endOfDay: Date;
  dateFormatted: string;
} {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateFormatted = formatter.format(targetDate);
  const [yearStr, monthStr, dayStr] = dateFormatted.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  const approxDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const utcStr = approxDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = approxDate.toLocaleString('en-US', { timeZone: timezone });
  const diffMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();

  const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - diffMs);
  const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) - diffMs);

  return { startOfDay, endOfDay, dateFormatted };
}

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves summary metrics for today strictly scoped by workspaceId.
   */
  async getSummary(workspaceId: string): Promise<DashboardSummaryDto> {
    const client = this.prisma.getClient();

    // 1. Resolve workspace timezone
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { timezone: true },
    });
    const timezone = workspace?.timezone || 'Asia/Ho_Chi_Minh';
    const { startOfDay, endOfDay, dateFormatted } = getDayTimezoneRange(timezone);

    // 2. Query metrics in parallel
    const [
      orderAgg,
      orderCount,
      newConversationsToday,
      newContactsToday,
      inboxes,
      handledConversationsToday,
    ] = await Promise.all([
      client.order.aggregate({
        where: {
          workspaceId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ['CONFIRMED', 'PAID', 'SHIPPING', 'COMPLETED'],
          },
        },
        _sum: {
          totalAmount: true,
          paidAmount: true,
        },
      }),
      client.order.count({
        where: {
          workspaceId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
          status: {
            in: ['CONFIRMED', 'PAID', 'SHIPPING', 'COMPLETED'],
          },
        },
      }),
      client.conversation.count({
        where: {
          workspaceId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      client.contact.count({
        where: {
          workspaceId,
          createdAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
      client.inbox.findMany({
        where: { workspaceId },
        select: { settings: true },
      }),
      client.conversation.count({
        where: {
          workspaceId,
          lastAiMessageAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      }),
    ]);

    const totalRevenueToday = Number(orderAgg._sum.totalAmount || 0);
    const paidRevenueToday = Number(orderAgg._sum.paidAmount || 0);
    const totalOrdersToday = orderCount;

    const totalInboxesCount = inboxes.length;
    const enabledInboxesCount = inboxes.filter(inbox => {
      const settings = (inbox.settings as Record<string, any>) || {};
      return Boolean(settings.aiCommercePolicy?.enabled);
    }).length;
    const isActive = enabledInboxesCount > 0;

    return {
      date: dateFormatted,
      timezone,
      orders: {
        totalOrdersToday,
        totalRevenueToday,
        paidRevenueToday,
      },
      conversations: {
        newConversationsToday,
      },
      contacts: {
        newContactsToday,
      },
      aiCopilot: {
        isActive,
        enabledInboxesCount,
        totalInboxesCount,
        handledConversationsToday,
      },
    };
  }
}
