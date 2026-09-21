import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { dashboardSummarySchema, type DashboardSummaryDto } from '../index';

describe('Shared Contracts — Dashboard Context Schemas', () => {
  describe('dashboardSummarySchema', () => {
    it('should validate a complete and valid dashboard summary payload', () => {
      const validPayload: DashboardSummaryDto = {
        date: '2026-09-21',
        timezone: 'Asia/Ho_Chi_Minh',
        orders: {
          totalOrdersToday: 42,
          totalRevenueToday: 15500000,
          paidRevenueToday: 12000000,
        },
        conversations: {
          newConversationsToday: 18,
        },
        contacts: {
          newContactsToday: 7,
        },
        aiCopilot: {
          isActive: true,
          enabledInboxesCount: 3,
          totalInboxesCount: 5,
          handledConversationsToday: 14,
        },
      };

      const parsed = dashboardSummarySchema.parse(validPayload);
      assert.strictEqual(parsed.date, '2026-09-21');
      assert.strictEqual(parsed.orders.totalOrdersToday, 42);
      assert.strictEqual(parsed.aiCopilot.isActive, true);
    });

    it('should reject dashboardSummarySchema when missing required nested objects', () => {
      assert.throws(() => {
        dashboardSummarySchema.parse({
          date: '2026-09-21',
          timezone: 'Asia/Ho_Chi_Minh',
        });
      });
    });

    it('should reject dashboardSummarySchema with non-numeric metrics', () => {
      assert.throws(() => {
        dashboardSummarySchema.parse({
          date: '2026-09-21',
          timezone: 'Asia/Ho_Chi_Minh',
          orders: {
            totalOrdersToday: 'forty-two',
            totalRevenueToday: 15500000,
            paidRevenueToday: 12000000,
          },
          conversations: { newConversationsToday: 18 },
          contacts: { newContactsToday: 7 },
          aiCopilot: {
            isActive: true,
            enabledInboxesCount: 3,
            totalInboxesCount: 5,
            handledConversationsToday: 14,
          },
        });
      });
    });
  });
});
