import { Injectable } from '@nestjs/common';
import type { InboxAiCommercePolicyConfig } from '@sales-copilot/shared-contracts';

export interface DiscountEvaluationResult {
  approved: boolean;
  allowedDiscount: number;
  reason?: string;
}

@Injectable()
export class DiscountGuardService {
  /**
   * Evaluates if a requested discount is permissible under the workspace/inbox policy.
   * Business rule:
   * maxAllowed = min(orderTotal * maxDiscountPercent / 100, maxDiscountVnd)
   * If policy is missing or both limits are 0/undefined, maxAllowed = 0 (no discount permitted).
   */
  evaluate(
    orderTotal: number,
    requestedDiscount: number,
    policy?: InboxAiCommercePolicyConfig,
  ): DiscountEvaluationResult {
    if (orderTotal <= 0) {
      return {
        approved: false,
        allowedDiscount: 0,
        reason: 'Tổng giá trị đơn hàng không hợp lệ',
      };
    }

    if (requestedDiscount <= 0) {
      return {
        approved: true,
        allowedDiscount: 0,
        reason: 'Không yêu cầu giảm giá',
      };
    }

    const maxPercent = policy?.maxDiscountPercent ?? 0;
    const maxVnd = policy?.maxDiscountVnd ?? 0;

    // If both are 0 or not set, no discounts are permitted by shop
    if (maxPercent <= 0 && maxVnd <= 0) {
      return {
        approved: false,
        allowedDiscount: 0,
        reason: 'Cửa hàng không áp dụng chính sách giảm giá qua AI',
      };
    }

    let percentLimit = Number.POSITIVE_INFINITY;
    if (maxPercent > 0) {
      percentLimit = Math.floor((orderTotal * maxPercent) / 100);
    }

    let vndLimit = Number.POSITIVE_INFINITY;
    if (maxVnd > 0) {
      vndLimit = maxVnd;
    }

    const maxAllowed = Math.min(percentLimit, vndLimit);
    const effectiveMaxAllowed = maxAllowed === Number.POSITIVE_INFINITY ? 0 : maxAllowed;

    if (requestedDiscount <= effectiveMaxAllowed) {
      return {
        approved: true,
        allowedDiscount: requestedDiscount,
        reason: 'Mức giảm giá nằm trong hạn mức cho phép',
      };
    }

    return {
      approved: false,
      allowedDiscount: effectiveMaxAllowed,
      reason: `Mức giảm giá yêu cầu (${requestedDiscount.toLocaleString('vi-VN')}đ) vượt quá hạn mức tối đa cho phép (${effectiveMaxAllowed.toLocaleString('vi-VN')}đ)`,
    };
  }
}
