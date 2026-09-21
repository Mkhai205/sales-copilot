import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  OrderStatus,
  PaginationMeta,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  type ListReconciliationTransactionsQueryDto,
  type ManualMatchTransactionDto,
  type PaymentTransactionResponseDto,
  type ReconciliationStatsQueryDto,
  type ReconciliationStatsResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { parseOrderDisplayId } from './commerce-reconciliation.processor';

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
    private readonly redisService: RedisService,
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

  /**
   * List and filter payment transactions in workspace
   */
  async listTransactions(
    workspaceId: string,
    query: ListReconciliationTransactionsQueryDto,
  ): Promise<{ items: PaymentTransactionResponseDto[]; meta: PaginationMeta }> {
    const page = Number(query.page || 1);
    const limit = Number(query.limit || 20);
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PaymentTransactionStatus;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        if (query.to.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        where.createdAt.lte = toDate;
      }
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      const numVal = Number(search.replace(/[^0-9.-]+/g, ''));
      const searchConditions: any[] = [
        { transactionCode: { contains: search, mode: 'insensitive' } },
        { transferContent: { contains: search, mode: 'insensitive' } },
        { accountNumber: { contains: search, mode: 'insensitive' } },
      ];
      if (!isNaN(numVal) && numVal > 0) {
        searchConditions.push({ amount: numVal });
      }
      const orderDisplayId = parseOrderDisplayId(search);
      if (orderDisplayId) {
        searchConditions.push({ order: { displayId: orderDisplayId } });
      } else {
        searchConditions.push({
          order: { orderNumber: { contains: search, mode: 'insensitive' } },
        });
      }
      where.OR = searchConditions;
    }

    const client = this.prisma.getClient();
    const [total, transactions] = await Promise.all([
      client.paymentTransaction.count({ where }),
      client.paymentTransaction.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              displayId: true,
              orderNumber: true,
              totalAmount: true,
              paidAmount: true,
              status: true,
              paymentStatus: true,
              contact: {
                select: {
                  name: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    const items: PaymentTransactionResponseDto[] = transactions.map((t: any) => ({
      id: t.id,
      workspaceId: t.workspaceId,
      orderId: t.orderId,
      paymentMethod: t.paymentMethod as unknown as PaymentMethod,
      gateway: t.gateway as unknown as PaymentGateway,
      amount: Number(t.amount),
      currency: t.currency,
      status: t.status as unknown as PaymentTransactionStatus,
      transactionCode: t.transactionCode,
      accountNumber: t.accountNumber,
      bankCode: t.bankCode,
      transferContent: t.transferContent,
      qrUrl: t.qrUrl,
      rawWebhookPayload: t.rawWebhookPayload as any,
      idempotencyKey: t.idempotencyKey,
      paidAt: t.paidAt,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      order: t.order
        ? {
            id: t.order.id,
            displayId: t.order.displayId,
            orderNumber: t.order.orderNumber,
            totalAmount: Number(t.order.totalAmount),
            paidAmount: Number(t.order.paidAmount),
            status: t.order.status,
            paymentStatus: t.order.paymentStatus,
            contact: t.order.contact
              ? {
                  fullName: t.order.contact.name,
                  phone: t.order.contact.phoneNumber,
                }
              : null,
          }
        : null,
    }));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    };
  }

  /**
   * Aggregate transaction statistics for summary bar
   */
  async getStats(
    workspaceId: string,
    query?: ReconciliationStatsQueryDto,
  ): Promise<ReconciliationStatsResponseDto> {
    const where: any = { workspaceId };

    if (query?.from || query?.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        if (query.to.length === 10) {
          toDate.setHours(23, 59, 59, 999);
        }
        where.createdAt.lte = toDate;
      }
    }

    const transactions = await this.prisma.getClient().paymentTransaction.findMany({
      where,
      select: {
        status: true,
        amount: true,
      },
    });

    const stats: ReconciliationStatsResponseDto = {
      reconciled: { count: 0, totalAmount: 0 },
      pending: { count: 0, totalAmount: 0 },
      failed: { count: 0, totalAmount: 0 },
    };

    for (const tx of transactions) {
      const amount = Number(tx.amount || 0);
      if (tx.status === PaymentTransactionStatus.SUCCESS) {
        stats.reconciled.count++;
        stats.reconciled.totalAmount += amount;
      } else if (tx.status === PaymentTransactionStatus.PENDING) {
        stats.pending.count++;
        stats.pending.totalAmount += amount;
      } else {
        stats.failed.count++;
        stats.failed.totalAmount += amount;
      }
    }

    return stats;
  }

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

    const lockKey = `ws:${workspaceId}:order:${targetOrder.id}:reconcile`;
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

        // Stock commit if fully paid & Model A (sale commit)
        if (isFullyPaid && !wasAlreadyPaid) {
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
        const targetOrderStatus = isFullyPaid ? OrderStatus.PAID : order.status;

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
