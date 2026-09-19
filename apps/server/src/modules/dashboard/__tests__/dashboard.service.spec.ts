import { DashboardService, getDayTimezoneRange } from '../dashboard.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

describe('DashboardService', () => {
  const workspaceId = 'ws-test-123';

  describe('getDayTimezoneRange', () => {
    it('should compute startOfDay and endOfDay matching timezone', () => {
      const targetDate = new Date('2026-09-20T12:00:00Z');
      const { startOfDay, endOfDay, dateFormatted } = getDayTimezoneRange(
        'Asia/Ho_Chi_Minh',
        targetDate,
      );

      expect(dateFormatted).toBe('2026-09-20');
      expect(startOfDay.getTime()).toBeLessThan(endOfDay.getTime());
      // The difference between startOfDay and endOfDay must be 24h - 1ms
      expect(endOfDay.getTime() - startOfDay.getTime()).toBe(24 * 60 * 60 * 1000 - 1);
    });
  });

  describe('getSummary', () => {
    let mockPrisma: any;
    let dashboardService: DashboardService;

    beforeEach(() => {
      mockPrisma = {
        getClient: jest.fn(),
      };
      dashboardService = new DashboardService(mockPrisma as PrismaService);
    });

    it('should aggregate metrics with strict workspaceId filtering', async () => {
      const mockClient = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue({ timezone: 'Asia/Ho_Chi_Minh' }),
        },
        order: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { totalAmount: 1500000, paidAmount: 1000000 },
          }),
          count: jest.fn().mockResolvedValue(5),
        },
        conversation: {
          count: jest
            .fn()
            .mockResolvedValueOnce(12) // newConversationsToday
            .mockResolvedValueOnce(8), // handledConversationsToday
        },
        contact: {
          count: jest.fn().mockResolvedValue(3),
        },
        inbox: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { settings: { aiCommercePolicy: { enabled: true } } },
              { settings: { aiCommercePolicy: { enabled: false } } },
            ]),
        },
      };

      mockPrisma.getClient.mockReturnValue(mockClient);

      const summary = await dashboardService.getSummary(workspaceId);

      expect(mockClient.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: workspaceId },
        select: { timezone: true },
      });

      expect(mockClient.order.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            workspaceId,
            status: { in: ['CONFIRMED', 'PAID', 'SHIPPING', 'COMPLETED'] },
          }),
        }),
      );

      expect(summary.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(summary.orders.totalOrdersToday).toBe(5);
      expect(summary.orders.totalRevenueToday).toBe(1500000);
      expect(summary.orders.paidRevenueToday).toBe(1000000);
      expect(summary.conversations.newConversationsToday).toBe(12);
      expect(summary.contacts.newContactsToday).toBe(3);
      expect(summary.aiCopilot.isActive).toBe(true);
      expect(summary.aiCopilot.enabledInboxesCount).toBe(1);
      expect(summary.aiCopilot.totalInboxesCount).toBe(2);
      expect(summary.aiCopilot.handledConversationsToday).toBe(8);
    });

    it('should handle zero metrics and inactive AI correctly', async () => {
      const mockClient = {
        workspace: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
        order: {
          aggregate: jest.fn().mockResolvedValue({
            _sum: { totalAmount: null, paidAmount: null },
          }),
          count: jest.fn().mockResolvedValue(0),
        },
        conversation: {
          count: jest.fn().mockResolvedValue(0),
        },
        contact: {
          count: jest.fn().mockResolvedValue(0),
        },
        inbox: {
          findMany: jest.fn().mockResolvedValue([]),
        },
      };

      mockPrisma.getClient.mockReturnValue(mockClient);

      const summary = await dashboardService.getSummary(workspaceId);

      expect(summary.timezone).toBe('Asia/Ho_Chi_Minh');
      expect(summary.orders.totalOrdersToday).toBe(0);
      expect(summary.orders.totalRevenueToday).toBe(0);
      expect(summary.orders.paidRevenueToday).toBe(0);
      expect(summary.conversations.newConversationsToday).toBe(0);
      expect(summary.contacts.newContactsToday).toBe(0);
      expect(summary.aiCopilot.isActive).toBe(false);
      expect(summary.aiCopilot.enabledInboxesCount).toBe(0);
      expect(summary.aiCopilot.totalInboxesCount).toBe(0);
      expect(summary.aiCopilot.handledConversationsToday).toBe(0);
    });
  });
});
