import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import {
  COMMERCE_RECONCILIATION_QUEUE,
  DomainEvent,
  PaymentGateway,
  PaymentMethod,
  PaymentTransactionStatus,
  WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { PaymentReconciliationJobData } from '../webhooks/payment-webhooks.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { parseOrderDisplayId, parseOrderNumber } from './reconciliation.util';
export { parseOrderDisplayId, parseOrderNumber };

@Processor(COMMERCE_RECONCILIATION_QUEUE, { concurrency: 5 })
@Injectable()
export class CommerceReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(CommerceReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly paymentReconciliationService: PaymentReconciliationService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  private mapGateway(rawGateway: string): PaymentGateway {
    const normalizedGateway = (rawGateway || '').toString().toLowerCase();
    return normalizedGateway === 'sepay'
      ? PaymentGateway.SEPAY
      : normalizedGateway === 'casso'
        ? PaymentGateway.CASSO
        : PaymentGateway.MANUAL;
  }

  private async recordPendingUnmatchedTransaction(params: {
    workspaceId: string;
    gateway: PaymentGateway;
    transactionId: string;
    amount: number;
    accountNumber: string;
    transferContent: string;
    bankCode?: string;
    rawPayload?: any;
    reason: 'UNMATCHED_MEMO' | 'ORDER_NOT_FOUND';
  }) {
    const {
      workspaceId,
      gateway,
      transactionId,
      amount,
      accountNumber,
      transferContent,
      bankCode,
      rawPayload,
      reason,
    } = params;

    const idempotencyKey = `${gateway.toLowerCase()}:${transactionId}`;
    const client = this.prisma.getClient();

    const existingTx = await client.paymentTransaction.findFirst({
      where: { workspaceId, idempotencyKey },
    });

    if (existingTx) {
      this.logger.warn(
        `Transaction ${idempotencyKey} already exists in workspace. Skipping duplicate.`,
      );
      return { status: 'DUPLICATE', transactionId };
    }

    try {
      const pendingTx = await client.paymentTransaction.create({
        data: {
          workspaceId,
          orderId: null,
          paymentMethod: PaymentMethod.VIETQR,
          gateway,
          amount,
          currency: 'VND',
          status: PaymentTransactionStatus.PENDING,
          transactionCode: transactionId,
          accountNumber,
          bankCode: bankCode || null,
          transferContent,
          rawWebhookPayload: rawPayload || {},
          idempotencyKey,
          paidAt: null,
        },
      });

      this.eventEmitter.emit(DomainEvent.PAYMENT_TRANSACTION_CREATED, {
        workspaceId,
        transactionId: pendingTx.id,
        amount,
        currency: 'VND',
        status: PaymentTransactionStatus.PENDING,
        gateway,
        transactionCode: transactionId,
        transferContent,
        orderId: null,
        createdAt: pendingTx.createdAt,
      });

      this.logger.log(
        `[Worker] Recorded UNMATCHED bank transaction ${pendingTx.id} as PENDING (reason: ${reason})`,
      );

      return { status: reason, transactionId: pendingTx.id, pending: true };
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.warn(
          `Transaction ${idempotencyKey} hit P2002 unique constraint. Returning DUPLICATE.`,
        );
        return { status: 'DUPLICATE', transactionId };
      }
      throw err;
    }
  }

  async process(job: Job<PaymentReconciliationJobData>): Promise<any> {
    const {
      workspaceId,
      gateway,
      transactionId,
      amount,
      accountNumber,
      transferContent,
      bankCode,
      rawPayload,
    } = job.data;

    this.logger.log(
      `[Worker] Processing bank reconciliation: txId=${transactionId}, gateway=${gateway}, amount=${amount}, memo="${transferContent}"`,
    );

    // Validate amount > 0
    if (amount <= 0) {
      this.logger.warn(`[Worker] Skipping transaction with non-positive amount: ${amount}`);
      return { status: 'INVALID_AMOUNT', amount };
    }

    const mappedGateway = this.mapGateway(gateway);

    // 1. Regex Parse Memo to extract Order displayId or orderNumber
    const displayId = parseOrderDisplayId(transferContent);
    const orderNumber = parseOrderNumber(transferContent);

    if (!displayId && !orderNumber) {
      this.logger.warn(
        `[Worker] No valid order reference found in memo: "${transferContent}". Storing as PENDING for manual matching.`,
      );
      return this.recordPendingUnmatchedTransaction({
        workspaceId,
        gateway: mappedGateway,
        transactionId,
        amount,
        accountNumber,
        transferContent,
        bankCode,
        rawPayload,
        reason: 'UNMATCHED_MEMO',
      });
    }

    // 2. Fetch Workspace and Destination Account Guard
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, settings: true },
    });

    if (!workspace) {
      this.logger.error(`[Worker] Workspace '${workspaceId}' not found`);
      return { status: 'WORKSPACE_NOT_FOUND' };
    }

    const rawSettings = workspace.settings as any;
    const wsSettings = rawSettings?.paymentSettings as WorkspacePaymentSettings | undefined;
    const legacyConfig = rawSettings?.bankConfig;
    const expectedAccount =
      wsSettings?.accountNumber || legacyConfig?.accountNumber || legacyConfig?.accountNo;

    if (expectedAccount && accountNumber) {
      const cleanIncomingAcc = accountNumber.replace(/[^0-9]/g, '');
      const cleanConfiguredAcc = expectedAccount.replace(/[^0-9]/g, '');
      if (
        cleanIncomingAcc &&
        cleanConfiguredAcc &&
        cleanIncomingAcc !== cleanConfiguredAcc &&
        !cleanIncomingAcc.endsWith(cleanConfiguredAcc) &&
        !cleanConfiguredAcc.endsWith(cleanIncomingAcc)
      ) {
        this.logger.warn(
          `[Worker] Destination account mismatch: incoming=${cleanIncomingAcc}, expected=${cleanConfiguredAcc}`,
        );
      }
    }

    // 3. Find target Order strictly scoped to workspace by displayId or orderNumber
    const orConditions: any[] = [];
    if (displayId) orConditions.push({ displayId });
    if (orderNumber) orConditions.push({ orderNumber });

    const order = await client.order.findFirst({
      where: {
        workspaceId,
        OR: orConditions,
      },
      select: { id: true, displayId: true, orderNumber: true, status: true },
    });

    if (!order) {
      this.logger.warn(
        `[Worker] Order not found in workspace '${workspaceId}' for displayId=${displayId}, orderNumber=${orderNumber}, tx='${transactionId}'. Storing as PENDING.`,
      );
      return this.recordPendingUnmatchedTransaction({
        workspaceId,
        gateway: mappedGateway,
        transactionId,
        amount,
        accountNumber,
        transferContent,
        bankCode,
        rawPayload,
        reason: 'ORDER_NOT_FOUND',
      });
    }

    // 4. Distributed Redlock Concurrency Guard (TTL 10s)
    const lockKey = `ws:${workspaceId}:order:${order.id}:reconcile`;
    const lockToken = await this.redisService.acquireLock(lockKey, 10000);

    if (!lockToken) {
      this.logger.warn(
        `[Worker] Failed to acquire distributed lock for order #${order.displayId}. Throwing to trigger BullMQ retry.`,
      );
      throw new Error(`Lock contention on order ${order.id}. Retrying...`);
    }

    try {
      // 5. Execute safe reconciliation service inside database transaction
      const result = await this.paymentReconciliationService.reconcileTransaction({
        workspaceId,
        orderId: order.id,
        amount,
        gateway: mappedGateway,
        transactionCode: transactionId,
        accountNumber,
        bankCode,
        transferContent,
        rawPayload,
      });

      this.logger.log(
        `[Worker] Successfully reconciled Order #${order.displayId}: status=${result.status}, stockCommitted=${result.stockCommitted}`,
      );

      return result;
    } finally {
      await this.redisService.releaseLock(lockKey, lockToken);
    }
  }
}

export const PosReconciliationProcessor = CommerceReconciliationProcessor;
export type PosReconciliationProcessor = CommerceReconciliationProcessor;
