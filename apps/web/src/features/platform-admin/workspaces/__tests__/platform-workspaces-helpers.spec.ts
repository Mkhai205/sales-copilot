import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { BillingPlanType } from '@sales-copilot/shared-contracts';
import {
  formatDateTime,
  formatStorage,
  formatTokens,
  getPlanBadgeConfig,
  getStatusBadgeConfig,
} from '../utils/workspace-helpers';

describe('Platform Workspaces Helpers', () => {
  describe('getPlanBadgeConfig', () => {
    it('should return correct badge config for FREE plan', () => {
      const config = getPlanBadgeConfig(BillingPlanType.FREE);
      assert.strictEqual(config.label, 'FREE');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return correct badge config for STANDARD plan', () => {
      const config = getPlanBadgeConfig(BillingPlanType.STANDARD);
      assert.strictEqual(config.label, 'STANDARD');
      assert.strictEqual(config.variant, 'default');
    });

    it('should return correct badge config for ENTERPRISE plan', () => {
      const config = getPlanBadgeConfig(BillingPlanType.ENTERPRISE);
      assert.strictEqual(config.label, 'ENTERPRISE');
      assert.strictEqual(config.variant, 'default');
    });

    it('should fallback to FREE when plan is undefined or unknown', () => {
      const config = getPlanBadgeConfig(undefined);
      assert.strictEqual(config.label, 'FREE');
      assert.strictEqual(config.variant, 'secondary');
    });
  });

  describe('getStatusBadgeConfig', () => {
    it('should return destructive badge config when workspace is suspended', () => {
      const config = getStatusBadgeConfig(true);
      assert.strictEqual(config.label, 'Đã tạm khóa');
      assert.strictEqual(config.variant, 'destructive');
    });

    it('should return active badge config when workspace is active', () => {
      const config = getStatusBadgeConfig(false);
      assert.strictEqual(config.label, 'Đang hoạt động');
      assert.strictEqual(config.variant, 'secondary');
    });
  });

  describe('formatTokens', () => {
    it('should format token counts with thousands separator', () => {
      assert.strictEqual(formatTokens(0), '0');
      assert.strictEqual(formatTokens(50000), '50.000');
      assert.strictEqual(formatTokens(1234567), '1.234.567');
    });

    it('should handle undefined or null gracefully', () => {
      assert.strictEqual(formatTokens(undefined), '0');
      assert.strictEqual(formatTokens(null), '0');
      assert.strictEqual(formatTokens(NaN), '0');
      assert.strictEqual(formatTokens(Infinity), '0');
    });
  });

  describe('formatStorage', () => {
    it('should format storage under 1024 MB in MB', () => {
      assert.strictEqual(formatStorage(500), '500 MB');
      assert.strictEqual(formatStorage(0), '0 MB');
    });

    it('should format storage over 1024 MB in GB', () => {
      assert.strictEqual(formatStorage(1024), '1 GB');
      assert.strictEqual(formatStorage(2048), '2 GB');
      assert.strictEqual(formatStorage(1536), '1.5 GB');
    });

    it('should handle undefined or null gracefully', () => {
      assert.strictEqual(formatStorage(undefined), '0 MB');
      assert.strictEqual(formatStorage(null), '0 MB');
      assert.strictEqual(formatStorage(NaN), '0 MB');
      assert.strictEqual(formatStorage(Infinity), '0 MB');
    });
  });

  describe('formatDateTime', () => {
    it('should format date string to Vietnamese date format', () => {
      const formatted = formatDateTime('2026-03-10T14:30:00Z');
      assert.ok(formatted !== '-');
      assert.ok(formatted.includes('/'));
    });

    it('should format numeric timestamp correctly', () => {
      const formatted = formatDateTime(1773144600000);
      assert.ok(formatted !== '-');
      assert.ok(formatted.includes('/'));
    });

    it('should return "-" for empty or invalid date input', () => {
      assert.strictEqual(formatDateTime(undefined), '-');
      assert.strictEqual(formatDateTime(null), '-');
      assert.strictEqual(formatDateTime('invalid-date'), '-');
    });
  });
});
