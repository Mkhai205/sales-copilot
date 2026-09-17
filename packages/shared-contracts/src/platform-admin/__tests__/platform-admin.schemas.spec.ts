import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType } from '../../identity';
import {
  queryPlatformWorkspacesSchema,
  workspaceCustomQuotasSchema,
  updateWorkspacePlanSchema,
  toggleWorkspaceStatusSchema,
  querySystemSettingsSchema,
  updateSystemSettingSchema,
  queryPlatformAuditLogsSchema,
  systemServiceHealthStatusSchema,
  platformSystemHealthSchema,
  platformMetricsOverviewSchema,
} from '../index';

describe('Shared Contracts — Platform Admin Context Schemas', () => {
  describe('queryPlatformWorkspacesSchema', () => {
    it('should apply defaults for page, limit, sortBy, and sortOrder', () => {
      const parsed = queryPlatformWorkspacesSchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
      assert.strictEqual(parsed.sortBy, 'createdAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });

    it('should coerce string numbers for pagination and trim search', () => {
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

    it('should reject invalid values (e.g. zero or negative)', () => {
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ maxAgents: 0 });
      });
      assert.throws(() => {
        workspaceCustomQuotasSchema.parse({ maxChannels: -1 });
      });
    });
  });

  describe('updateWorkspacePlanSchema', () => {
    it('should accept update with billingPlan only', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        billingPlan: BillingPlanType.ENTERPRISE,
      });
      assert.strictEqual(parsed.billingPlan, BillingPlanType.ENTERPRISE);
      assert.strictEqual(parsed.quotas, undefined);
    });

    it('should accept update with quotas only', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        quotas: { maxAgents: 100 },
      });
      assert.strictEqual(parsed.quotas?.maxAgents, 100);
    });

    it('should accept update with both billingPlan and quotas', () => {
      const parsed = updateWorkspacePlanSchema.parse({
        billingPlan: BillingPlanType.STANDARD,
        quotas: { maxChannels: 20 },
      });
      assert.strictEqual(parsed.billingPlan, BillingPlanType.STANDARD);
      assert.strictEqual(parsed.quotas?.maxChannels, 20);
    });

    it('should reject empty payload', () => {
      assert.throws(() => {
        updateWorkspacePlanSchema.parse({});
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
        toggleWorkspaceStatusSchema.parse({ isSuspended: true });
      });
      assert.throws(() => {
        toggleWorkspaceStatusSchema.parse({ isSuspended: true, reason: '   ' });
      });
    });
  });

  describe('querySystemSettingsSchema', () => {
    it('should accept valid category', () => {
      const parsed = querySystemSettingsSchema.parse({ category: 'FEATURE_FLAGS' });
      assert.strictEqual(parsed.category, 'FEATURE_FLAGS');
    });

    it('should accept empty query', () => {
      const parsed = querySystemSettingsSchema.parse({});
      assert.strictEqual(parsed.category, undefined);
    });

    it('should reject invalid category', () => {
      assert.throws(() => {
        querySystemSettingsSchema.parse({ category: 'NON_EXISTENT' });
      });
    });
  });

  describe('updateSystemSettingSchema', () => {
    it('should accept any valid json value and optional description', () => {
      const parsed = updateSystemSettingSchema.parse({
        value: { enabled: true, maxRetries: 3 },
        description: 'Updated settings',
      });
      assert.deepStrictEqual(parsed.value, { enabled: true, maxRetries: 3 });
      assert.strictEqual(parsed.description, 'Updated settings');
    });
  });

  describe('queryPlatformAuditLogsSchema', () => {
    it('should parse filters and apply default pagination', () => {
      const parsed = queryPlatformAuditLogsSchema.parse({
        targetId: 'target-uuid-123',
        actorEmail: 'admin@salescopilot.vn',
      });
      assert.strictEqual(parsed.targetId, 'target-uuid-123');
      assert.strictEqual(parsed.actorEmail, 'admin@salescopilot.vn');
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
    });

    it('should reject invalid date strings', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({ startDate: 'not-a-date' });
      });
    });

    it('should reject when startDate is after endDate', () => {
      assert.throws(() => {
        queryPlatformAuditLogsSchema.parse({
          startDate: '2026-03-10T00:00:00.000Z',
          endDate: '2026-03-01T00:00:00.000Z',
        });
      }, /startDate must be before or equal to endDate/);
    });

    it('should accept when startDate is before or equal to endDate', () => {
      const parsed = queryPlatformAuditLogsSchema.parse({
        startDate: '2026-03-01T00:00:00.000Z',
        endDate: '2026-03-10T00:00:00.000Z',
      });
      assert.strictEqual(parsed.startDate, '2026-03-01T00:00:00.000Z');
      assert.strictEqual(parsed.endDate, '2026-03-10T00:00:00.000Z');
    });
  });

  describe('Health & Metrics Schemas', () => {
    it('should validate systemServiceHealthStatusSchema enum', () => {
      assert.strictEqual(systemServiceHealthStatusSchema.parse('HEALTHY'), 'HEALTHY');
      assert.strictEqual(systemServiceHealthStatusSchema.parse('DEGRADED'), 'DEGRADED');
      assert.strictEqual(systemServiceHealthStatusSchema.parse('DOWN'), 'DOWN');
      assert.throws(() => systemServiceHealthStatusSchema.parse('UNKNOWN'));
    });

    it('should accept valid health status enum values', () => {
      const parsed = platformSystemHealthSchema.parse({
        postgres: 'HEALTHY',
        redis: 'HEALTHY',
        storage: 'DEGRADED',
      });
      assert.strictEqual(parsed.postgres, 'HEALTHY');
      assert.strictEqual(parsed.redis, 'HEALTHY');
      assert.strictEqual(parsed.storage, 'DEGRADED');
    });

    it('should reject missing postgres or redis in platformSystemHealthSchema', () => {
      assert.throws(() => {
        platformSystemHealthSchema.parse({ postgres: 'HEALTHY' });
      });
    });

    it('should accept valid metrics overview payload and reject negative numbers', () => {
      const valid = {
        totalWorkspaces: 10,
        activeWorkspaces: 8,
        suspendedWorkspaces: 2,
        totalUsers: 50,
        systemHealth: {
          postgres: 'HEALTHY' as const,
          redis: 'HEALTHY' as const,
        },
      };
      assert.strictEqual(platformMetricsOverviewSchema.parse(valid).totalWorkspaces, 10);

      assert.throws(() => {
        platformMetricsOverviewSchema.parse({ ...valid, totalWorkspaces: -1 });
      });
    });
  });
});
