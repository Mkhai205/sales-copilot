import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  BillingPlanType,
  PlatformAuditAction,
  PlatformAuditTargetType,
  SystemSettingCategory,
  queryPlatformWorkspacesSchema,
  workspaceCustomQuotasSchema,
  updateWorkspacePlanSchema,
  toggleWorkspaceStatusSchema,
  querySystemSettingsSchema,
  updateSystemSettingSchema,
  queryPlatformAuditLogsSchema,
} from '../index';

describe('Shared Contracts — Platform Admin Schemas & Validation', () => {
  describe('Enums check', () => {
    it('should have proper enum definitions', () => {
      assert.strictEqual(PlatformAuditAction.WORKSPACE_SUSPENDED, 'WORKSPACE_SUSPENDED');
      assert.strictEqual(PlatformAuditAction.WORKSPACE_ACTIVATED, 'WORKSPACE_ACTIVATED');
      assert.strictEqual(PlatformAuditAction.QUOTA_UPDATED, 'QUOTA_UPDATED');
      assert.strictEqual(PlatformAuditAction.PLAN_CHANGED, 'PLAN_CHANGED');
      assert.strictEqual(PlatformAuditAction.SYSTEM_SETTING_UPDATED, 'SYSTEM_SETTING_UPDATED');

      assert.strictEqual(PlatformAuditTargetType.WORKSPACE, 'WORKSPACE');
      assert.strictEqual(PlatformAuditTargetType.SYSTEM_SETTING, 'SYSTEM_SETTING');
      assert.strictEqual(PlatformAuditTargetType.USER, 'USER');

      assert.strictEqual(SystemSettingCategory.GENERAL, 'GENERAL');
      assert.strictEqual(SystemSettingCategory.FEATURE_FLAGS, 'FEATURE_FLAGS');
      assert.strictEqual(SystemSettingCategory.AI, 'AI');
      assert.strictEqual(SystemSettingCategory.BILLING, 'BILLING');
      assert.strictEqual(SystemSettingCategory.SYSTEM, 'SYSTEM');
    });
  });

  describe('queryPlatformWorkspacesSchema', () => {
    it('should apply defaults for page, limit, sortBy, and sortOrder', () => {
      const parsed = queryPlatformWorkspacesSchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
      assert.strictEqual(parsed.sortBy, 'createdAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });

    it('should coerce string numbers for pagination', () => {
      const parsed = queryPlatformWorkspacesSchema.parse({
        page: '2',
        limit: '50',
        search: '  Shop A  ',
        plan: BillingPlanType.STANDARD,
        status: 'ACTIVE',
        sortBy: 'name',
        sortOrder: 'asc',
      });
      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.limit, 50);
      assert.strictEqual(parsed.search, 'Shop A');
      assert.strictEqual(parsed.plan, BillingPlanType.STANDARD);
      assert.strictEqual(parsed.status, 'ACTIVE');
      assert.strictEqual(parsed.sortBy, 'name');
      assert.strictEqual(parsed.sortOrder, 'asc');
    });

    it('should reject invalid plan or status', () => {
      assert.throws(() => {
        queryPlatformWorkspacesSchema.parse({ plan: 'INVALID_PLAN' });
      });
      assert.throws(() => {
        queryPlatformWorkspacesSchema.parse({ status: 'UNKNOWN' });
      });
    });
  });

  describe('workspaceCustomQuotasSchema', () => {
    it('should parse valid partial quota object', () => {
      const parsed = workspaceCustomQuotasSchema.parse({
        maxAgents: 10,
        maxChannels: 5,
        storageLimitMb: 1000,
        aiMonthlyTokens: 50000,
      });
      assert.strictEqual(parsed.maxAgents, 10);
      assert.strictEqual(parsed.maxChannels, 5);
      assert.strictEqual(parsed.storageLimitMb, 1000);
      assert.strictEqual(parsed.aiMonthlyTokens, 50000);
    });

    it('should reject invalid values (e.g. negative or less than minimum)', () => {
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ maxAgents: 0 });
      });
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ maxChannels: -1 });
      });
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ storageLimitMb: 50 }); // min is 100
      });
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ aiMonthlyTokens: -10 });
      });
    });
  });

  describe('updateWorkspacePlanSchema', () => {
    it('should accept update with billingPlan only', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        billingPlan: BillingPlanType.ENTERPRISE,
      });
      assert.strictEqual(parsed.billingPlan, BillingPlanType.ENTERPRISE);
    });

    it('should accept update with quotas only', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        quotas: { maxAgents: 15 },
      });
      assert.strictEqual(parsed.quotas?.maxAgents, 15);
    });

    it('should accept update with both billingPlan and quotas', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        billingPlan: BillingPlanType.STANDARD,
        quotas: { maxAgents: 5, storageLimitMb: 2000 },
      });
      assert.strictEqual(parsed.billingPlan, BillingPlanType.STANDARD);
      assert.strictEqual(parsed.quotas?.maxAgents, 5);
      assert.strictEqual(parsed.quotas?.storageLimitMb, 2000);
    });

    it('should reject empty payload', () => {
      assert.throws(() => {
        updateWorkspacePlanSchema.parse({});
      });
      assert.throws(() => {
        updateWorkspacePlanSchema.parse({ quotas: {} });
      });
      assert.throws(() => {
        updateWorkspacePlanSchema.parse({ quotas: { maxAgents: undefined } });
      });
    });
  });

  describe('toggleWorkspaceStatusSchema', () => {
    it('should accept isSuspended = false without reason', () => {
      const parsed = toggleWorkspaceStatusSchema.parse({
        isSuspended: false,
      });
      assert.strictEqual(parsed.isSuspended, false);
      assert.strictEqual(parsed.reason, undefined);
    });

    it('should accept isSuspended = true with non-empty reason', () => {
      const parsed = toggleWorkspaceStatusSchema.parse({
        isSuspended: true,
        reason: 'Violation of Terms of Service',
      });
      assert.strictEqual(parsed.isSuspended, true);
      assert.strictEqual(parsed.reason, 'Violation of Terms of Service');
    });

    it('should reject isSuspended = true with missing or empty reason', () => {
      assert.throws(() => {
        toggleWorkspaceStatusSchema.parse({
          isSuspended: true,
        });
      }, /Reason is required when suspending a workspace/);

      assert.throws(() => {
        toggleWorkspaceStatusSchema.parse({
          isSuspended: true,
          reason: '   ',
        });
      }, /Reason is required when suspending a workspace/);
    });
  });

  describe('querySystemSettingsSchema', () => {
    it('should accept valid category', () => {
      const parsed = querySystemSettingsSchema.parse({
        category: 'FEATURE_FLAGS',
      });
      assert.strictEqual(parsed.category, 'FEATURE_FLAGS');
    });

    it('should accept empty query', () => {
      const parsed = querySystemSettingsSchema.parse({});
      assert.strictEqual(parsed.category, undefined);
    });

    it('should reject invalid category', () => {
      assert.throws(() => {
        querySystemSettingsSchema.parse({ category: 'UNKNOWN_CATEGORY' });
      });
    });
  });

  describe('updateSystemSettingSchema', () => {
    it('should accept any valid json value and optional description', () => {
      const parsedBool = updateSystemSettingSchema.parse({
        value: true,
        description: 'Enable VietQR feature',
      });
      assert.strictEqual(parsedBool.value, true);
      assert.strictEqual(parsedBool.description, 'Enable VietQR feature');

      const parsedObj = updateSystemSettingSchema.parse({
        value: { provider: 'GEMINI', model: 'gemini-2.5-flash' },
      });
      assert.deepStrictEqual(parsedObj.value, { provider: 'GEMINI', model: 'gemini-2.5-flash' });
    });
  });

  describe('queryPlatformAuditLogsSchema', () => {
    it('should parse filters and apply default pagination', () => {
      const now = new Date().toISOString();
      const parsed = queryPlatformAuditLogsSchema.parse({
        action: PlatformAuditAction.WORKSPACE_SUSPENDED,
        targetType: PlatformAuditTargetType.WORKSPACE,
        targetId: 'ws-123',
        actorEmail: 'admin@salescopilot.io',
        startDate: now,
      });

      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
      assert.strictEqual(parsed.action, PlatformAuditAction.WORKSPACE_SUSPENDED);
      assert.strictEqual(parsed.targetType, PlatformAuditTargetType.WORKSPACE);
      assert.strictEqual(parsed.targetId, 'ws-123');
      assert.strictEqual(parsed.actorEmail, 'admin@salescopilot.io');
      assert.strictEqual(parsed.startDate, now);
    });

    it('should reject invalid date strings', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({ startDate: 'not-a-date' });
      });
    });

    it('should reject invalid action or targetType', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({ action: 'INVALID_ACTION' });
      });
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({ targetType: 'INVALID_TARGET' });
      });
    });

    it('should reject when startDate is after endDate', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({
          startDate: '2026-09-10T12:00:00.000Z',
          endDate: '2026-09-01T12:00:00.000Z',
        });
      }, /startDate must be before or equal to endDate/);
    });

    it('should accept when startDate is before or equal to endDate', () => {
      const parsed = queryPlatformAuditLogsSchema.parse({
        startDate: '2026-09-01T12:00:00.000Z',
        endDate: '2026-09-10T12:00:00.000Z',
      });
      assert.strictEqual(parsed.startDate, '2026-09-01T12:00:00.000Z');
      assert.strictEqual(parsed.endDate, '2026-09-10T12:00:00.000Z');
    });

    it('should accept plain YYYY-MM-DD date strings', () => {
      const parsed = queryPlatformAuditLogsSchema.parse({
        startDate: '2026-09-01',
        endDate: '2026-09-10',
      });
      assert.strictEqual(parsed.startDate, '2026-09-01');
      assert.strictEqual(parsed.endDate, '2026-09-10');
    });

    it('should reject YYYY-MM-DD when startDate is after endDate', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({
          startDate: '2026-09-15',
          endDate: '2026-09-01',
        });
      }, /startDate must be before or equal to endDate/);
    });
  });
});
