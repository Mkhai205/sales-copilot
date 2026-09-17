import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DiscountGuardService } from '../discount-guard.service';

describe('DiscountGuardService', () => {
  let service: DiscountGuardService;

  beforeEach(() => {
    service = new DiscountGuardService();
  });

  it('should reject when orderTotal <= 0', () => {
    const result = service.evaluate(0, 50000, { enabled: true, maxDiscountPercent: 10 });
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.allowedDiscount, 0);
    assert.ok(result.reason?.includes('không hợp lệ'));
  });

  it('should approve when requestedDiscount <= 0', () => {
    const result = service.evaluate(200000, 0, { enabled: true, maxDiscountPercent: 10 });
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.allowedDiscount, 0);
  });

  it('should reject when no discount policy is configured', () => {
    const result1 = service.evaluate(200000, 20000, undefined);
    assert.strictEqual(result1.approved, false);
    assert.strictEqual(result1.allowedDiscount, 0);

    const result2 = service.evaluate(200000, 20000, { enabled: true });
    assert.strictEqual(result2.approved, false);
    assert.strictEqual(result2.allowedDiscount, 0);
  });

  it('should enforce percentage discount cap correctly', () => {
    // 10% of 200,000 = 20,000
    const policy = { enabled: true, maxDiscountPercent: 10 };

    const withinLimit = service.evaluate(200000, 15000, policy);
    assert.strictEqual(withinLimit.approved, true);
    assert.strictEqual(withinLimit.allowedDiscount, 15000);

    const exactLimit = service.evaluate(200000, 20000, policy);
    assert.strictEqual(exactLimit.approved, true);
    assert.strictEqual(exactLimit.allowedDiscount, 20000);

    const exceedLimit = service.evaluate(200000, 25000, policy);
    assert.strictEqual(exceedLimit.approved, false);
    assert.strictEqual(exceedLimit.allowedDiscount, 20000);
    assert.ok(exceedLimit.reason?.includes('vượt quá'));
  });

  it('should enforce fixed VND discount cap correctly', () => {
    const policy = { enabled: true, maxDiscountVnd: 50000 };

    const withinLimit = service.evaluate(1000000, 40000, policy);
    assert.strictEqual(withinLimit.approved, true);
    assert.strictEqual(withinLimit.allowedDiscount, 40000);

    const exceedLimit = service.evaluate(1000000, 60000, policy);
    assert.strictEqual(exceedLimit.approved, false);
    assert.strictEqual(exceedLimit.allowedDiscount, 50000);
  });

  it('should enforce min(percentage, fixedVnd) when both are configured', () => {
    // 10% of 1,000,000 is 100,000. But maxDiscountVnd is 50,000.
    // So effective cap is 50,000.
    const policy = {
      enabled: true,
      maxDiscountPercent: 10,
      maxDiscountVnd: 50000,
    };

    const withinLimit = service.evaluate(1000000, 50000, policy);
    assert.strictEqual(withinLimit.approved, true);
    assert.strictEqual(withinLimit.allowedDiscount, 50000);

    const exceedLimit = service.evaluate(1000000, 60000, policy);
    assert.strictEqual(exceedLimit.approved, false);
    assert.strictEqual(exceedLimit.allowedDiscount, 50000);

    // For a smaller order: 200,000. 10% is 20,000, which is < 50,000.
    // So effective cap is 20,000.
    const smallOrderExceed = service.evaluate(200000, 30000, policy);
    assert.strictEqual(smallOrderExceed.approved, false);
    assert.strictEqual(smallOrderExceed.allowedDiscount, 20000);
  });
});
