import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';

export interface ReconcileTransactionParams {
  workspaceId: string;
  orderId: string;
  amount: number;
  gateway: PaymentGateway;
  transactionCode: string;
  accountNumber: string;
  bankCode?: string;
  transferContent: string;
  rawPayload?: any;
}

export interface ReconcileResult {
  processed: boolean;
  status: 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED_NEEDS_REFUND' | 'DUPLICATE' | 'OVERPAID';
  orderId: string;
  displayId: number;
  totalPaid: number;
  remainingAmount: number;
  stockCommitted: boolean;
}

@Injectable()
export class PaymentReconciliationService {
  private readonly logger = new Logger(PaymentReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryLedgerService: InventoryLedgerService,
  ) {}

  /**
   * Idempotent bank reconciliation transaction with Model A stock commit and post-commit events.
   */
  async reconcileTransaction(params: ReconcileTransactionParams): Promise<ReconcileResult> {
    const {
      workspaceId,
      orderId,
      amount,
      gateway,
      transactionCode,
      accountNumber,
      bankCode,
      transferContent,
      rawPayload,
    } = params;

    if (amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_PAYMENT_AMOUNT',
        message: 'Payment amount must be greater than zero',
        details: { amount, orderId },
      });
    }

    const idempotencyKey = `${gateway.toLowerCase()}:${transactionCode}`;

    try {
      return await this.prisma.runInTransaction(async ctx => {
        const tx = ctx.tx;

        // 1. Idempotency Check in payment_transactions table
        const existingTx = await tx.paymentTransaction.findFirst({
          where: { workspaceId, idempotencyKey },
        });

        if (existingTx) {
          this.logger.warn(`Transaction ${idempotencyKey} has already been processed. Skipping.`);
          const existingOrder = await tx.order.findFirst({
            where: { id: orderId, workspaceId },
          });

          return {
            processed: false,
            status: 'DUPLICATE',
            orderId,
            displayId: existingOrder?.displayId ?? 0,
            totalPaid: Number(existingOrder?.paidAmount ?? 0),
            remainingAmount: Math.max(
              0,
              Number(existingOrder?.totalAmount ?? 0) - Number(existingOrder?.paidAmount ?? 0),
            ),
            stockCommitted: false,
          };
        }

        // 2. Fetch Order with line items strictly scoped to workspaceId
        const order = await tx.order.findFirst({
          where: { id: orderId, workspaceId },
          include: { items: true, shippingAddress: true, paymentTransactions: true },
        });

        if (!order) {
          throw new NotFoundException({
            code: 'ORDER_NOT_FOUND',
            message: `Order '${orderId}' not found in workspace`,
            details: { orderId, workspaceId },
          });
        }

        // 3. CANCELLED Order Guard: Do NOT revive cancelled orders to PAID, do NOT commit stock
        if (order.status === OrderStatus.CANCELLED) {
          this.logger.warn(
            `Bank payment of ${amount} received for CANCELLED order #${order.displayId}. Flagging for refund.`,
          );

          try {
            await tx.paymentTransaction.create({
              data: {
                workspaceId,
                orderId: order.id,
                paymentMethod: PaymentMethod.VIETQR,
                gateway,
                amount,
                currency: 'VND',
                status: PaymentTransactionStatus.SUCCESS,
                transactionCode,
                accountNumber,
                bankCode: bankCode || null,
                transferContent: `${transferContent} [ĐƠN ĐÃ HỦY - CẦN HOÀN TIỀN]`,
                rawWebhookPayload: rawPayload || {},
                idempotencyKey,
                paidAt: new Date(),
              },
            });
          } catch (err: any) {
            if (err?.code === 'P2002') {
              this.logger.warn(
                `Transaction ${idempotencyKey} hit P2002 unique constraint on cancelled order. Returning DUPLICATE.`,
              );
              return {
                processed: false,
                status: 'DUPLICATE',
                orderId,
                displayId: order.displayId,
                totalPaid: Number(order.paidAmount ?? 0),
                remainingAmount: 0,
                stockCommitted: false,
              };
            }
            throw err;
          }

          await tx.order.updateMany({
            where: { id: order.id, workspaceId },
            data: {
              paidAmount: Number(order.paidAmount) + amount,
            },
          });

          return {
            processed: true,
            status: 'CANCELLED_NEEDS_REFUND',
            orderId: order.id,
            displayId: order.displayId,
            totalPaid: Number(order.paidAmount) + amount,
            remainingAmount: 0,
            stockCommitted: false,
          };
        }

        // 4. Record Immutable Payment Transaction Record
        try {
          await tx.paymentTransaction.create({
            data: {
              workspaceId,
              orderId: order.id,
              paymentMethod: PaymentMethod.VIETQR,
              gateway,
              amount,
              currency: 'VND',
              status: PaymentTransactionStatus.SUCCESS,
              transactionCode,
              accountNumber,
              bankCode: bankCode || null,
              transferContent,
              rawWebhookPayload: rawPayload || {},
              idempotencyKey,
              paidAt: new Date(),
            },
          });
        } catch (err: any) {
          if (err?.code === 'P2002') {
            this.logger.warn(
              `Transaction ${idempotencyKey} hit P2002 unique constraint collision. Returning DUPLICATE.`,
            );
            return {
              processed: false,
              status: 'DUPLICATE',
              orderId,
              displayId: order.displayId,
              totalPaid: Number(order.paidAmount ?? 0),
              remainingAmount: Math.max(
                0,
                Number(order.totalAmount ?? 0) - Number(order.paidAmount ?? 0),
              ),
              stockCommitted: false,
            };
          }
          throw err;
        }

        // 5. Financial Calculation
        const previousPaid = Number(order.paidAmount || 0);
        const totalPaid = previousPaid + amount;
        const orderTotal = Number(order.totalAmount);
        const isFullyPaid = totalPaid >= orderTotal;
        const wasAlreadyPaid = order.status === OrderStatus.PAID;
        const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;

        // 6. Status guard for SHIPPING or COMPLETED:
        // If order is already in fulfillment or completed, do NOT deduct inventory again or regress order status.
        if (order.status === OrderStatus.SHIPPING || order.status === OrderStatus.COMPLETED) {
          this.logger.log(
            `Order #${order.displayId} has status '${order.status}'. Payment of ${amount} recorded without stock deduction or status regression.`,
          );

          const targetPaymentStatus = isFullyPaid
            ? PaymentStatus.PAID
            : PaymentStatus.PARTIALLY_PAID;
          await tx.order.updateMany({
            where: { id: order.id, workspaceId },
            data: {
              paidAmount: totalPaid,
              paymentStatus: targetPaymentStatus,
              ...(isFullyPaid ? { paidAt: order.paidAt || new Date() } : {}),
            },
          });

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
                paymentMethod: PaymentMethod.VIETQR,
                transactionCode,
                gateway,
                order: {
                  id: order.id,
                  orderNumber: order.orderNumber,
                  displayId: order.displayId,
                  workspaceId,
                  status: order.status,
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
                paymentMethod: PaymentMethod.VIETQR,
                transactionCode,
                gateway,
                order: {
                  id: order.id,
                  orderNumber: order.orderNumber,
                  displayId: order.displayId,
                  workspaceId,
                  status: order.status,
                  paymentStatus: targetPaymentStatus,
                  totalAmount: orderTotal,
                  paidAmount: totalPaid,
                  conversationId: order.conversationId,
                  contactId: order.contactId,
                },
              });
            }
          });

          return {
            processed: true,
            status: isFullyPaid ? (wasAlreadyPaid ? 'OVERPAID' : 'PAID') : 'PARTIALLY_PAID',
            orderId: order.id,
            displayId: order.displayId,
            totalPaid,
            remainingAmount: Math.max(0, orderTotal - totalPaid),
            stockCommitted: false,
          };
        }

        let stockCommitted = false;

        // 7. Safe Inventory State Machine via InventoryLedgerService
        if (isFullyPaid) {
          // Safe Inventory Deduplication Guard:
          // CHỈ thực hiện commit kho thực tế nếu đơn chưa ở trạng thái PAID
          if (!wasAlreadyPaid) {
            const commitItems = (order.items || []).map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
            }));

            await this.inventoryLedgerService.commitStock({
              workspaceId,
              items: commitItems,
              orderId: order.id,
              orderDisplayId: order.displayId,
              orderNumber: order.orderNumber,
              isPreviouslyReserved: isPreviouslyConfirmed,
              reason: `Commit sale via ${gateway} reconciliation for Order #${order.displayId}`,
              tx,
            });

            stockCommitted = true;
          } else {
            this.logger.log(
              `Order #${order.displayId} was already PAID. Additional payment of ${amount} recorded without duplicate stock deduction.`,
            );
          }

          // Update Order to PAID status
          await tx.order.updateMany({
            where: { id: order.id, workspaceId },
            data: {
              paidAmount: totalPaid,
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.PAID,
              paidAt: order.paidAt || new Date(),
            },
          });

          // Post-commit hooks
          const overpaidAmount = Math.max(0, totalPaid - orderTotal);
          ctx.addPostCommitHook(() => {
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
              paymentMethod: PaymentMethod.VIETQR,
              transactionCode,
              gateway,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                displayId: order.displayId,
                workspaceId,
                status: OrderStatus.PAID,
                paymentStatus: PaymentStatus.PAID,
                totalAmount: orderTotal,
                paidAmount: totalPaid,
                conversationId: order.conversationId,
                contactId: order.contactId,
              },
            });
          });

          return {
            processed: true,
            status: wasAlreadyPaid ? 'OVERPAID' : 'PAID',
            orderId: order.id,
            displayId: order.displayId,
            totalPaid,
            remainingAmount: 0,
            stockCommitted,
          };
        } else {
          // Partial Payment (PARTIALLY_PAID):
          // If order was DRAFT, reserve inventory and transition to CONFIRMED
          if (!isPreviouslyConfirmed && order.status === OrderStatus.DRAFT) {
            const reserveItems = (order.items || []).map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
            }));

            await this.inventoryLedgerService.reserveStock({
              workspaceId,
              items: reserveItems,
              orderId: order.id,
              orderDisplayId: order.displayId,
              orderNumber: order.orderNumber,
              reason: `Reserved on partial payment via ${gateway} for Order #${order.displayId}`,
              tx,
            });
          }

          // Update Order to PARTIALLY_PAID
          await tx.order.updateMany({
            where: { id: order.id, workspaceId },
            data: {
              paidAmount: totalPaid,
              paymentStatus: PaymentStatus.PARTIALLY_PAID,
              status: OrderStatus.CONFIRMED,
              confirmedAt: order.confirmedAt || new Date(),
            },
          });

          // Post-commit hook for partial payment
          const remainingAmount = Math.max(0, orderTotal - totalPaid);
          ctx.addPostCommitHook(() => {
            this.eventEmitter.emit(DomainEvent.ORDER_PARTIALLY_PAID, {
              workspaceId,
              orderId: order.id,
              orderNumber: order.orderNumber,
              displayId: order.displayId,
              conversationId: order.conversationId,
              paidAmount: totalPaid,
              receivedAmount: amount,
              totalAmount: orderTotal,
              remainingAmount,
              paymentMethod: PaymentMethod.VIETQR,
              transactionCode,
              gateway,
              order: {
                id: order.id,
                orderNumber: order.orderNumber,
                displayId: order.displayId,
                workspaceId,
                status: OrderStatus.CONFIRMED,
                paymentStatus: PaymentStatus.PARTIALLY_PAID,
                totalAmount: orderTotal,
                paidAmount: totalPaid,
                conversationId: order.conversationId,
                contactId: order.contactId,
              },
            });
          });

          return {
            processed: true,
            status: 'PARTIALLY_PAID',
            orderId: order.id,
            displayId: order.displayId,
            totalPaid,
            remainingAmount,
            stockCommitted: false,
          };
        }
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.warn(
          `Transaction ${idempotencyKey} hit P2002 duplicate unique constraint. Returning DUPLICATE.`,
        );
        const existingOrder = await this.prisma.getClient().order.findFirst({
          where: { id: orderId, workspaceId },
        });
        return {
          processed: false,
          status: 'DUPLICATE',
          orderId,
          displayId: existingOrder?.displayId ?? 0,
          totalPaid: Number(existingOrder?.paidAmount ?? 0),
          remainingAmount: Math.max(
            0,
            Number(existingOrder?.totalAmount ?? 0) - Number(existingOrder?.paidAmount ?? 0),
          ),
          stockCommitted: false,
        };
      }
      throw err;
    }
  }
}
