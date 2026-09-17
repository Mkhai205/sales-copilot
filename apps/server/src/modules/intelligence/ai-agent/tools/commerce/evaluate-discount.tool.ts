import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { InboxAiCommercePolicyConfig } from '@sales-copilot/shared-contracts';
import type { DiscountGuardService } from '../../services/discount-guard.service';

export interface EvaluateDiscountToolOptions {
  discountGuardService: DiscountGuardService;
  policy?: InboxAiCommercePolicyConfig;
}

export const evaluateDiscountInputSchema = z.object({
  orderTotal: z.number().positive().describe('Tổng giá trị đơn hàng trước khi giảm giá (VND)'),
  requestedDiscount: z.number().min(0).describe('Số tiền giảm giá khách hàng yêu cầu (VND)'),
});

export type EvaluateDiscountInput = z.infer<typeof evaluateDiscountInputSchema>;

export function createEvaluateDiscountTool({
  discountGuardService,
  policy,
}: EvaluateDiscountToolOptions): Tool {
  return tool({
    description:
      'Kiểm tra xem một mức giảm giá khách yêu cầu có nằm trong hạn mức cho phép của cửa hàng hay không. Trả về kết quả phê duyệt (approved) và số tiền giảm tối đa được phép (allowedDiscount).',
    inputSchema: evaluateDiscountInputSchema,
    execute: async ({ orderTotal, requestedDiscount }: EvaluateDiscountInput) => {
      try {
        const result = discountGuardService.evaluate(orderTotal, requestedDiscount, policy);
        return result;
      } catch (error: any) {
        return {
          approved: false,
          allowedDiscount: 0,
          error: 'EVALUATE_DISCOUNT_FAILED',
          reason: error?.message || 'Không thể đánh giá mức giảm giá',
        };
      }
    },
  });
}
