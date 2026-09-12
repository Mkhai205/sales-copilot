import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  calculateActiveRatio,
  getHealthBadgeConfig,
  formatMetricNumber,
  formatAverageNumber,
} from '../utils/overview-helpers';

describe('Overview Helpers', () => {
  describe('calculateActiveRatio', () => {
    it('should calculate accurate percentage for normal values', () => {
      assert.strictEqual(calculateActiveRatio(8, 10), 80);
      assert.strictEqual(calculateActiveRatio(5, 10), 50);
      assert.strictEqual(calculateActiveRatio(1, 3), 33);
    });

    it('should handle zero or negative total safely without division by zero', () => {
      assert.strictEqual(calculateActiveRatio(0, 0), 0);
      assert.strictEqual(calculateActiveRatio(5, 0), 0);
      assert.strictEqual(calculateActiveRatio(5, -10), 0);
    });

    it('should handle zero or negative active safely', () => {
      assert.strictEqual(calculateActiveRatio(0, 10), 0);
      assert.strictEqual(calculateActiveRatio(-5, 10), 0);
    });

    it('should cap ratio at 100 when active exceeds total', () => {
      assert.strictEqual(calculateActiveRatio(15, 10), 100);
    });

    it('should return 0 for null, undefined or non-finite inputs', () => {
      assert.strictEqual(calculateActiveRatio(null, 10), 0);
      assert.strictEqual(calculateActiveRatio(5, null), 0);
      assert.strictEqual(calculateActiveRatio(undefined, undefined), 0);
      assert.strictEqual(calculateActiveRatio(NaN, 10), 0);
      assert.strictEqual(calculateActiveRatio(Infinity, 10), 0);
    });
  });

  describe('getHealthBadgeConfig', () => {
    it('should return healthy badge config for HEALTHY', () => {
      const config = getHealthBadgeConfig('HEALTHY');
      assert.strictEqual(config.label, 'Hoạt động bình thường');
      assert.strictEqual(config.pulse, true);
      assert.strictEqual(config.dotClass, 'bg-emerald-500');
    });

    it('should return degraded badge config for DEGRADED', () => {
      const config = getHealthBadgeConfig('DEGRADED');
      assert.strictEqual(config.label, 'Hiệu năng suy giảm');
      assert.strictEqual(config.pulse, true);
      assert.strictEqual(config.dotClass, 'bg-amber-500');
    });

    it('should return down badge config for DOWN', () => {
      const config = getHealthBadgeConfig('DOWN');
      assert.strictEqual(config.label, 'Mất kết nối');
      assert.strictEqual(config.pulse, false);
      assert.strictEqual(config.variant, 'destructive');
      assert.strictEqual(config.dotClass, 'bg-rose-500');
    });

    it('should return fallback badge config for unknown or missing status', () => {
      const configNull = getHealthBadgeConfig(null);
      assert.strictEqual(configNull.label, 'Không xác định');
      assert.strictEqual(configNull.variant, 'outline');

      const configUnknown = getHealthBadgeConfig('SOMETHING_ELSE');
      assert.strictEqual(configUnknown.label, 'Không xác định');
    });
  });

  describe('formatMetricNumber', () => {
    it('should format numbers with thousands separators', () => {
      assert.strictEqual(formatMetricNumber(0), '0');
      // vi-VN format uses dot (.) as thousands separator
      assert.strictEqual(formatMetricNumber(1000), '1.000');
      assert.strictEqual(formatMetricNumber(25000), '25.000');
      assert.strictEqual(formatMetricNumber(1000000), '1.000.000');
    });

    it('should return 0 for null, undefined, or NaN inputs', () => {
      assert.strictEqual(formatMetricNumber(null), '0');
      assert.strictEqual(formatMetricNumber(undefined), '0');
      assert.strictEqual(formatMetricNumber(NaN), '0');
    });

    it('should clamp negative numbers to 0', () => {
      assert.strictEqual(formatMetricNumber(-10), '0');
    });
  });

  describe('formatAverageNumber', () => {
    it('should format whole numbers without trailing zeroes', () => {
      assert.strictEqual(formatAverageNumber(5), '5');
      assert.strictEqual(formatAverageNumber(10), '10');
      assert.strictEqual(formatAverageNumber(0), '0');
    });

    it('should format decimals using Vietnamese locale comma separator', () => {
      assert.strictEqual(formatAverageNumber(3.5), '3,5');
      assert.strictEqual(formatAverageNumber(2.3333), '2,3');
    });

    it('should return 0 for null, undefined, NaN, or non-positive inputs', () => {
      assert.strictEqual(formatAverageNumber(null), '0');
      assert.strictEqual(formatAverageNumber(undefined), '0');
      assert.strictEqual(formatAverageNumber(NaN), '0');
      assert.strictEqual(formatAverageNumber(-5), '0');
    });
  });
});
