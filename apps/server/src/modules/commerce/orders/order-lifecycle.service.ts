import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  FulfillmentStatus,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  type CancelOrderDto,
  type CompleteOrderDto,
  type ManualPayOrderDto,
  type OrderResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { StockMovementService } from '../inventory/stock-movement.service';
import { assertCanCancel, assertCanComplete, assertCanConfirm } from './order-status-guard';
import { formatOrder } from './orders-shared';

@Injectable()
export class OrderLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stockMovementService: StockMovementService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  /**
   * Atomically transitions order from DRAFT to CONFIRMED and reserves inventory.
   * Enforces Anti-Overselling Model A (Available = physical - reserved).
   * Sorts line items by variantId ascending prior to row-level locking to prevent 40P01 deadlocks.
   */
  async confirmOrder(
    workspaceId: string,
    orderId: string,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Fetch order with line items strictly scoped to workspaceId
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanConfirm(order);

      // 2. Atomically reserve inventory for line items via StockMovementService (Model A Anti-Overselling)
      const reserveItems = order.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
      }));

      await this.stockMovementService.reserveStock({
        workspaceId,
        items: reserveItems,
        orderId: order.id,
        orderDisplayId: order.displayId,
        orderNumber: order.orderNumber,
        userId,
        tx,
      });

      const reservedItemsSummary = reserveItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      // 3. Transition order status to CONFIRMED
      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      const updatedOrder = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          paymentTransactions: true,
        },
      });

      const formatted = formatOrder(updatedOrder);

      // 5. Post-commit hook: emit DomainEvent.ORDER_CONFIRMED
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CONFIRMED, {
          workspaceId,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          displayId: updatedOrder.displayId,
          conversationId: updatedOrder.conversationId,
          confirmedAt: updatedOrder.confirmedAt || new Date(),
          reservedItems: reservedItemsSummary,
          order: formatted,
        });
      });

      return formatted;
    });
  }

  /**
   * Records manual payment and commits inventory sale.
   */
  async payOrder(
    workspaceId: string,
    orderId: string,
    dto: ManualPayOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    // Shared payment lock domain — must match the reconciliation flows so manual pay
    // and bank reconciliation can never run concurrently on the same order.
    const lockKey = `ws:${workspaceId}:order:${orderId}:payment`;
    const lockToken = this.redisService
      ? await this.redisService.acquireLock(lockKey, 10000)
      : null;
    if (this.redisService && !lockToken) {
      throw new ConflictException({
        code: 'PAYMENT_IN_PROGRESS',
        message: 'A payment transaction is currently being processed for this order',
      });
    }

    try {
      return await this.prisma.runInTransaction(async ctx => {
        const tx = ctx.tx;

        const order = await tx.order.findFirst({
          where: { id: orderId, workspaceId },
          include: { items: true, paymentTransactions: true },
        });

        if (!order) {
          throw new NotFoundException({
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found in this workspace',
            details: { orderId, workspaceId },
          });
        }

        // 1. Idempotency guard: reject duplicate manual payment with deterministic key
        const idempotencyKey = dto.transactionCode
          ? `manual:${order.id}:${dto.transactionCode}`
          : `manual:${order.id}`;
        const existingTx = await tx.paymentTransaction.findFirst({
          where: { workspaceId, idempotencyKey },
        });

        if (existingTx) {
          throw new ConflictException({
            code: 'PAYMENT_ALREADY_PROCESSED',
            message: 'Payment for this order has already been recorded manually',
          });
        }

        if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CONFIRMED) {
          throw new BadRequestException({
            code: 'INVALID_STATUS_FOR_PAYMENT',
            message: `Cannot pay order in '${order.status}' status. Must be DRAFT or CONFIRMED.`,
          });
        }

        const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        await tx.paymentTransaction.create({
          data: {
            workspaceId,
            orderId: order.id,
            paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
            gateway: PaymentGateway.MANUAL,
            amount: dto.amount,
            currency: 'VND',
            status: PaymentTransactionStatus.SUCCESS,
            transactionCode: dto.transactionCode || `MANUAL-${dateStr}`,
            transferContent: dto.notes || `Thanh toán đơn hàng #${order.displayId}`,
            idempotencyKey,
            paidAt: new Date(),
          },
        });

        // 2. Financial calculation
        const totalPaid = Number(order.paidAmount) + dto.amount;
        const orderTotal = Number(order.totalAmount);
        const isFullyPaid = totalPaid >= orderTotal;

        if (isFullyPaid) {
          // Full payment: Commit inventory sale via StockMovementService
          const commitItems = (order.items || []).map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
          }));

          await this.stockMovementService.commitStock({
            workspaceId,
            items: commitItems,
            orderId: order.id,
            orderDisplayId: order.displayId,
            orderNumber: order.orderNumber,
            isPreviouslyReserved: isPreviouslyConfirmed,
            userId,
            tx,
          });

          // Update order status to PAID.
          // Conditional predicate: both payment flows only transition DRAFT/CONFIRMED → PAID.
          // count === 0 means a concurrent flow changed the state — abort so the caller can retry
          // instead of silently overwriting it (lost update).
          const paidUpdate = await tx.order.updateMany({
            where: {
              id: order.id,
              workspaceId,
              status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED] },
            },
            data: {
              paidAmount: totalPaid,
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.PAID,
              paidAt: new Date(),
            },
          });

          if (paidUpdate.count === 0) {
            throw new ConflictException({
              code: 'PAYMENT_STATE_CONFLICT',
              message: `Order #${order.displayId} state changed concurrently, payment not recorded. Please retry.`,
            });
          }
        } else {
          // Partial payment (Deposit / Installment):
          // If order was DRAFT, atomically reserve stock and transition to CONFIRMED
          if (!isPreviouslyConfirmed) {
            const reserveItems = (order.items || []).map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
            }));

            await this.stockMovementService.reserveStock({
              workspaceId,
              items: reserveItems,
              orderId: order.id,
              orderDisplayId: order.displayId,
              orderNumber: order.orderNumber,
              userId,
              reason: `Reserved on partial payment for Order #${order.displayId} (${order.orderNumber})`,
              tx,
            });
          }

          // Update order status to PARTIALLY_PAID (keep CONFIRMED status, do NOT mark PAID).
          // Same conditional predicate as the full-payment path to prevent lost updates.
          const partialUpdate = await tx.order.updateMany({
            where: {
              id: order.id,
              workspaceId,
              status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED] },
            },
            data: {
              paidAmount: totalPaid,
              paymentStatus: PaymentStatus.PARTIALLY_PAID,
              status: OrderStatus.CONFIRMED,
              confirmedAt: order.confirmedAt || new Date(),
            },
          });

          if (partialUpdate.count === 0) {
            throw new ConflictException({
              code: 'PAYMENT_STATE_CONFLICT',
              message: `Order #${order.displayId} state changed concurrently, payment not recorded. Please retry.`,
            });
          }
        }

        const updated = await tx.order.findFirstOrThrow({
          where: { id: order.id, workspaceId },
          include: { items: true, paymentTransactions: true },
        });

        const formatted = formatOrder(updated);

        // 4. Post-commit hooks: Realtime broadcasts
        ctx.addPostCommitHook(() => {
          if (isFullyPaid) {
            this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
              workspaceId,
              orderId: updated.id,
              orderNumber: updated.orderNumber,
              displayId: updated.displayId,
              conversationId: updated.conversationId,
              paidAmount: totalPaid,
              paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
              transactionCode: dto.transactionCode || null,
              order: formatted,
            });
          } else {
            this.eventEmitter.emit(DomainEvent.ORDER_PARTIALLY_PAID, {
              workspaceId,
              orderId: updated.id,
              orderNumber: updated.orderNumber,
              displayId: updated.displayId,
              conversationId: updated.conversationId,
              paidAmount: totalPaid,
              totalAmount: orderTotal,
              remainingAmount: Math.max(0, orderTotal - totalPaid),
              paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
              transactionCode: dto.transactionCode || null,
              order: formatted,
            });
          }
        });

        return formatted;
      });
    } finally {
      if (this.redisService && lockToken) {
        await this.redisService.releaseLock(lockKey, lockToken);
      }
    }
  }

  /**
   * Cancels an order with atomic status guard.
   * Releases reserved stock back to available inventory if previously CONFIRMED.
   */
  async cancelOrder(
    workspaceId: string,
    orderId: string,
    dto: CancelOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Fetch current order
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanCancel(order);

      const wasConfirmed = order.status === OrderStatus.CONFIRMED;
      const wasPaidOrShipped =
        order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPING;
      const paidAmount = Number(order.paidAmount || 0);

      // Refund tracking: Record refund payment transaction if paidAmount > 0
      if (paidAmount > 0) {
        const originalMethod =
          order.paymentTransactions?.[0]?.paymentMethod ||
          ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
          PaymentMethod.OTHER;

        await tx.paymentTransaction.create({
          data: {
            workspaceId,
            orderId: order.id,
            paymentMethod: originalMethod,
            gateway: PaymentGateway.MANUAL,
            amount: -paidAmount,
            currency: 'VND',
            status: PaymentTransactionStatus.SUCCESS,
            transactionCode: `REFUND-${order.displayId}`,
            transferContent: `Hoàn tiền đơn hủy #${order.displayId}: ${dto.cancelReason}`,
            idempotencyKey: `refund:${order.id}`,
            paidAt: new Date(),
          },
        });
      }

      // 2. Transition order status to CANCELLED.
      // Conditional predicate mirrors assertCanCancel: only DRAFT, CONFIRMED, PAID and SHIPPING
      // orders can be cancelled. count === 0 means a concurrent flow (payment/complete/cancel)
      // changed the state between the read and this write — abort so the caller can retry.
      const cancelUpdate = await tx.order.updateMany({
        where: {
          id: orderId,
          workspaceId,
          status: {
            in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PAID, OrderStatus.SHIPPING],
          },
        },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.cancelReason,
          ...(paidAmount > 0 ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
        },
      });

      if (cancelUpdate.count === 0) {
        throw new ConflictException({
          code: 'PAYMENT_STATE_CONFLICT',
          message: `Order #${order.displayId} state changed concurrently and can no longer be cancelled. Please refresh and retry.`,
        });
      }

      // 3. Release or restock inventory
      if (wasConfirmed && order.items && order.items.length > 0) {
        const releaseItems = order.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          sku: item.sku,
        }));

        await this.stockMovementService.releaseStock({
          workspaceId,
          items: releaseItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          userId,
          reason: `Released reservation on order cancellation #${order.displayId}: ${dto.cancelReason}`,
          tx,
        });
      } else if (wasPaidOrShipped && order.items && order.items.length > 0) {
        const restockItems = order.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
        }));

        await this.stockMovementService.restockStock({
          workspaceId,
          items: restockItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          userId,
          reason: `Restocked physical inventory on cancellation of ${order.status} order #${order.displayId}: ${dto.cancelReason}`,
          tx,
        });
      }

      const updated = await tx.order.findFirstOrThrow({
        where: { id: orderId, workspaceId },
        include: { items: true, paymentTransactions: true },
      });

      const formatted = formatOrder(updated);

      // 4. Post-commit hook: emit DomainEvent.ORDER_CANCELLED
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CANCELLED, {
          workspaceId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          displayId: updated.displayId,
          conversationId: updated.conversationId,
          cancelReason: dto.cancelReason,
          releasedStock: wasConfirmed || wasPaidOrShipped,
          order: formatted,
        });
      });

      return formatted;
    });
  }

  /**
   * Completes an order (transitions from PAID, SHIPPING, or CONFIRMED to COMPLETED).
   * Automatically marks fulfillmentStatus as DELIVERED.
   * If the order is COD and not fully paid, automatically creates a MANUAL payment transaction,
   * setting paymentStatus to PAID and paidAmount to totalAmount.
   */
  async completeOrder(
    workspaceId: string,
    orderId: string,
    dto?: CompleteOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanComplete(order);

      const orderTotal = Number(order.totalAmount);
      const paidAmount = Number(order.paidAmount);
      const isFullyPaid = paidAmount >= orderTotal;

      // If order was CONFIRMED (not yet committed stock), commit stock now
      if (order.status === OrderStatus.CONFIRMED) {
        const commitItems = (order.items || []).map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
        }));

        await this.stockMovementService.commitStock({
          workspaceId,
          items: commitItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          isPreviouslyReserved: true,
          userId,
          reason: `Commit stock upon order completion #${order.displayId}`,
          tx,
        });
      }

      let finalPaidAmount = paidAmount;
      let finalPaymentStatus = order.paymentStatus;
      let finalPaidAt = order.paidAt;

      // Auto-reconcile COD if not fully paid AND payment method is explicitly COD or CASH
      const orderPaymentMethod =
        (order as any).paymentMethod ||
        ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
        (order.paymentTransactions?.[0]?.paymentMethod as PaymentMethod);

      let didAutoPayCod = false;
      let codTx: any = null;

      if (
        !isFullyPaid &&
        (orderPaymentMethod === PaymentMethod.COD || orderPaymentMethod === PaymentMethod.CASH)
      ) {
        const remaining = Math.max(0, orderTotal - paidAmount);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = orderPaymentMethod === PaymentMethod.CASH ? 'CASH' : 'COD';
        const idempotencyKey = `cod:${order.id}`;

        const existingCodTx = await tx.paymentTransaction.findFirst({
          where: { workspaceId, idempotencyKey },
        });

        if (!existingCodTx) {
          codTx = await tx.paymentTransaction.create({
            data: {
              workspaceId,
              orderId: order.id,
              paymentMethod: orderPaymentMethod,
              gateway: PaymentGateway.MANUAL,
              amount: remaining,
              currency: 'VND',
              status: PaymentTransactionStatus.SUCCESS,
              transactionCode: `${prefix}-${dateStr}`,
              transferContent:
                dto?.notes || `Thu hộ ${prefix} khi giao thành công đơn #${order.displayId}`,
              idempotencyKey,
              paidAt: new Date(),
            },
          });

          didAutoPayCod = true;
          finalPaidAmount = orderTotal;
          finalPaymentStatus = PaymentStatus.PAID;
          finalPaidAt = new Date();
        }
      }

      const completedAt = new Date();

      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: {
          status: OrderStatus.COMPLETED,
          fulfillmentStatus: FulfillmentStatus.DELIVERED,
          completedAt,
          paidAmount: finalPaidAmount,
          paymentStatus: finalPaymentStatus,
          paidAt: finalPaidAt,
          internalNotes: dto?.notes
            ? order.internalNotes
              ? `${order.internalNotes}\n${dto.notes}`
              : dto.notes
            : order.internalNotes,
        },
      });

      const updated = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          paymentTransactions: true,
          inventoryTransactions: true,
        },
      });

      const formatted = formatOrder(updated);

      ctx.addPostCommitHook(() => {
        if (didAutoPayCod) {
          this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
            workspaceId,
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            displayId: updated.displayId,
            conversationId: updated.conversationId,
            paidAmount: finalPaidAmount,
            paymentMethod: orderPaymentMethod,
            transactionCode: codTx?.transactionCode || null,
            order: formatted,
          });
        }

        this.eventEmitter.emit(DomainEvent.ORDER_COMPLETED, {
          workspaceId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          displayId: updated.displayId,
          conversationId: updated.conversationId,
          completedAt,
          order: formatted,
        });
      });

      return formatted;
    });
  }
}
