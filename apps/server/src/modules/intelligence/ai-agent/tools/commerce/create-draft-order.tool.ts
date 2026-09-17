import { tool, type Tool } from 'ai';
import { z } from 'zod';
import {
  normalizeVietnamesePhone,
  isValidVietnamesePhone,
  type InboxAiCommercePolicyConfig,
} from '@sales-copilot/shared-contracts';
import type { OrdersService } from '../../../../commerce/orders/orders.service';
import type { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import type { DiscountGuardService } from '../../services/discount-guard.service';

export interface CreateDraftOrderToolOptions {
  workspaceId: string;
  conversationId?: string;
  ordersService: OrdersService;
  discountGuardService: DiscountGuardService;
  prisma: PrismaService;
  policy?: InboxAiCommercePolicyConfig;
}

export const createDraftOrderInputSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z
          .string()
          .describe('ID của biến thể sản phẩm (variantId, ví dụ từ kết quả searchProducts)'),
        quantity: z
          .number()
          .int()
          .positive()
          .describe('Số lượng mua của biến thể này (tối thiểu là 1)'),
      }),
    )
    .min(1)
    .describe('Danh sách các sản phẩm cần đặt trong đơn hàng'),
  shippingAddress: z
    .object({
      recipientName: z.string().optional().describe('Tên người nhận hàng'),
      phoneNumber: z.string().optional().describe('Số điện thoại người nhận hàng'),
      province: z.string().optional().describe('Tỉnh hoặc Thành phố trực thuộc trung ương'),
      district: z.string().optional().describe('Quận hoặc Huyện / Thị xã'),
      ward: z.string().optional().describe('Phường hoặc Xã / Thị trấn'),
      streetAddress: z
        .string()
        .optional()
        .describe('Địa chỉ chi tiết (số nhà, ngõ ngách, tên đường phố)'),
    })
    .optional()
    .describe('Thông tin địa chỉ giao hàng đầy đủ'),
  contactPhone: z.string().optional().describe('Số điện thoại liên hệ của khách hàng đặt đơn'),
  discountAmount: z
    .number()
    .min(0)
    .optional()
    .describe('Số tiền giảm giá (VND) đã được shop chấp thuận (nếu có)'),
  shippingFee: z.number().min(0).optional().describe('Phí giao hàng (VND) nếu có (mặc định 0)'),
  customerNote: z.string().optional().describe('Ghi chú của khách hàng khi đặt hàng (nếu có)'),
});

export type CreateDraftOrderInput = z.infer<typeof createDraftOrderInputSchema>;

export function createCreateDraftOrderTool({
  workspaceId,
  conversationId,
  ordersService,
  discountGuardService,
  prisma,
  policy,
}: CreateDraftOrderToolOptions): Tool {
  return tool({
    description:
      'Tạo đơn hàng nháp (DRAFT) cho khách hàng với các sản phẩm đã chọn, địa chỉ giao hàng và số tiền giảm giá (nếu có).',
    inputSchema: createDraftOrderInputSchema,
    execute: async ({
      items,
      shippingAddress,
      contactPhone,
      discountAmount = 0,
      shippingFee = 0,
      customerNote,
    }: CreateDraftOrderInput) => {
      try {
        const client = prisma.getClient();
        const variantIds = Array.from(new Set(items.map(i => i.variantId)));

        // 1. Security Price & Existence Resolution from DB (Never trust LLM prices)
        const variants = await client.productVariant.findMany({
          where: {
            id: { in: variantIds },
            workspaceId,
          },
          include: {
            product: {
              select: { id: true, name: true, basePrice: true, isActive: true },
            },
          },
        });

        if (variants.length !== variantIds.length) {
          const foundIds = new Set(variants.map(v => v.id));
          const missingIds = variantIds.filter(id => !foundIds.has(id));
          return {
            error: 'VARIANT_NOT_FOUND',
            missingVariantIds: missingIds,
            message: 'Một số sản phẩm không tồn tại hoặc không thuộc cửa hàng này',
          };
        }

        const variantMap = new Map(variants.map(v => [v.id, v]));

        // Check if any variant or product is inactive
        for (const item of items) {
          const v = variantMap.get(item.variantId)!;
          if (!v.isActive || !v.product.isActive) {
            return {
              error: 'PRODUCT_INACTIVE',
              variantId: item.variantId,
              message: `Sản phẩm "${v.product.name} - ${v.name}" hiện đã ngừng kinh doanh`,
            };
          }
        }

        // 2. Pre-check stock availability
        for (const item of items) {
          const v = variantMap.get(item.variantId)!;
          const availableStock = Math.max(0, v.stockQuantity - v.reservedQuantity);
          if (availableStock < item.quantity) {
            return {
              error: 'INSUFFICIENT_STOCK',
              variantId: item.variantId,
              variantName: v.name,
              productName: v.product.name,
              requestedQuantity: item.quantity,
              availableStock,
              message: `Sản phẩm "${v.product.name} - ${v.name}" chỉ còn ${availableStock} sản phẩm trong kho, không đủ số lượng ${item.quantity} yêu cầu`,
            };
          }
        }

        // 3. Calculate true subtotal and build order items with verified DB prices
        let calculatedSubtotal = 0;
        const verifiedItems = items.map(item => {
          const v = variantMap.get(item.variantId)!;
          const unitPrice = Number(v.price ?? v.product.basePrice);
          calculatedSubtotal += unitPrice * item.quantity;
          return {
            productId: v.productId,
            variantId: v.id,
            quantity: item.quantity,
            unitPrice,
          };
        });

        // 4. Double-check discount limits
        if (discountAmount > 0) {
          const discountEval = discountGuardService.evaluate(
            calculatedSubtotal,
            discountAmount,
            policy,
          );
          if (!discountEval.approved) {
            return {
              error: 'DISCOUNT_LIMIT_EXCEEDED',
              requestedDiscount: discountAmount,
              allowedDiscount: discountEval.allowedDiscount,
              message:
                discountEval.reason ||
                `Mức giảm giá ${discountAmount.toLocaleString('vi-VN')}đ vượt quá hạn mức tối đa cho phép`,
            };
          }
        }

        // 5. Contact Resolution strictly scoped to workspace
        let contactId: string | undefined;
        let conv: any = null;

        if (conversationId) {
          conv = await client.conversation.findFirst({
            where: { id: conversationId, workspaceId },
            select: { id: true, contactId: true },
          });
          contactId = conv?.contactId || undefined;
        }

        const rawPhone = contactPhone || shippingAddress?.phoneNumber;
        let e164Phone: string | undefined;
        if (rawPhone) {
          const normalized = normalizeVietnamesePhone(rawPhone);
          if (isValidVietnamesePhone(normalized)) {
            e164Phone = normalized.startsWith('0') ? `+84${normalized.slice(1)}` : normalized;
          }
        }

        if (!contactId && e164Phone) {
          const existingContact = await client.contact.findFirst({
            where: { workspaceId, phoneNumber: e164Phone },
          });
          if (existingContact) {
            contactId = existingContact.id;
          }
        }

        if (!contactId) {
          const recipientName = shippingAddress?.recipientName || 'Khách hàng';
          const newContact = await client.contact.create({
            data: {
              workspaceId,
              name: recipientName,
              phoneNumber: e164Phone || null,
              source: 'AI_AGENT',
              customAttributes: shippingAddress
                ? {
                    address: [
                      shippingAddress.streetAddress,
                      shippingAddress.ward,
                      shippingAddress.district,
                      shippingAddress.province,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  }
                : {},
            },
          });
          contactId = newContact.id;
        }

        // Link contact to conversation if conversation exists and didn't have one
        if (conv && !conv.contactId && contactId) {
          await client.conversation.updateMany({
            where: { id: conv.id, workspaceId },
            data: { contactId },
          });
        }

        // 6. Create Draft Order via OrdersService
        const order = await ordersService.createOrder(workspaceId, {
          contactId,
          conversationId: conv?.id || undefined,
          items: verifiedItems,
          discountAmount,
          shippingFee,
          customerNotes: customerNote || undefined,
          shippingAddress: shippingAddress
            ? {
                recipientName: shippingAddress.recipientName || 'Khách hàng',
                phoneNumber: shippingAddress.phoneNumber || rawPhone || '0000000000',
                province: shippingAddress.province || '',
                district: shippingAddress.district || '',
                ward: shippingAddress.ward || '',
                streetAddress: shippingAddress.streetAddress || '',
              }
            : undefined,
          metadata: {
            source: 'AI_AGENT',
            conversationId: conv?.id || null,
          },
        });

        return {
          orderId: order.id,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          totalAmount: order.totalAmount,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          status: 'DRAFT',
          items: (order.items || []).map(i => ({
            variantId: i.variantId,
            productName: i.productName,
            variantName: i.variantName,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
          })),
          shippingAddress: order.shippingAddress
            ? {
                recipientName: order.shippingAddress.recipientName,
                phoneNumber: order.shippingAddress.phoneNumber,
                province: order.shippingAddress.province,
                district: order.shippingAddress.district,
                ward: order.shippingAddress.ward,
                streetAddress: order.shippingAddress.streetAddress,
              }
            : null,
        };
      } catch (error: any) {
        return {
          error: 'CREATE_DRAFT_ORDER_FAILED',
          message: error?.message || 'Không thể tạo đơn hàng nháp lúc này',
        };
      }
    },
  });
}
