import { DiscountType } from '@sales-copilot/shared-contracts';

export interface LineItemCalculationInput {
  unitPrice: number;
  quantity: number;
  discountAmount?: number | null;
}

export interface LineItemCalculationResult {
  subtotal: number;
  discountAmount: number;
  totalPrice: number;
}

/**
 * Calculates item subtotal, discount, and final line item totalPrice.
 */
export function calculateLineItemTotals(
  input: LineItemCalculationInput,
): LineItemCalculationResult {
  const subtotal = input.unitPrice * input.quantity;
  const discountAmount = input.discountAmount || 0;
  const totalPrice = Math.max(0, subtotal - discountAmount);

  return {
    subtotal,
    discountAmount,
    totalPrice,
  };
}

export interface OrderFinancialsInput {
  subtotal: number;
  discountType?: DiscountType | string | null;
  discountAmount?: number | null;
  shippingFee?: number | null;
  existingDiscountAmount?: number | null;
  existingSubtotal?: number | null;
}

export interface OrderFinancialsResult {
  subtotal: number;
  discountAmount: number;
  discountType: DiscountType;
  shippingFee: number;
  totalAmount: number;
}

/**
 * Calculates order level financials: subtotal, discountAmount (fixed or percentage),
 * shippingFee, and totalAmount.
 */
export function calculateOrderFinancialTotals(input: OrderFinancialsInput): OrderFinancialsResult {
  const subtotal = input.subtotal;
  const resolvedDiscountType =
    input.discountType === DiscountType.PERCENTAGE
      ? DiscountType.PERCENTAGE
      : DiscountType.FIXED_AMOUNT;

  let discountAmount = 0;

  if (input.discountAmount !== undefined && input.discountAmount !== null) {
    if (resolvedDiscountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.min(
        subtotal,
        Math.round((subtotal * Math.min(100, input.discountAmount)) / 100),
      );
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, input.discountAmount));
    }
  } else if (input.existingDiscountAmount !== undefined && input.existingDiscountAmount !== null) {
    if (resolvedDiscountType === DiscountType.PERCENTAGE) {
      const origSub = Number(input.existingSubtotal || 0);
      const origPct = origSub > 0 ? (Number(input.existingDiscountAmount) * 100) / origSub : 0;
      discountAmount = Math.min(subtotal, Math.round((subtotal * Math.min(100, origPct)) / 100));
    } else {
      discountAmount = Math.min(subtotal, Math.max(0, Number(input.existingDiscountAmount)));
    }
  }

  const shippingFee = Math.max(0, input.shippingFee || 0);
  const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

  return {
    subtotal,
    discountAmount,
    discountType: resolvedDiscountType,
    shippingFee,
    totalAmount,
  };
}
