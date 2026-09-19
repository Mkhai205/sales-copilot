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
    expect(result.approved).toBe(true);
    expect(result.allowedDiscount).toBe(15000);
  });

  it('should reject discount exceeding policy limit and return maximum allowed', async () => {
    const tool = createEvaluateDiscountTool({
      discountGuardService,
      policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
    });

    // 10% of 200,000 = 20,000
    const result = await tool.execute!({ orderTotal: 200000, requestedDiscount: 35000 }, {} as any);
    expect(result.approved).toBe(false);
    expect(result.allowedDiscount).toBe(20000);
    expect(result.reason?.includes('vượt quá')).toBeTruthy();
  });

  it('should reject when shop policy does not allow discounts', async () => {
    const tool = createEvaluateDiscountTool({
      discountGuardService,
      policy: undefined,
    });

    const result = await tool.execute!({ orderTotal: 200000, requestedDiscount: 10000 }, {} as any);
    expect(result.approved).toBe(false);
    expect(result.allowedDiscount).toBe(0);
  });
});
