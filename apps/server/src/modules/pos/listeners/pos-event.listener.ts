import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  MessageType,
  OpportunityStage,
  SenderType,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { MessagesService } from '../../messages/messages.service';
import { OpportunitiesService } from '../../opportunities/opportunities.service';

export interface OrderPaidListenerPayload {
  workspaceId: string;
  orderId: string;
  orderNumber?: string;
  displayId: number;
  conversationId?: string | null;
  opportunityId?: string | null;
  paidAmount: number;
  receivedAmount?: number;
  paymentMethod?: string;
  transactionCode?: string | null;
  gateway?: string;
  overpaidAmount?: number;
  isOverpaid?: boolean;
}

@Injectable()
export class PosEventListener {
  private readonly logger = new Logger(PosEventListener.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly opportunitiesService: OpportunitiesService,
  ) {}

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

    // 2. Synchronize CRM Opportunity to CLOSED_WON
    if (payload.opportunityId) {
      try {
        await this.opportunitiesService.updateStage(
          payload.workspaceId,
          payload.opportunityId,
          { stage: OpportunityStage.CLOSED_WON },
          WorkspaceRole.ADMIN,
        );

        this.logger.log(
          `Successfully transitioned Opportunity ${payload.opportunityId} to CLOSED_WON for Order #${payload.displayId}`,
        );
      } catch (oppErr: any) {
        this.logger.error(
          `Failed to transition Opportunity ${payload.opportunityId} to CLOSED_WON for Order #${payload.displayId}: ${oppErr.message}`,
          oppErr.stack,
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
}
