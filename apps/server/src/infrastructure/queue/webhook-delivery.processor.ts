import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhookDeliveryStatus } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../database';
import { computeWebhookSignature } from '../../modules/webhooks/webhook-signer';

export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

export interface WebhookDeliveryJobData {
  deliveryId: string;
  subscriptionId: string;
  workspaceId: string;
  url: string;
  secretKey?: string | null;
  eventType: string;
  payload: {
    event: string;
    data: unknown;
    timestamp: string;
    workspaceId: string;
    [key: string]: unknown;
  };
  requestId?: string;
}

/**
 * BullMQ processor responsible for executing outbound webhook deliveries.
 * Handles HMAC-SHA256 signature signing, HTTP POST invocation with 10s timeout,
 * exponential backoff retry state management, and logging in WebhookDelivery.
 */
@Processor(WEBHOOK_DELIVERY_QUEUE)
@Injectable()
export class WebhookDeliveryProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveryProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  /**
   * Helper to truncate string response bodies to prevent bloat in the database.
   */
  private truncate(str: string, maxLength = 2000): string {
    if (!str) return '';
    return str.length > maxLength ? `${str.substring(0, maxLength)}... [truncated]` : str;
  }

  /**
   * Calculates next retry timestamp using 30s, 120s, 480s exponential intervals.
   */
  private calculateNextRetryAt(currentAttempt: number): Date {
    const delayMs =
      currentAttempt === 1
        ? 30_000 // 30s
        : currentAttempt === 2
          ? 120_000 // 2m (120s)
          : 480_000; // 8m (480s)
    return new Date(Date.now() + delayMs);
  }

  async process(job: Job<WebhookDeliveryJobData, void, string>): Promise<void> {
    const {
      deliveryId,
      subscriptionId,
      workspaceId,
      url,
      secretKey,
      eventType,
      payload,
      requestId,
    } = job.data;
    const tracePrefix = requestId ? `[${requestId}] ` : '';
    const currentAttempt = (job.attemptsMade ?? 0) + 1;
    const maxAttempts = job.opts?.attempts || 3;
    const isFinalAttempt = currentAttempt >= maxAttempts;
    const nextRetryAt = isFinalAttempt ? null : this.calculateNextRetryAt(currentAttempt);

    this.logger.log(
      `${tracePrefix}Processing webhook delivery '${deliveryId}' (attempt ${currentAttempt}/${maxAttempts}) for event '${eventType}' to '${url}'`,
    );

    const client = this.prisma.getClient();

    // 1. Mark delivery attempt in progress
    try {
      await client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          attemptCount: currentAttempt,
          lastAttemptAt: new Date(),
          status:
            currentAttempt > 1 ? WebhookDeliveryStatus.RETRYING : WebhookDeliveryStatus.PENDING,
        },
      });
    } catch (dbErr) {
      this.logger.warn(
        `${tracePrefix}Failed to update preliminary attempt count for delivery '${deliveryId}': ${(dbErr as Error).message}`,
      );
    }

    // 2. Prepare payload and headers
    const serializedPayload = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'SalesCopilot-Webhook/1.0',
      'X-Webhook-Event': eventType,
      'X-Webhook-Delivery': deliveryId,
      'X-Webhook-Timestamp': payload.timestamp || new Date().toISOString(),
    };

    if (secretKey && secretKey.trim().length > 0) {
      const signature = computeWebhookSignature(serializedPayload, secretKey.trim());
      headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    // 3. Dispatch HTTP POST request with 10s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    // eslint-disable-next-line no-useless-assignment
    let responseBody = '';
    // eslint-disable-next-line no-useless-assignment
    let responseStatus: number | null = null;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: serializedPayload,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      responseStatus = response.status;

      try {
        const rawText = await response.text();
        responseBody = this.truncate(rawText);
      } catch {
        responseBody = '';
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      const isTimeout = fetchErr.name === 'AbortError';
      const errorMsg = isTimeout
        ? `Webhook request to '${url}' timed out after 10000ms`
        : fetchErr?.message || String(fetchErr);

      await client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: isFinalAttempt ? WebhookDeliveryStatus.FAILED : WebhookDeliveryStatus.RETRYING,
          responseStatus: null,
          responseBody: this.truncate(`Network/Timeout Error: ${errorMsg}`),
          nextRetryAt,
        },
      });

      this.logger.warn(
        `${tracePrefix}Webhook delivery '${deliveryId}' failed on attempt ${currentAttempt}/${maxAttempts}: ${errorMsg}`,
      );
      throw fetchErr;
    }

    // 4. Handle HTTP Response Status
    if (response.ok) {
      // 2xx Success
      await client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: WebhookDeliveryStatus.DELIVERED,
          responseStatus,
          responseBody,
          deliveredAt: new Date(),
          nextRetryAt: null,
        },
      });

      this.logger.log(
        `${tracePrefix}Webhook delivery '${deliveryId}' successfully delivered to '${url}' (HTTP ${responseStatus}) on attempt ${currentAttempt}`,
      );
    } else {
      // Non-2xx Failure
      await client.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: isFinalAttempt ? WebhookDeliveryStatus.FAILED : WebhookDeliveryStatus.RETRYING,
          responseStatus,
          responseBody,
          nextRetryAt,
        },
      });

      const errorMsg = `Webhook delivery '${deliveryId}' responded with HTTP ${responseStatus}`;
      this.logger.warn(`${tracePrefix}${errorMsg} on attempt ${currentAttempt}/${maxAttempts}`);
      throw new Error(errorMsg);
    }
  }
}
