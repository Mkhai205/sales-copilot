import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  POS_RECONCILIATION_QUEUE,
  PaymentGateway,
  WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { PaymentReconciliationJobData } from '../webhooks/payment-webhooks.controller';
import { PaymentReconciliationService } from './payment-reconciliation.service';

/**
 * Extracts order display ID from Vietnamese banking transfer memo.
 * Matches patterns: "ORD 1004", "ORD-1004", "ORD_1004", "ORD1004", "DH 1004", "SO 1004",
 * as well as full order number patterns like "ORD-20260909-1004" or "ORD_20260909_1004".
 */
export function parseOrderDisplayId(memo: string): number | null {
  if (!memo) return null;
  const match = memo.match(/(?:ORD|DH|SO)[\s_-]*(?:(?:\d{8}|\d{6})[\s_-]+)?(\d+)/i);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

/**
 * Extracts full order number (e.g. "ORD-20260909-1004") if present in memo.
 */
export function parseOrderNumber(memo: string): string | null {
  if (!memo) return null;
  const match = memo.match(/ORD-\d{6,8}-\d+/i);
  return match ? match[0].toUpperCase() : null;
}

@Processor(POS_RECONCILIATION_QUEUE, { concurrency: 5 })
@Injectable()
export class PosReconciliationProcessor extends WorkerHost {
  private readonly logger = new Logger(PosReconciliationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly paymentReconciliationService: PaymentReconciliationService,
  ) {
    super();
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

    // 1. Regex Parse Memo to extract Order displayId or orderNumber
    const displayId = parseOrderDisplayId(transferContent);
    const orderNumber = parseOrderNumber(transferContent);

    if (!displayId && !orderNumber) {
      this.logger.warn(
        `[Worker] No valid order reference found in memo: "${transferContent}". Flagged as UNMATCHED.`,
      );
      return { status: 'UNMATCHED_MEMO', transferContent };
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

    const wsSettings = (workspace.settings as any)?.paymentSettings as
      WorkspacePaymentSettings | undefined;

    if (wsSettings?.accountNumber && accountNumber) {
      const cleanIncomingAcc = accountNumber.replace(/[^0-9]/g, '');
      const cleanConfiguredAcc = wsSettings.accountNumber.replace(/[^0-9]/g, '');
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
        `[Worker] Order not found in workspace '${workspaceId}' for displayId=${displayId}, orderNumber=${orderNumber}, tx='${transactionId}'`,
      );
      return { status: 'ORDER_NOT_FOUND', displayId, orderNumber };
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
      const normalizedGateway = (gateway || '').toString().toLowerCase();
      const mappedGateway =
        normalizedGateway === 'sepay'
          ? PaymentGateway.SEPAY
          : normalizedGateway === 'casso'
            ? PaymentGateway.CASSO
            : PaymentGateway.MANUAL;

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
