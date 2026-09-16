import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DomainEvent, MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { MessagesService } from '../../omnichannel/messages/messages.service';

export interface OrderPaidListenerPayload {
  workspaceId: string;
  orderId: string;
  orderNumber?: string;
  displayId: number;
  conversationId?: string | null;
  paidAmount: number;
  receivedAmount?: number;
  paymentMethod?: string;
  transactionCode?: string | null;
  gateway?: string;
  overpaidAmount?: number;
  isOverpaid?: boolean;
}

@Injectable()
export class CommerceEventListener {
  private readonly logger = new Logger(CommerceEventListener.name);

  constructor(private readonly messagesService: MessagesService) {}

  @OnEvent(DomainEvent.ORDER_PAID)
  @OnEvent('order.paid')
  async handleOrderPaid(payload: OrderPaidListenerPayload): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_PAID post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    // 1. Post Receipt / Activity Message into Conversation Thread
    if (payload.conversationId) {
      try {
        const formattedAmount = new Intl.NumberFormat('vi-VN').format(
          payload.receivedAmount || payload.paidAmount || 0,
        );
        const gatewayLabel = payload.gateway ? payload.gateway.toUpperCase() : 'VietQR';
        const txCodeSnippet = payload.transactionCode ? ` (Mã GD: ${payload.transactionCode})` : '';

        const content = `✅ [Hệ thống] Đã nhận thanh toán ${formattedAmount}đ qua ${gatewayLabel} cho đơn hàng #${payload.displayId}${txCodeSnippet}.`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined, // Strictly undefined for SYSTEM sender validation
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'PAYMENT_RECEIPT',
            orderId: payload.orderId,
            displayId: payload.displayId,
            paidAmount: payload.paidAmount,
            transactionCode: payload.transactionCode || null,
            gateway: payload.gateway || null,
            isOverpaid: payload.isOverpaid || false,
            overpaidAmount: payload.overpaidAmount || 0,
          },
        });

        this.logger.log(
          `Posted payment receipt activity message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post payment receipt message for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }

  @OnEvent(DomainEvent.ORDER_PARTIALLY_PAID)
  @OnEvent('order.partially_paid')
  async handleOrderPartiallyPaid(payload: {
    workspaceId: string;
    orderId: string;
    orderNumber?: string;
    displayId: number;
    conversationId?: string | null;
    paidAmount: number;
    receivedAmount?: number;
    totalAmount: number;
    remainingAmount: number;
    paymentMethod?: string;
    transactionCode?: string | null;
    gateway?: string;
  }): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_PARTIALLY_PAID post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    if (payload.conversationId) {
      try {
        const formattedReceived = new Intl.NumberFormat('vi-VN').format(
          payload.receivedAmount || payload.paidAmount || 0,
        );
        const formattedRemaining = new Intl.NumberFormat('vi-VN').format(
          payload.remainingAmount || 0,
        );
        const gatewayLabel = payload.gateway ? payload.gateway.toUpperCase() : 'VietQR';
        const txCodeSnippet = payload.transactionCode ? ` (Mã GD: ${payload.transactionCode})` : '';

        const content = `✅ [Hệ thống] Đã nhận thanh toán một phần ${formattedReceived}đ (Còn lại: ${formattedRemaining}đ) qua ${gatewayLabel} cho đơn hàng #${payload.displayId}${txCodeSnippet}.`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined, // Strictly undefined for SYSTEM sender validation
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'PAYMENT_RECEIPT',
            status: 'PARTIALLY_PAID',
            orderId: payload.orderId,
            displayId: payload.displayId,
            paidAmount: payload.paidAmount,
            receivedAmount: payload.receivedAmount,
            remainingAmount: payload.remainingAmount,
            transactionCode: payload.transactionCode || null,
            gateway: payload.gateway || null,
          },
        });

        this.logger.log(
          `Posted partial payment receipt activity message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post partial payment receipt for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }

  @OnEvent(DomainEvent.ORDER_SHIPPED)
  @OnEvent('order.shipped')
  async handleOrderShipped(payload: {
    workspaceId: string;
    orderId: string;
    orderNumber?: string;
    displayId: number;
    conversationId?: string | null;
    trackingCode: string;
    shippingCarrier: string;
    shippedAt?: string | Date;
  }): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_SHIPPED post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    if (payload.conversationId) {
      try {
        const carrierLabel = payload.shippingCarrier || 'Đơn vị vận chuyển';
        const trackingSnippet = payload.trackingCode ? ` Mã vận đơn: ${payload.trackingCode}.` : '';
        const content = `🚚 [Hệ thống] Đơn hàng #${payload.displayId} đã được xuất kho và bàn giao cho ${carrierLabel}.${trackingSnippet}`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined,
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'ORDER_SHIPPED',
            orderId: payload.orderId,
            displayId: payload.displayId,
            trackingCode: payload.trackingCode,
            shippingCarrier: payload.shippingCarrier,
          },
        });

        this.logger.log(
          `Posted order shipped activity message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post order shipped message for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }

  @OnEvent(DomainEvent.ORDER_CONFIRMED)
  @OnEvent('order.confirmed')
  async handleOrderConfirmed(payload: {
    workspaceId: string;
    orderId: string;
    orderNumber?: string;
    displayId: number;
    conversationId?: string | null;
    order?: Record<string, any>;
    confirmedAt?: string | Date;
  }): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_CONFIRMED post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    if (payload.conversationId) {
      try {
        const total = payload.order?.totalAmount
          ? new Intl.NumberFormat('vi-VN').format(Number(payload.order.totalAmount)) + 'đ'
          : '';
        const totalSnippet = total ? ` (Tổng tiền: ${total})` : '';
        const content = `📦 [Hệ thống] Đơn hàng #${payload.displayId} đã được chốt và xác nhận${totalSnippet}.`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined,
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'ORDER_SUMMARY',
            orderId: payload.orderId,
            displayId: payload.displayId,
            orderNumber: payload.orderNumber,
            totalAmount: payload.order?.totalAmount,
            itemsCount: Array.isArray(payload.order?.items)
              ? payload.order.items.length
              : undefined,
          },
        });

        this.logger.log(
          `Posted order confirmed summary message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post order confirmed message for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }

  @OnEvent(DomainEvent.ORDER_COMPLETED)
  @OnEvent('order.completed')
  async handleOrderCompleted(payload: {
    workspaceId: string;
    orderId: string;
    orderNumber?: string;
    displayId: number;
    conversationId?: string | null;
    completedAt?: string | Date;
  }): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_COMPLETED post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    if (payload.conversationId) {
      try {
        const content = `🎉 [Hệ thống] Đơn hàng #${payload.displayId} đã giao thành công và hoàn tất.`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined,
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'ORDER_COMPLETED',
            orderId: payload.orderId,
            displayId: payload.displayId,
            orderNumber: payload.orderNumber,
          },
        });

        this.logger.log(
          `Posted order completed message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post order completed message for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }

  @OnEvent(DomainEvent.ORDER_CANCELLED)
  @OnEvent('order.cancelled')
  async handleOrderCancelled(payload: {
    workspaceId: string;
    orderId: string;
    orderNumber?: string;
    displayId: number;
    conversationId?: string | null;
    cancelReason?: string | null;
  }): Promise<void> {
    if (!payload?.workspaceId || !payload?.orderId) {
      return;
    }

    this.logger.log(
      `Handling ORDER_CANCELLED post-commit side-effects for Order #${payload.displayId} (ID: ${payload.orderId})`,
    );

    if (payload.conversationId) {
      try {
        const reasonSnippet = payload.cancelReason ? ` Lý do: ${payload.cancelReason}.` : '';
        const content = `❌ [Hệ thống] Đơn hàng #${payload.displayId} đã bị hủy.${reasonSnippet}`;

        await this.messagesService.create(payload.workspaceId, payload.conversationId, {
          content,
          senderType: SenderType.SYSTEM,
          senderId: undefined,
          messageType: MessageType.ACTIVITY,
          metadata: {
            type: 'ORDER_CANCELLED',
            orderId: payload.orderId,
            displayId: payload.displayId,
            orderNumber: payload.orderNumber,
            cancelReason: payload.cancelReason || null,
          },
        });

        this.logger.log(
          `Posted order cancelled message to conversation ${payload.conversationId} for Order #${payload.displayId}`,
        );
      } catch (msgErr: any) {
        this.logger.error(
          `Failed to post order cancelled message for Order #${payload.displayId}: ${msgErr.message}`,
          msgErr.stack,
        );
      }
    }
  }
}

export const PosEventListener = CommerceEventListener;
