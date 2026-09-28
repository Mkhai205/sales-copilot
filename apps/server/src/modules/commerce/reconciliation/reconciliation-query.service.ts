import { Injectable } from '@nestjs/common';
import {
  PaginationMeta,
  PaymentGateway,
  PaymentMethod,
  PaymentTransactionStatus,
  type ListReconciliationTransactionsQueryDto,
  type PaymentTransactionResponseDto,
  type ReconciliationStatsQueryDto,
  type ReconciliationStatsResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { parseOrderDisplayId } from './reconciliation.util';

@Injectable()
export class ReconciliationQueryService {
  constructor(private readonly prisma: PrismaService) {}

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

    this.applyCreatedAtRange(where, query);

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

    if (query) {
      this.applyCreatedAtRange(where, query);
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

  private applyCreatedAtRange(where: any, query: { from?: string; to?: string }): void {
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
  }
}
