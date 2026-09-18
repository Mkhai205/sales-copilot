import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { createEvaluateDiscountTool } from '../evaluate-discount.tool';
import { DiscountGuardService } from '../../../services/discount-guard.service';

describe('evaluateDiscount Tool (T5)', () => {
  let discountGuardService: DiscountGuardService;

  beforeEach(() => {
    discountGuardService = new DiscountGuardService();
  });

  it('should approve discount within policy limit', async () => {
    const tool = createEvaluateDiscountTool({
      discountGuardService,
      policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
    });

    const result = await tool.execute!({ orderTotal: 200000, requestedDiscount: 15000 }, {} as any);
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.allowedDiscount, 15000);
  });

  it('should reject discount exceeding policy limit and return maximum allowed', async () => {
    const tool = createEvaluateDiscountTool({
      discountGuardService,
      policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
    });

    // 10% of 200,000 = 20,000
    const result = await tool.execute!({ orderTotal: 200000, requestedDiscount: 35000 }, {} as any);
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.allowedDiscount, 20000);
    assert.ok(result.reason?.includes('vượt quá'));
  });

  it('should reject when shop policy does not allow discounts', async () => {
    const tool = createEvaluateDiscountTool({
      discountGuardService,
      policy: undefined,
    });

    const result = await tool.execute!({ orderTotal: 200000, requestedDiscount: 10000 }, {} as any);
    assert.strictEqual(result.approved, false);
    assert.strictEqual(result.allowedDiscount, 0);
  });
});
