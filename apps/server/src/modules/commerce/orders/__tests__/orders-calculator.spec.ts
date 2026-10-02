import fc from 'fast-check';
import { DiscountType } from '@sales-copilot/shared-contracts';
import { calculateLineItemTotals, calculateOrderFinancialTotals } from '../orders-calculator';

// Money is VND integer math in practice; generators mirror that, with a few
// float/negative probes for the clamping paths.
const vndAmount = fc.integer({ min: 0, max: 100_000_000 });
const arbitraryDiscount = fc.integer({ min: -1_000_000, max: 100_000_000 });
const nonNegativeInt = fc.integer({ min: 0, max: 10_000 });

fc.configureGlobal({ numRuns: 200 });

describe('calculateLineItemTotals (property-based)', () => {
  it('keeps discount clamped to [0, subtotal] and totalPrice in [0, subtotal] for non-negative lines', () => {
    fc.assert(
      fc.property(vndAmount, nonNegativeInt, arbitraryDiscount, (unitPrice, quantity, discount) => {
        const r = calculateLineItemTotals({ unitPrice, quantity, discountAmount: discount });
        expect(r.discountAmount).toBeGreaterThanOrEqual(0);
        expect(r.discountAmount).toBeLessThanOrEqual(r.subtotal);
        expect(r.totalPrice).toBeGreaterThanOrEqual(0);
        expect(r.totalPrice).toBeLessThanOrEqual(r.subtotal);
      }),
    );
  });

  it('never returns a positive total when the line subtotal is non-positive', () => {
    // negative × negative multiplies back to a positive subtotal — only the
    // product decides, not either factor alone
    fc.assert(
      fc.property(
        fc.integer({ min: -100_000, max: 100_000 }),
        fc.integer({ min: -100, max: 100 }),
        arbitraryDiscount,
        (unitPrice, quantity, discount) => {
          const r = calculateLineItemTotals({ unitPrice, quantity, discountAmount: discount });
          if (r.subtotal <= 0) {
            expect(r.totalPrice).toBe(0);
            expect(r.discountAmount).toBe(r.subtotal);
          }
        },
      ),
    );
  });

  it('is non-increasing in the requested discount (monotonicity)', () => {
    fc.assert(
      fc.property(
        vndAmount,
        nonNegativeInt,
        arbitraryDiscount,
        arbitraryDiscount,
        (unitPrice, quantity, d1, d2) => {
          const [low, high] = d1 <= d2 ? [d1, d2] : [d2, d1];
          const rLow = calculateLineItemTotals({
            unitPrice,
            quantity,
            discountAmount: low,
          });
          const rHigh = calculateLineItemTotals({
            unitPrice,
            quantity,
            discountAmount: high,
          });
          expect(rHigh.totalPrice).toBeLessThanOrEqual(rLow.totalPrice);
        },
      ),
    );
  });

  it('zeroes the line when the requested discount covers the subtotal', () => {
    fc.assert(
      fc.property(vndAmount, nonNegativeInt, (unitPrice, quantity) => {
        const r = calculateLineItemTotals({
          unitPrice,
          quantity,
          discountAmount: unitPrice * quantity + 1,
        });
        expect(r.totalPrice).toBe(0);
        expect(r.discountAmount).toBe(r.subtotal);
      }),
    );
  });

  it('keeps VND integer results for integer inputs', () => {
    fc.assert(
      fc.property(vndAmount, nonNegativeInt, arbitraryDiscount, (unitPrice, quantity, discount) => {
        const r = calculateLineItemTotals({ unitPrice, quantity, discountAmount: discount });
        expect(Number.isInteger(r.subtotal)).toBe(true);
        expect(Number.isInteger(r.discountAmount)).toBe(true);
        expect(Number.isInteger(r.totalPrice)).toBe(true);
      }),
    );
  });
});

describe('calculateOrderFinancialTotals (property-based)', () => {
  const orderInput = (overrides: Record<string, unknown>) => ({
    subtotal: 0,
    discountType: DiscountType.FIXED_AMOUNT,
    discountAmount: null,
    shippingFee: 0,
    lineDiscountsTotal: 0,
    ...overrides,
  });

  it('keeps discount in [0, subtotal] and total in [0, subtotal + shippingFee]', () => {
    fc.assert(
      fc.property(
        vndAmount,
        fc.constantFrom(DiscountType.FIXED_AMOUNT, DiscountType.PERCENTAGE, 'GARBAGE'),
        arbitraryDiscount,
        nonNegativeInt,
        nonNegativeInt,
        (subtotal, discountType, discountAmount, shippingFee, lineDiscountsTotal) => {
          const r = calculateOrderFinancialTotals(
            orderInput({ subtotal, discountType, discountAmount, shippingFee, lineDiscountsTotal }),
          );
          expect(r.discountAmount).toBeGreaterThanOrEqual(0);
          expect(r.discountAmount).toBeLessThanOrEqual(r.subtotal);
          expect(r.totalAmount).toBeGreaterThanOrEqual(0);
          expect(r.totalAmount).toBeLessThanOrEqual(r.subtotal + r.shippingFee);
        },
      ),
    );
  });

  it('is non-decreasing in shippingFee (monotonicity)', () => {
    fc.assert(
      fc.property(
        vndAmount,
        arbitraryDiscount,
        fc.integer({ min: -1000, max: 1_000_000 }),
        nonNegativeInt,
        (subtotal, discountAmount, shippingFeeDelta, lineDiscountsTotal) => {
          const base = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountAmount,
              shippingFee: nonNegative(shippingFeeDelta),
              lineDiscountsTotal,
            }),
          );
          const higher = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountAmount,
              shippingFee: nonNegative(shippingFeeDelta) + Math.abs(shippingFeeDelta) + 1,
              lineDiscountsTotal,
            }),
          );
          expect(higher.totalAmount).toBeGreaterThanOrEqual(base.totalAmount);
        },
      ),
    );
  });

  it('is non-increasing in a fixed discount (monotonicity)', () => {
    fc.assert(
      fc.property(
        vndAmount,
        arbitraryDiscount,
        arbitraryDiscount,
        nonNegativeInt,
        (subtotal, d1, d2, shippingFee) => {
          const [low, high] = d1 <= d2 ? [d1, d2] : [d2, d1];
          const rLow = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountType: DiscountType.FIXED_AMOUNT,
              discountAmount: low,
              shippingFee,
            }),
          );
          const rHigh = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountType: DiscountType.FIXED_AMOUNT,
              discountAmount: high,
              shippingFee,
            }),
          );
          expect(rHigh.totalAmount).toBeLessThanOrEqual(rLow.totalAmount);
        },
      ),
    );
  });

  it('discounts the whole subtotal for percentage discounts of 100%+ (total = shippingFee)', () => {
    fc.assert(
      fc.property(
        vndAmount,
        fc.integer({ min: 100, max: 1_000_000 }),
        nonNegativeInt,
        (subtotal, pct, shippingFee) => {
          const r = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountType: DiscountType.PERCENTAGE,
              discountAmount: pct,
              shippingFee,
            }),
          );
          expect(r.discountAmount).toBe(subtotal);
          expect(r.totalAmount).toBe(r.shippingFee);
        },
      ),
    );
  });

  it('always folds in at least min(lineDiscountsTotal, subtotal) of discount for non-negative order discounts', () => {
    // a negative order-level discount (never produced by validated DTOs) would
    // cancel folded line discounts — outside this property's domain
    fc.assert(
      fc.property(
        vndAmount,
        nonNegativeInt,
        nonNegativeInt,
        fc.constantFrom(DiscountType.FIXED_AMOUNT, DiscountType.PERCENTAGE),
        (subtotal, discountAmount, lineDiscountsTotal, discountType) => {
          const r = calculateOrderFinancialTotals(
            orderInput({ subtotal, discountType, discountAmount, lineDiscountsTotal }),
          );
          expect(r.discountAmount).toBeGreaterThanOrEqual(Math.min(lineDiscountsTotal, subtotal));
        },
      ),
    );
  });

  it('rounds percentage discounts to whole VND for integer subtotals', () => {
    fc.assert(
      fc.property(vndAmount, fc.integer({ min: 0, max: 100 }), (subtotal, pct) => {
        const r = calculateOrderFinancialTotals(
          orderInput({ subtotal, discountType: DiscountType.PERCENTAGE, discountAmount: pct }),
        );
        expect(Number.isInteger(r.discountAmount)).toBe(true);
      }),
    );
  });

  it('is non-decreasing in percentage (monotonicity)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: -50, max: 150 }),
        fc.integer({ min: -50, max: 150 }),
        (subtotal, p1, p2) => {
          const [low, high] = p1 <= p2 ? [p1, p2] : [p2, p1];
          const rLow = calculateOrderFinancialTotals(
            orderInput({ subtotal, discountType: DiscountType.PERCENTAGE, discountAmount: low }),
          );
          const rHigh = calculateOrderFinancialTotals(
            orderInput({ subtotal, discountType: DiscountType.PERCENTAGE, discountAmount: high }),
          );
          expect(rHigh.discountAmount).toBeGreaterThanOrEqual(rLow.discountAmount);
        },
      ),
    );
  });

  it('is stable when the computed fixed discount is fed back in (no drift on order updates)', () => {
    fc.assert(
      fc.property(
        vndAmount,
        arbitraryDiscount,
        nonNegativeInt,
        (subtotal, discountAmount, shippingFee) => {
          const first = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountType: DiscountType.FIXED_AMOUNT,
              discountAmount,
              shippingFee,
            }),
          );
          const second = calculateOrderFinancialTotals(
            orderInput({
              subtotal,
              discountType: DiscountType.FIXED_AMOUNT,
              discountAmount: first.discountAmount,
              shippingFee,
            }),
          );
          expect(second.discountAmount).toBe(first.discountAmount);
          expect(second.totalAmount).toBe(first.totalAmount);
        },
      ),
    );
  });

  function nonNegative(n: number): number {
    return Math.max(0, n);
  }
});

describe('calculateOrderFinancialTotals (worked examples — fixed literals)', () => {
  it('computes a standard order: subtotal 750000, 15%, fee 30000', () => {
    expect(
      calculateOrderFinancialTotals({
        subtotal: 750_000,
        discountType: DiscountType.PERCENTAGE,
        discountAmount: 15,
        shippingFee: 30_000,
      }),
    ).toEqual({
      subtotal: 750_000,
      discountAmount: 112_500,
      discountType: DiscountType.PERCENTAGE,
      shippingFee: 30_000,
      totalAmount: 667_500,
    });
  });

  it('re-derives the original percentage when only existing discount is given', () => {
    // existing 50000/750000 = 6.667% applied to the new subtotal 300000 → 20000
    expect(
      calculateOrderFinancialTotals({
        subtotal: 300_000,
        discountType: DiscountType.PERCENTAGE,
        existingDiscountAmount: 50_000,
        existingSubtotal: 750_000,
      }).discountAmount,
    ).toBe(20_000);
  });

  it('folds line discounts into the order discount and clamps to the subtotal', () => {
    expect(
      calculateOrderFinancialTotals({
        subtotal: 100_000,
        discountType: DiscountType.FIXED_AMOUNT,
        discountAmount: 30_000,
        lineDiscountsTotal: 20_000,
      }).discountAmount,
    ).toBe(50_000);
    expect(
      calculateOrderFinancialTotals({
        subtotal: 100_000,
        discountType: DiscountType.FIXED_AMOUNT,
        discountAmount: 90_000,
        lineDiscountsTotal: 50_000,
      }).discountAmount,
    ).toBe(100_000);
  });

  it('honors an explicit discountAmount of 0 even when an existing discount is present', () => {
    // explicit 0 must win over the existing-discount fallback (nullish check, not truthiness)
    expect(
      calculateOrderFinancialTotals({
        subtotal: 100_000,
        discountType: DiscountType.FIXED_AMOUNT,
        discountAmount: 0,
        existingDiscountAmount: 50_000,
      }).discountAmount,
    ).toBe(0);
  });

  it('clamps negative shipping fees and unknown discount types to fixed amount', () => {
    const r = calculateOrderFinancialTotals({
      subtotal: 100_000,
      discountType: 'WHATEVER',
      discountAmount: 10_000,
      shippingFee: -5_000,
    });
    expect(r.shippingFee).toBe(0);
    expect(r.discountType).toBe(DiscountType.FIXED_AMOUNT);
    expect(r.totalAmount).toBe(90_000);
  });
});
