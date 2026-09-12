import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PlatformAuditAction, PlatformAuditTargetType } from '@sales-copilot/shared-contracts';
import {
  formatDateTime,
  getActionBadgeConfig,
  getTargetTypeBadgeConfig,
  normalizeDateFilterRange,
  isValidDateFilterRange,
} from '../utils/audit-log-helpers';

describe('Audit Log Helpers', () => {
  describe('getActionBadgeConfig', () => {
    it('should return destructive badge for WORKSPACE_SUSPENDED', () => {
      const config = getActionBadgeConfig(PlatformAuditAction.WORKSPACE_SUSPENDED);
      assert.strictEqual(config.label, 'Tạm khóa Shop');
      assert.strictEqual(config.variant, 'destructive');
    });

    it('should return secondary badge for WORKSPACE_ACTIVATED', () => {
      const config = getActionBadgeConfig(PlatformAuditAction.WORKSPACE_ACTIVATED);
      assert.strictEqual(config.label, 'Kích hoạt Shop');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return default badge for PLAN_CHANGED', () => {
      const config = getActionBadgeConfig(PlatformAuditAction.PLAN_CHANGED);
      assert.strictEqual(config.label, 'Đổi gói cước');
      assert.strictEqual(config.variant, 'default');
    });

    it('should return default badge for QUOTA_UPDATED', () => {
      const config = getActionBadgeConfig(PlatformAuditAction.QUOTA_UPDATED);
      assert.strictEqual(config.label, 'Cập nhật Quota');
      assert.strictEqual(config.variant, 'default');
    });

    it('should return outline badge for SYSTEM_SETTING_UPDATED', () => {
      const config = getActionBadgeConfig(PlatformAuditAction.SYSTEM_SETTING_UPDATED);
      assert.strictEqual(config.label, 'Sửa cấu hình');
      assert.strictEqual(config.variant, 'outline');
    });

    it('should return fallback badge for unknown action', () => {
      const config = getActionBadgeConfig('UNKNOWN_ACTION');
      assert.strictEqual(config.label, 'UNKNOWN_ACTION');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return fallback badge when action is undefined or null', () => {
      const config = getActionBadgeConfig(undefined);
      assert.strictEqual(config.label, 'Hành động khác');
      assert.strictEqual(config.variant, 'secondary');
    });
  });

  describe('getTargetTypeBadgeConfig', () => {
    it('should return Workspace badge config', () => {
      const config = getTargetTypeBadgeConfig(PlatformAuditTargetType.WORKSPACE);
      assert.strictEqual(config.label, 'Workspace');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return Setting badge config', () => {
      const config = getTargetTypeBadgeConfig(PlatformAuditTargetType.SYSTEM_SETTING);
      assert.strictEqual(config.label, 'Cấu hình');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return User badge config', () => {
      const config = getTargetTypeBadgeConfig(PlatformAuditTargetType.USER);
      assert.strictEqual(config.label, 'Người dùng');
      assert.strictEqual(config.variant, 'secondary');
    });

    it('should return fallback badge config for unknown target', () => {
      const config = getTargetTypeBadgeConfig(undefined);
      assert.strictEqual(config.label, 'Khác');
      assert.strictEqual(config.variant, 'outline');
    });
  });

  describe('formatDateTime', () => {
    it('should format ISO date string to Vietnamese date format with seconds', () => {
      const formatted = formatDateTime('2026-03-10T14:30:45Z');
      assert.ok(formatted !== '-');
      assert.ok(formatted.includes('/'));
      assert.ok(formatted.includes(':'));
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

  describe('normalizeDateFilterRange', () => {
    it('should normalize date strings YYYY-MM-DD to start and end of day in UTC ISO', () => {
      const range = normalizeDateFilterRange('2026-03-01', '2026-03-05');
      assert.strictEqual(range.startDate, '2026-03-01T00:00:00.000Z');
      assert.strictEqual(range.endDate, '2026-03-05T23:59:59.999Z');
    });

    it('should preserve full ISO date strings if already containing T', () => {
      const range = normalizeDateFilterRange(
        '2026-03-01T08:00:00.000Z',
        '2026-03-05T18:30:00.000Z',
      );
      assert.strictEqual(range.startDate, '2026-03-01T08:00:00.000Z');
      assert.strictEqual(range.endDate, '2026-03-05T18:30:00.000Z');
    });

    it('should handle undefined parameters gracefully', () => {
      const range = normalizeDateFilterRange(undefined, undefined);
      assert.strictEqual(range.startDate, undefined);
      assert.strictEqual(range.endDate, undefined);
    });

    it('should handle only one date provided', () => {
      const rangeStartOnly = normalizeDateFilterRange('2026-03-01', undefined);
      assert.strictEqual(rangeStartOnly.startDate, '2026-03-01T00:00:00.000Z');
      assert.strictEqual(rangeStartOnly.endDate, undefined);

      const rangeEndOnly = normalizeDateFilterRange(undefined, '2026-03-05');
      assert.strictEqual(rangeEndOnly.startDate, undefined);
      assert.strictEqual(rangeEndOnly.endDate, '2026-03-05T23:59:59.999Z');
    });
  });

  describe('isValidDateFilterRange', () => {
    it('should return true when both dates are omitted or only one is provided', () => {
      assert.strictEqual(isValidDateFilterRange(undefined, undefined), true);
      assert.strictEqual(isValidDateFilterRange('2026-03-01', undefined), true);
      assert.strictEqual(isValidDateFilterRange(undefined, '2026-03-05'), true);
    });

    it('should return true when startDate is before or equal to endDate', () => {
      assert.strictEqual(isValidDateFilterRange('2026-03-01', '2026-03-05'), true);
      assert.strictEqual(isValidDateFilterRange('2026-03-05', '2026-03-05'), true);
    });

    it('should return false when startDate is after endDate', () => {
      assert.strictEqual(isValidDateFilterRange('2026-03-10', '2026-03-05'), false);
    });
  });
});
