import { DiscountGuardService } from '../discount-guard.service';

describe('DiscountGuardService', () => {
  let service: DiscountGuardService;

  beforeEach(() => {
    service = new DiscountGuardService();
  });

  it('should reject when orderTotal <= 0', () => {
    const result = service.evaluate(0, 50000, { enabled: true, maxDiscountPercent: 10 });
    expect(result.approved).toBe(false);
    expect(result.allowedDiscount).toBe(0);
    expect(result.reason?.includes('không hợp lệ')).toBeTruthy();
  });

  it('should approve when requestedDiscount <= 0', () => {
    const result = service.evaluate(200000, 0, { enabled: true, maxDiscountPercent: 10 });
    expect(result.approved).toBe(true);
    expect(result.allowedDiscount).toBe(0);
  });

  it('should reject when no discount policy is configured', () => {
    const result1 = service.evaluate(200000, 20000, undefined);
    expect(result1.approved).toBe(false);
    expect(result1.allowedDiscount).toBe(0);

    const result2 = service.evaluate(200000, 20000, { enabled: true });
    expect(result2.approved).toBe(false);
    expect(result2.allowedDiscount).toBe(0);
  });

  it('should enforce percentage discount cap correctly', () => {
    // 10% of 200,000 = 20,000
    const policy = { enabled: true, maxDiscountPercent: 10 };

    const withinLimit = service.evaluate(200000, 15000, policy);
    expect(withinLimit.approved).toBe(true);
    expect(withinLimit.allowedDiscount).toBe(15000);

    const exactLimit = service.evaluate(200000, 20000, policy);
    expect(exactLimit.approved).toBe(true);
    expect(exactLimit.allowedDiscount).toBe(20000);

    const exceedLimit = service.evaluate(200000, 25000, policy);
    expect(exceedLimit.approved).toBe(false);
    expect(exceedLimit.allowedDiscount).toBe(20000);
    expect(exceedLimit.reason?.includes('vượt quá')).toBeTruthy();
  });

  it('should enforce fixed VND discount cap correctly', () => {
    const policy = { enabled: true, maxDiscountVnd: 50000 };

    const withinLimit = service.evaluate(1000000, 40000, policy);
    expect(withinLimit.approved).toBe(true);
    expect(withinLimit.allowedDiscount).toBe(40000);

    const exceedLimit = service.evaluate(1000000, 60000, policy);
    expect(exceedLimit.approved).toBe(false);
    expect(exceedLimit.allowedDiscount).toBe(50000);
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
    expect(withinLimit.approved).toBe(true);
    expect(withinLimit.allowedDiscount).toBe(50000);

    const exceedLimit = service.evaluate(1000000, 60000, policy);
    expect(exceedLimit.approved).toBe(false);
    expect(exceedLimit.allowedDiscount).toBe(50000);

    // For a smaller order: 200,000. 10% is 20,000, which is < 50,000.
    // So effective cap is 20,000.
    const smallOrderExceed = service.evaluate(200000, 30000, policy);
    expect(smallOrderExceed.approved).toBe(false);
    expect(smallOrderExceed.allowedDiscount).toBe(20000);
  });
});
