import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  InventoryTransactionType,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

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

    return this.prisma.runInTransaction(async ctx => {
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

      // 5. Financial Calculation
      const previousPaid = Number(order.paidAmount || 0);
      const totalPaid = previousPaid + amount;
      const orderTotal = Number(order.totalAmount);
      const isFullyPaid = totalPaid >= orderTotal;
      const wasAlreadyPaid = order.status === OrderStatus.PAID;
      const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;

      let stockCommitted = false;
      const inventoryUpdateEvents: any[] = [];

      // 6. Safe Inventory State Machine (Model A)
      if (isFullyPaid) {
        // Safe Inventory Deduplication Guard:
        // CHỈ thực hiện commit kho thực tế nếu đơn chưa ở trạng thái PAID
        if (!wasAlreadyPaid) {
          // Sort items by variantId ascending to prevent PostgreSQL Deadlock 40P01
          const sortedItems = [...(order.items || [])].sort((a, b) =>
            a.variantId.localeCompare(b.variantId),
          );

          for (const item of sortedItems) {
            let count: number;

            if (isPreviouslyConfirmed) {
              // Stock was already reserved in CONFIRMED state.
              // Atomically decrement physical stock and release reserved quantity
              count = await tx.$executeRaw`
                UPDATE "product_variants"
                SET 
                  "stockQuantity" = "stockQuantity" - ${item.quantity},
                  "reservedQuantity" = "reservedQuantity" - ${item.quantity},
                  "updatedAt" = NOW()
                WHERE "id" = ${item.variantId}
                  AND "workspaceId" = ${workspaceId}
                  AND "stockQuantity" >= ${item.quantity}
                  AND "reservedQuantity" >= ${item.quantity}
              `;
            } else {
              // DRAFT state: Stock was not reserved. Verify available stock and decrement
              count = await tx.$executeRaw`
                UPDATE "product_variants"
                SET 
                  "stockQuantity" = "stockQuantity" - ${item.quantity},
                  "updatedAt" = NOW()
                WHERE "id" = ${item.variantId}
                  AND "workspaceId" = ${workspaceId}
                  AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
              `;
            }

            if (count === 0) {
              const variant = await tx.productVariant.findFirst({
                where: { id: item.variantId, workspaceId },
              });
              const currentAvailable =
                (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);

              throw new ConflictException({
                code: 'INSUFFICIENT_STOCK',
                message: `Insufficient stock for product '${item.productName}' (${item.sku})`,
                details: {
                  variantId: item.variantId,
                  sku: item.sku,
                  requestedQuantity: item.quantity,
                  availableStock: Math.max(0, currentAvailable),
                },
              });
            }

            const currentVariant = await tx.productVariant.findFirstOrThrow({
              where: { id: item.variantId, workspaceId },
            });

            await tx.inventoryTransaction.create({
              data: {
                workspaceId,
                variantId: item.variantId,
                orderId: order.id,
                type: InventoryTransactionType.COMMIT_SALE,
                quantity: item.quantity,
                previousStock: currentVariant.stockQuantity + item.quantity,
                newStock: currentVariant.stockQuantity,
                previousReserved: isPreviouslyConfirmed
                  ? currentVariant.reservedQuantity + item.quantity
                  : currentVariant.reservedQuantity,
                newReserved: currentVariant.reservedQuantity,
                reason: `Commit sale via ${gateway} reconciliation for Order #${order.displayId}`,
              },
            });

            inventoryUpdateEvents.push({
              workspaceId,
              variantId: item.variantId,
              sku: currentVariant.sku,
              previousStock: currentVariant.stockQuantity + item.quantity,
              newStock: currentVariant.stockQuantity,
              previousReserved: isPreviouslyConfirmed
                ? currentVariant.reservedQuantity + item.quantity
                : currentVariant.reservedQuantity,
              newReserved: currentVariant.reservedQuantity,
              availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
              reason: `Commit sale for Order #${order.displayId}`,
            });
          }

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

        // 7. Post-commit hooks
        const overpaidAmount = Math.max(0, totalPaid - orderTotal);
        ctx.addPostCommitHook(() => {
          for (const ev of inventoryUpdateEvents) {
            this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
          }

          this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
            workspaceId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            displayId: order.displayId,
            conversationId: order.conversationId,
            opportunityId: order.opportunityId,
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
              opportunityId: order.opportunityId,
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
          const sortedItems = [...(order.items || [])].sort((a, b) =>
            a.variantId.localeCompare(b.variantId),
          );

          for (const item of sortedItems) {
            const count = await tx.$executeRaw`
              UPDATE "product_variants"
              SET 
                "reservedQuantity" = "reservedQuantity" + ${item.quantity},
                "updatedAt" = NOW()
              WHERE "id" = ${item.variantId}
                AND "workspaceId" = ${workspaceId}
                AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
            `;

            if (count === 0) {
              const variant = await tx.productVariant.findFirst({
                where: { id: item.variantId, workspaceId },
              });
              const currentAvailable =
                (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);

              throw new ConflictException({
                code: 'INSUFFICIENT_STOCK',
                message: `Insufficient stock for product '${item.productName}' (${item.sku})`,
                details: {
                  variantId: item.variantId,
                  sku: item.sku,
                  requestedQuantity: item.quantity,
                  availableStock: Math.max(0, currentAvailable),
                },
              });
            }

            const currentVariant = await tx.productVariant.findFirstOrThrow({
              where: { id: item.variantId, workspaceId },
            });

            await tx.inventoryTransaction.create({
              data: {
                workspaceId,
                variantId: item.variantId,
                orderId: order.id,
                type: InventoryTransactionType.RESERVATION,
                quantity: item.quantity,
                previousStock: currentVariant.stockQuantity,
                newStock: currentVariant.stockQuantity,
                previousReserved: currentVariant.reservedQuantity - item.quantity,
                newReserved: currentVariant.reservedQuantity,
                reason: `Reserved on partial payment via ${gateway} for Order #${order.displayId}`,
              },
            });

            inventoryUpdateEvents.push({
              workspaceId,
              variantId: item.variantId,
              sku: currentVariant.sku,
              previousStock: currentVariant.stockQuantity,
              newStock: currentVariant.stockQuantity,
              previousReserved: currentVariant.reservedQuantity - item.quantity,
              newReserved: currentVariant.reservedQuantity,
              availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
              reason: `Reserved on partial payment for Order #${order.displayId}`,
            });
          }
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
          for (const ev of inventoryUpdateEvents) {
            this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
          }

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
              opportunityId: order.opportunityId,
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
  }
}
