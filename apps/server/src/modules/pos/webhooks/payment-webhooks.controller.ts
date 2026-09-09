import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { POS_RECONCILIATION_QUEUE, PaymentGatewayType } from '@sales-copilot/shared-contracts';
import { Public } from '../../auth/decorators/public.decorator';
import { PaymentWebhooksGuard } from './payment-webhooks.guard';

export interface PaymentReconciliationJobData {
  workspaceId: string;
  gateway: PaymentGatewayType;
  transactionId: string;
  amount: number;
  accountNumber: string;
  transferContent: string;
  bankCode?: string;
  transactionDate?: string;
  rawPayload: any;
}

@Controller('workspaces/:workspaceId/webhooks/payments/:gateway')
@Public()
@UseGuards(PaymentWebhooksGuard)
export class PaymentWebhooksController {
  private readonly logger = new Logger(PaymentWebhooksController.name);

  constructor(
    @InjectQueue(POS_RECONCILIATION_QUEUE)
    private readonly reconciliationQueue: Queue<PaymentReconciliationJobData>,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('workspaceId') workspaceId: string,
    @Param('gateway') gatewayParam: string,
    @Body() payload: any,
  ): Promise<{ success: boolean; queued: boolean; count: number }> {
    const gateway = (gatewayParam || '').toLowerCase() as PaymentGatewayType;

    // 1. Normalize items array (support Casso { error: 0, data: [...] } and SePay direct payload)
    let items: any[] = [];
    if (payload && Array.isArray(payload.data)) {
      items = payload.data;
    } else if (Array.isArray(payload)) {
      items = payload;
    } else if (payload && typeof payload === 'object') {
      items = [payload];
    }

    let queuedCount = 0;

    // 2. Fast enqueue with Redis-level deduplication via BullMQ jobId
    for (const item of items) {
      if (!item) continue;

      // Ignore debit / outgoing money transactions (e.g. SePay transferType: 'out')
      const transferType = (item.transferType || item.type || '').toString().toLowerCase();
      if (transferType === 'out') {
        this.logger.debug(`Skipping outgoing/debit transfer: ${item.id || item.transactionId}`);
        continue;
      }

      // Extract financial and memo fields
      const amount = Number(item.transferAmount ?? item.amount ?? 0);
      if (amount <= 0) {
        this.logger.debug(`Skipping non-positive amount transfer: ${amount}`);
        continue;
      }

      // Extract transaction ID with comprehensive fallbacks (prevent SePay `code: null` bug)
      const txId =
        (
          item.id ||
          item.transactionId ||
          item.referenceCode ||
          item.referenceNumber ||
          item.tid ||
          item.code
        )?.toString() ||
        crypto.createHash('sha256').update(JSON.stringify(item)).digest('hex').slice(0, 16);

      const transferContent = (item.content || item.description || item.memo || '').toString();
      const accountNumber = (
        item.accountNumber ||
        item.subAccount ||
        item.bank_sub_acc_id ||
        item.subAccId ||
        ''
      ).toString();
      const bankCode = (item.gateway || item.bankName || item.bankCode || '').toString();
      const transactionDate = (
        item.transactionDate ||
        item.when ||
        new Date().toISOString()
      ).toString();

      // Native BullMQ deduplication: jobId = `${gateway}:${txId}`
      const jobId = `${gateway}:${txId}`;

      try {
        await this.reconciliationQueue.add(
          'reconcile',
          {
            workspaceId,
            gateway,
            transactionId: txId,
            amount,
            accountNumber,
            transferContent,
            bankCode,
            transactionDate,
            rawPayload: item,
          },
          {
            jobId,
            removeOnComplete: true,
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        );
        queuedCount++;
      } catch (queueErr: any) {
        // If job already exists in queue, BullMQ deduplicates gracefully
        this.logger.debug(`Job ${jobId} already enqueued or deduplicated: ${queueErr.message}`);
      }
    }

    this.logger.log(
      `Fast-ACK payment webhook from ${gateway} for workspace ${workspaceId}: ${queuedCount} job(s) queued`,
    );

    // 3. Fast-ACK HTTP 200 within < 50ms
    return {
      success: true,
      queued: true,
      count: queuedCount,
    };
  }
}
