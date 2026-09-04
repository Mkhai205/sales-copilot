import { Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { ChannelAdapterRegistry } from '../../integrations/channel-adapter.registry';
import { ChannelCredentialService } from '../inboxes';
import { CHANNEL_INGESTION_QUEUE } from '../../infrastructure/queue';

export interface InboundWebhookResult {
  success: boolean;
  eventId?: string;
  duplicated?: boolean;
}

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: ChannelAdapterRegistry,
    private readonly credentialService: ChannelCredentialService,
    @InjectQueue(CHANNEL_INGESTION_QUEUE) private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Helper to decrypt stored channel credentials.
   */
  private decryptCredentials(rawCredentials: unknown): Record<string, unknown> {
    if (!rawCredentials) return {};
    if (typeof rawCredentials === 'object' && rawCredentials !== null) {
      const credsObj = rawCredentials as Record<string, any>;
      if (credsObj.encrypted && typeof credsObj.encrypted === 'string') {
        try {
          return this.credentialService.decrypt(credsObj.encrypted);
        } catch {
          this.logger.warn('Failed to decrypt channel credentials');
          return {};
        }
      }
    } else if (typeof rawCredentials === 'string' && rawCredentials.includes(':')) {
      try {
        return this.credentialService.decrypt(rawCredentials);
      } catch {
        this.logger.warn('Failed to decrypt channel credentials string');
        return {};
      }
    }
    return {};
  }

  /**
   * Extracts an external event ID from payload or computes a deterministic SHA-256 hash.
   */
  private extractEventId(rawBody: unknown): string {
    if (rawBody && typeof rawBody === 'object') {
      const body = rawBody as Record<string, any>;
      // Common provider event ID structures
      const candidateId =
        body.event_id ||
        body.eventId ||
        body.externalMessageId ||
        body.external_message_id ||
        body.entry?.[0]?.messaging?.[0]?.message?.mid ||
        body.entry?.[0]?.messaging?.[0]?.delivery?.mids?.[0] ||
        body.update_id ||
        body.message_id ||
        body.messageId ||
        body.id ||
        body.entry?.[0]?.id;

      if (candidateId && typeof candidateId === 'string') {
        return candidateId;
      }
      if (candidateId && typeof candidateId === 'number') {
        return candidateId.toString();
      }
    }

    // Fallback: Deterministic SHA-256 hash of the payload
    const serialized = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Handles GET webhook challenge verification handshakes (e.g. Facebook Hub Challenge).
   */
  async verifyChallenge(
    channelId: string,
    query: Record<string, any>,
    headers: Record<string, any>,
  ): Promise<string | boolean> {
    const client = this.prisma.getClient();
    const channel = await client.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel with ID '${channelId}' not found`,
      });
    }

    const credentials = this.decryptCredentials(channel.credentials);
    const adapter = this.adapterRegistry.get(channel.channelType as ChannelType);

    // 1. Check Facebook-style hub.challenge
    if (query['hub.mode'] === 'subscribe') {
      const expectedToken = credentials.verifyToken || credentials.webhookSecret;
      if (expectedToken && query['hub.verify_token'] === expectedToken) {
        return query['hub.challenge'];
      }
      throw new UnauthorizedException({
        code: 'INVALID_VERIFY_TOKEN',
        message: 'Webhook verification token mismatch',
      });
    }

    // 2. Delegate to adapter verification
    const isValid = await adapter.verifyWebhook(
      {
        headers,
        query,
        webhookSecret: (credentials.webhookSecret as string) || (credentials.appSecret as string),
      },
      credentials,
    );

    if (!isValid) {
      throw new UnauthorizedException({
        code: 'INVALID_WEBHOOK_CHALLENGE',
        message: 'Webhook challenge verification failed',
      });
    }

    return query['hub.challenge'] || true;
  }

  /**
   * Processes inbound webhook event: authenticates signature, deduplicates via ChannelEvent,
   * stores raw event, and enqueues BullMQ background ingestion job.
   */
  async handleInboundWebhook(
    channelId: string,
    rawBody: unknown,
    headers: Record<string, any>,
    query?: Record<string, any>,
    options?: { skipSignatureVerification?: boolean },
  ): Promise<InboundWebhookResult> {
    const client = this.prisma.getClient();

    // 1. Retrieve channel
    const channel = await client.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new NotFoundException({
        code: 'CHANNEL_NOT_FOUND',
        message: `Channel with ID '${channelId}' not found`,
      });
    }

    // 2. Resolve adapter & decrypted credentials
    const adapter = this.adapterRegistry.get(channel.channelType as ChannelType);
    const credentials = this.decryptCredentials(channel.credentials);

    // 3. Authenticate signature (skip if already verified at platform level, e.g. Central Webhook)
    if (!options?.skipSignatureVerification) {
      const isValidSignature = await adapter.verifyWebhook(
        {
          headers,
          rawBody,
          query,
          webhookSecret: (credentials.webhookSecret as string) || (credentials.appSecret as string),
        },
        credentials,
      );

      if (!isValidSignature) {
        this.logger.warn(`Signature verification failed for channel '${channelId}'`);
        throw new UnauthorizedException({
          code: 'INVALID_WEBHOOK_SIGNATURE',
          message: 'Webhook signature verification failed',
        });
      }
    }

    // 4. Extract external event ID & determine event type
    const externalEventId = this.extractEventId(rawBody);
    const eventType =
      (rawBody as any)?.object ||
      (rawBody as any)?.event ||
      (rawBody as any)?.type ||
      headers['x-event-type'] ||
      'inbound_webhook';

    // 5. Deduplication check (Idempotency)
    const existingEvent = await client.channelEvent.findUnique({
      where: {
        channelId_externalEventId: {
          channelId,
          externalEventId,
        },
      },
    });

    if (existingEvent) {
      this.logger.log(
        `Duplicate event '${externalEventId}' received for channel '${channelId}'. Skipping dispatch.`,
      );
      return {
        success: true,
        eventId: existingEvent.id,
        duplicated: true,
      };
    }

    // 6. Persist ChannelEvent (with concurrent duplicate race protection)
    let channelEvent;
    try {
      channelEvent = await client.channelEvent.create({
        data: {
          channelId,
          externalEventId,
          eventType: typeof eventType === 'string' ? eventType : 'inbound_webhook',
          payload: (rawBody as any) ?? {},
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const concurrentEvent = await client.channelEvent.findUnique({
          where: {
            channelId_externalEventId: {
              channelId,
              externalEventId,
            },
          },
        });
        this.logger.log(
          `Concurrent duplicate event '${externalEventId}' caught for channel '${channelId}'. Skipping dispatch.`,
        );
        return {
          success: true,
          eventId: concurrentEvent?.id ?? 'duplicate',
          duplicated: true,
        };
      }
      throw err;
    }

    // 7. Enqueue BullMQ background job with deterministic jobId & trace ID forwarding (T10.5.4 & T10.5.6)
    const requestId = headers['x-request-id'] || headers['x-correlation-id'];
    await this.ingestionQueue.add(
      'process-channel-event',
      {
        channelId,
        channelEventId: channelEvent.id,
        eventType: channelEvent.eventType,
        payload: rawBody,
        ...(requestId ? { requestId: String(requestId) } : {}),
      },
      {
        jobId: `${channelId}_${channelEvent.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30_000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Enqueued ingestion job for event '${externalEventId}' on channel '${channelId}' (channelEventId: ${channelEvent.id})`,
    );

    return {
      success: true,
      eventId: channelEvent.id,
      duplicated: false,
    };
  }
}
