import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { OrderStatus, SenderType } from '@sales-copilot/shared-contracts';
import type { OrdersService } from '../../../../commerce/orders/orders.service';
import type { VietQrService } from '../../../../commerce/payments/vietqr.service';
import type { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import type { MessagesService } from '../../../../omnichannel/messages/messages.service';

export interface ConfirmAndGenerateQrToolOptions {
  workspaceId: string;
  conversationId?: string;
  ordersService: OrdersService;
  vietQrService: VietQrService;
  prisma: PrismaService;
  messagesService?: MessagesService;
}

export const confirmAndGenerateQrInputSchema = z.object({
  orderId: z.string().describe('ID của đơn hàng (orderId) cần xác nhận và sinh mã QR'),
});

export type ConfirmAndGenerateQrInput = z.infer<typeof confirmAndGenerateQrInputSchema>;

export function createConfirmAndGenerateQrTool({
  workspaceId,
  conversationId,
  ordersService,
  vietQrService,
  prisma,
  messagesService,
}: ConfirmAndGenerateQrToolOptions): Tool {
  return tool({
    description:
      'Xác nhận đơn hàng (chuyển trạng thái từ DRAFT sang CONFIRMED, khóa tồn kho) và sinh mã QR thanh toán VietQR (NAPAS 247) để gửi cho khách hàng.',
    inputSchema: confirmAndGenerateQrInputSchema,
    execute: async ({ orderId }: ConfirmAndGenerateQrInput) => {
      try {
        const client = prisma.getClient();

        // 1. Fetch order strictly scoped to workspace
        const order = await client.order.findFirst({
          where: { id: orderId, workspaceId },
        });

        if (!order) {
          return {
            error: 'ORDER_NOT_FOUND',
            message: `Không tìm thấy đơn hàng với ID '${orderId}' trong cửa hàng`,
          };
        }

        if (order.status === OrderStatus.PAID) {
          return {
            error: 'ORDER_ALREADY_PAID',
            message: `Đơn hàng #${order.displayId} đã được thanh toán thành công trước đó`,
          };
        }

        if (order.status === OrderStatus.CANCELLED) {
          return {
            error: 'ORDER_CANCELLED',
            message: `Đơn hàng #${order.displayId} đã bị hủy`,
          };
        }

        // 2. Transition status: Only confirm if in DRAFT status (Idempotency guarantee)
        if (order.status === OrderStatus.DRAFT) {
          await ordersService.confirmOrder(workspaceId, orderId);
        }

        // 3. Generate VietQR EMVCo payload & image URL
        const memo = `DH${order.displayId || order.orderNumber.replace(/[^0-9]/g, '')}`;
        const qr = await vietQrService.generateForOrder(workspaceId, orderId, { memo });

        // 4. Send interactive payment card to conversation if conversationId is provided
        const convId = conversationId || order.conversationId;
        if (convId && messagesService) {
          try {
            await messagesService.create(workspaceId, convId, {
              senderType: SenderType.SYSTEM,
              content: `Mã QR thanh toán cho đơn hàng #${order.displayId || order.orderNumber}`,
              metadata: {
                type: 'VIETQR_PAYMENT',
                qrData: {
                  qrImageUrl: qr.qrUrl,
                  qrPayload: qr.qrPayload,
                  bankName: qr.bankName,
                  accountNumber: qr.accountNumber,
                  accountName: qr.accountName,
                  amount: qr.amount,
                  transferContent: qr.transferContent,
                  orderId: order.id,
                  orderNumber: order.orderNumber,
                },
              },
            });
          } catch {
            // Non-blocking: Still return QR details to LLM
          }
        }

        return {
          orderId: qr.orderId,
          orderNumber: qr.orderNumber,
          displayId: qr.displayId,
          totalAmount: qr.amount,
          qrImageUrl: qr.qrUrl,
          qrPayload: qr.qrPayload,
          bankName: qr.bankName,
          accountNumber: qr.accountNumber,
          accountName: qr.accountName,
          transferContent: qr.transferContent,
        };
      } catch (error: any) {
        return {
          error: 'CONFIRM_AND_GENERATE_QR_FAILED',
          message: error?.message || 'Không thể xác nhận đơn hàng hoặc tạo mã VietQR lúc này',
        };
      }
    },
  });
}
