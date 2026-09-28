import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  type ManualMatchTransactionDto,
  type PaymentTransactionResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { StockMovementService } from '../inventory/stock-movement.service';
import {
  buildPaymentLockKey,
  isInFulfillmentOrCompleted,
  toLedgerItems,
} from './reconciliation-shared';

@Injectable()
export class ManualMatchService {
  private readonly logger = new Logger(ManualMatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stockMovementService: StockMovementService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Manually match an unlinked PENDING transaction to an Order
   */
  async manualMatchTransaction(
    workspaceId: string,
    transactionId: string,
    dto: ManualMatchTransactionDto,
    userId: string,
  ): Promise<{ success: boolean; transaction: PaymentTransactionResponseDto; order: any }> {
    const client = this.prisma.getClient();

    const transaction = await client.paymentTransaction.findFirst({
      where: { id: transactionId, workspaceId },
    });

    if (!transaction) {
      throw new NotFoundException({
        code: 'TRANSACTION_NOT_FOUND',
        message: `Giao dịch ngân hàng '${transactionId}' không tồn tại trong workspace`,
      });
    }

    if (transaction.status !== PaymentTransactionStatus.PENDING) {
      throw new BadRequestException({
        code: 'TRANSACTION_ALREADY_PROCESSED',
        message: `Giao dịch đã ở trạng thái ${transaction.status}, không thể gán đơn thủ công`,
      });
    }

    const targetOrder = await client.order.findFirst({
      where: { id: dto.orderId, workspaceId },
      include: { items: true },
    });

    if (!targetOrder) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: `Đơn hàng '${dto.orderId}' không tồn tại trong workspace`,
      });
    }

    if (targetOrder.status === OrderStatus.CANCELLED) {
      throw new BadRequestException({
        code: 'CANNOT_MATCH_CANCELLED_ORDER',
        message: `Đơn hàng #${targetOrder.displayId} đã bị hủy, không thể đối soát`,
      });
    }

    const lockKey = buildPaymentLockKey(workspaceId, targetOrder.id);
    const lockToken = await this.redisService.acquireLock(lockKey, 10000);

    if (!lockToken) {
      throw new BadRequestException({
        code: 'ORDER_CONCURRENT_LOCK',
        message: 'Đang có tiến trình khác xử lý đơn hàng này, vui lòng thử lại sau giây lát',
      });
    }

    try {
      return await this.prisma.runInTransaction(async ctx => {
        const tx = ctx.tx;

        const order = await tx.order.findFirst({
          where: { id: targetOrder.id, workspaceId },
          include: { items: true },
        });

        if (!order) {
          throw new NotFoundException('Đơn hàng không tồn tại');
        }

        const amount = Number(transaction.amount);
        const previousPaid = Number(order.paidAmount || 0);
        const totalPaid = previousPaid + amount;
        const orderTotal = Number(order.totalAmount);
        const isFullyPaid = totalPaid >= orderTotal;
        const wasAlreadyPaid = order.status === OrderStatus.PAID;
        const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;

        // Status guard for SHIPPING or COMPLETED (mirrors the auto matcher):
        // If order is already in fulfillment or completed, do NOT deduct inventory again or
        // regress order status — record the payment only.
        const inFulfillmentOrCompleted = isInFulfillmentOrCompleted(order.status);

        if (inFulfillmentOrCompleted) {
          this.logger.log(
            `Order #${order.displayId} has status '${order.status}'. Manual-matched payment of ${amount} recorded without stock deduction or status regression.`,
          );
        }

        // Stock commit if fully paid & Model A (sale commit)
        if (isFullyPaid && !wasAlreadyPaid && !inFulfillmentOrCompleted) {
          const commitItems = toLedgerItems(order.items);

          await this.stockMovementService.commitStock({
            workspaceId,
            items: commitItems,
            orderId: order.id,
            orderDisplayId: order.displayId,
            orderNumber: order.orderNumber,
            isPreviouslyReserved: isPreviouslyConfirmed,
            reason: `Manual match payment via ${transaction.gateway} for Order #${order.displayId}`,
            tx,
          });
        }

        // Update PaymentTransaction
        const updatedTx = await tx.paymentTransaction.update({
          where: { id: transaction.id },
          data: {
            orderId: order.id,
            status: PaymentTransactionStatus.SUCCESS,
            paidAt: new Date(),
          },
        });

        // Update Order status and financial totals
        const targetPaymentStatus = isFullyPaid ? PaymentStatus.PAID : PaymentStatus.PARTIALLY_PAID;
        const targetOrderStatus =
          isFullyPaid && !inFulfillmentOrCompleted ? OrderStatus.PAID : order.status;

        await tx.order.updateMany({
          where: { id: order.id, workspaceId },
          data: {
            paidAmount: totalPaid,
            paymentStatus: targetPaymentStatus,
            ...(targetOrderStatus !== order.status ? { status: targetOrderStatus } : {}),
            ...(isFullyPaid ? { paidAt: order.paidAt || new Date() } : {}),
          },
        });

        // Record Audit Log
        await tx.auditLog.create({
          data: {
            workspaceId,
            userId,
            action: 'PAYMENT_MANUAL_MATCH',
            resourceType: 'PaymentTransaction',
            resourceId: transaction.id,
            payload: {
              orderId: order.id,
              orderDisplayId: order.displayId,
              orderNumber: order.orderNumber,
              amount,
              transactionCode: transaction.transactionCode,
              transferContent: transaction.transferContent,
              previousPaid,
              newTotalPaid: totalPaid,
            },
          },
        });

        // Post-commit hooks
        const overpaidAmount = Math.max(0, totalPaid - orderTotal);
        ctx.addPostCommitHook(() => {
          if (isFullyPaid) {
            this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
              workspaceId,
              orderId: order.id,
              orderNumber: order.orderNumber,
              displayId: order.displayId,
              conversationId: order.conversationId,
              paidAmount: totalPaid,
              receivedAmount: amount,
              overpaidAmount,
              isOverpaid: overpaidAmount > 0,
              paymentMethod: transaction.paymentMethod,
              transactionCode: transaction.transactionCode,
              gateway: transaction.gateway,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                displayId: order.displayId,
                workspaceId,
                status: targetOrderStatus,
                paymentStatus: targetPaymentStatus,
                totalAmount: orderTotal,
                paidAmount: totalPaid,
                conversationId: order.conversationId,
                contactId: order.contactId,
              },
            });
          } else {
            this.eventEmitter.emit(DomainEvent.ORDER_PARTIALLY_PAID, {
              workspaceId,
              orderId: order.id,
              orderNumber: order.orderNumber,
              displayId: order.displayId,
              conversationId: order.conversationId,
              paidAmount: totalPaid,
              receivedAmount: amount,
              totalAmount: orderTotal,
              remainingAmount: Math.max(0, orderTotal - totalPaid),
              paymentMethod: transaction.paymentMethod,
              transactionCode: transaction.transactionCode,
              gateway: transaction.gateway,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                displayId: order.displayId,
                workspaceId,
                status: targetOrderStatus,
                paymentStatus: targetPaymentStatus,
                totalAmount: orderTotal,
                paidAmount: totalPaid,
                conversationId: order.conversationId,
                contactId: order.contactId,
              },
            });
          }

          this.eventEmitter.emit(DomainEvent.PAYMENT_TRANSACTION_UPDATED, {
            workspaceId,
            transactionId: transaction.id,
            amount,
            currency: transaction.currency,
            status: PaymentTransactionStatus.SUCCESS,
            gateway: transaction.gateway,
            transactionCode: transaction.transactionCode,
            transferContent: transaction.transferContent,
            orderId: order.id,
            displayId: order.displayId,
            createdAt: transaction.createdAt,
          });
        });

        return {
          success: true,
          transaction: {
            id: updatedTx.id,
            workspaceId: updatedTx.workspaceId,
            orderId: updatedTx.orderId,
            paymentMethod: updatedTx.paymentMethod as unknown as PaymentMethod,
            gateway: updatedTx.gateway as unknown as PaymentGateway,
            amount: Number(updatedTx.amount),
            currency: updatedTx.currency,
            status: updatedTx.status as unknown as PaymentTransactionStatus,
            transactionCode: updatedTx.transactionCode,
            accountNumber: updatedTx.accountNumber,
            bankCode: updatedTx.bankCode,
            transferContent: updatedTx.transferContent,
            qrUrl: updatedTx.qrUrl,
            rawWebhookPayload: updatedTx.rawWebhookPayload as any,
            idempotencyKey: updatedTx.idempotencyKey,
            paidAt: updatedTx.paidAt,
            createdAt: updatedTx.createdAt,
            updatedAt: updatedTx.updatedAt,
            order: {
              id: order.id,
              displayId: order.displayId,
              orderNumber: order.orderNumber,
              totalAmount: orderTotal,
              paidAmount: totalPaid,
              status: targetOrderStatus,
              paymentStatus: targetPaymentStatus,
            },
          },
          order: {
            id: order.id,
            displayId: order.displayId,
            orderNumber: order.orderNumber,
            status: targetOrderStatus,
            paymentStatus: targetPaymentStatus,
            paidAmount: totalPaid,
            totalAmount: orderTotal,
          },
        };
      });
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}
