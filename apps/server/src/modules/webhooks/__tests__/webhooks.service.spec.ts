import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ChannelType, DeliveryStatus } from '@sales-copilot/shared-contracts';
import { WebhooksService } from '../webhooks.service';
import { WebhooksController } from '../webhooks.controller';
import { ChannelIngestionProcessor } from '../../../infrastructure/queue/channel-ingestion.processor';
import { ChannelAdapterRegistry } from '../../../integrations/channel-adapter.registry';
import { ChannelCredentialService } from '../../inboxes/channel-credential.service';
import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter } from '../../../integrations/channel-adapter.interface';
import type {
  InboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../../../integrations/channel-adapter.types';

describe('Inbound Webhook Ingestion Pipeline (Feature F-1.3.4 & BullMQ Stub)', () => {
  let webhooksService: WebhooksService;
  let webhooksController: WebhooksController;
  let processor: ChannelIngestionProcessor;
  let adapterRegistry: ChannelAdapterRegistry;

  let channelsDb: Map<string, any>;
  let channelEventsDb: Map<string, any>;
  let dispatchedJobs: any[];

  const mockChannelId = 'chn_fb_123';
  const mockWebhookSecret = 'super_secret_webhook_key';

  // Mock Facebook Channel Adapter
  const mockFacebookAdapter: ChannelAdapter = {
    channelType: ChannelType.FACEBOOK_MESSENGER,
    async verifyWebhook(request: WebhookVerificationRequest): Promise<boolean> {
      // Valid if secret matches or signature header is 'valid-signature'
      if (request.headers['x-hub-signature-256'] === 'valid-signature') {
        return true;
      }
      if (request.webhookSecret === mockWebhookSecret) {
        return true;
      }
      return false;
    },
    async parseInboundPayload(
      _rawBody: unknown,
      _headers?: Record<string, string | string[] | undefined>,
    ): Promise<InboundMessagePayload[]> {
      return [];
    },
    async sendMessage(): Promise<SendMessageResult> {
      return { externalMessageId: 'msg_1', deliveryStatus: DeliveryStatus.DELIVERED };
    },
    async getChannelInfo(): Promise<any> {
      return { id: 'fb_page_1', name: 'FB Page' };
    },
  };

  beforeEach(() => {
    channelsDb = new Map();
    channelEventsDb = new Map();
    dispatchedJobs = [];

    const mockConfigService = {
      get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const credentialService = new ChannelCredentialService(
      mockConfigService as unknown as ConfigService,
    );

    const encryptedSecret = credentialService.encrypt({
      webhookSecret: mockWebhookSecret,
      verifyToken: 'my_verify_token',
    });

    channelsDb.set(mockChannelId, {
      id: mockChannelId,
      workspaceId: 'ws_alpha_1',
      inboxId: 'ib_123',
      channelType: ChannelType.FACEBOOK_MESSENGER,
      credentials: { encrypted: encryptedSecret },
      isConnected: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    adapterRegistry = new ChannelAdapterRegistry();
    adapterRegistry.register(mockFacebookAdapter);

    const clientMock = {
      channel: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          return channelsDb.get(where.id) || null;
        },
      },
      channelEvent: {
        findUnique: async ({
          where,
        }: {
          where: {
            channelId_externalEventId?: { channelId: string; externalEventId: string };
            id?: string;
          };
        }) => {
          if (where.channelId_externalEventId) {
            const { channelId, externalEventId } = where.channelId_externalEventId;
            for (const ev of channelEventsDb.values()) {
              if (ev.channelId === channelId && ev.externalEventId === externalEventId) {
                return ev;
              }
            }
            return null;
          }
          if (where.id) {
            return channelEventsDb.get(where.id) || null;
          }
          return null;
        },
        create: async ({ data }: { data: any }) => {
          const newEvent = {
            id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            processedAt: null,
            createdAt: new Date(),
          };
          channelEventsDb.set(newEvent.id, newEvent);
          return newEvent;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = channelEventsDb.get(where.id);
          if (!existing) return null;
          const updated = { ...existing, ...data };
          channelEventsDb.set(where.id, updated);
          return updated;
        },
      },
    };

    const mockPrismaService: any = {
      getClient: () => clientMock,
    };

    const mockQueue: any = {
      add: async (name: string, data: any, opts: any) => {
        dispatchedJobs.push({ name, data, opts });
        return { id: `job_${Date.now()}` };
      },
    };

    webhooksService = new WebhooksService(
      mockPrismaService,
      adapterRegistry,
      credentialService,
      mockQueue,
    );

    webhooksController = new WebhooksController(webhooksService);

    const mockContactResolutionService: any = {
      resolveFromChannel: async () => ({
        contact: { id: 'cnt_mock', name: 'Mock Contact' },
        identity: { id: 'ident_mock' },
      }),
    };
    const mockConversationsService: any = {
      findOrCreateActiveConversation: async () => ({ id: 'conv_mock' }),
    };
    const mockMessagesService: any = {
      create: async () => ({ id: 'msg_mock' }),
    };

    processor = new ChannelIngestionProcessor(
      mockPrismaService,
      mockContactResolutionService,
      mockConversationsService,
      mockMessagesService,
      adapterRegistry,
    );
  });

  describe('GET /channels/:channelId/webhook (Verification Handshake)', () => {
    it('should verify Facebook hub.challenge when verify token matches', async () => {
      const challenge = 'challenge_code_123456';
      const result = await webhooksService.verifyChallenge(
        mockChannelId,
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_verify_token',
          'hub.challenge': challenge,
        },
        {},
      );

      assert.strictEqual(result, challenge);
    });

    it('should throw UnauthorizedException when hub.verify_token does not match', async () => {
      await assert.rejects(
        () =>
          webhooksService.verifyChallenge(
            mockChannelId,
            {
              'hub.mode': 'subscribe',
              'hub.verify_token': 'wrong_token',
              'hub.challenge': '12345',
            },
            {},
          ),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_VERIFY_TOKEN');
          return true;
        },
      );
    });

    it('should throw NotFoundException when channel does not exist', async () => {
      await assert.rejects(
        () => webhooksService.verifyChallenge('non_existent_channel', {}, {}),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('POST /channels/:channelId/webhook (Inbound Ingestion & Deduplication)', () => {
    it('should successfully ingest payload, store ChannelEvent, and dispatch BullMQ job', async () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'entry_123',
            messaging: [
              {
                message: { mid: 'mid.fb.message.999', text: 'Hello Sales Copilot!' },
              },
            ],
          },
        ],
      };

      const result = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.duplicated, false);
      assert.ok(result.eventId);

      // Verify ChannelEvent stored
      assert.strictEqual(channelEventsDb.size, 1);
      const storedEvent = channelEventsDb.get(result.eventId!);
      assert.ok(storedEvent);
      assert.strictEqual(storedEvent.channelId, mockChannelId);
      assert.strictEqual(storedEvent.externalEventId, 'mid.fb.message.999');

      // Verify BullMQ job dispatched
      assert.strictEqual(dispatchedJobs.length, 1);
      assert.strictEqual(dispatchedJobs[0].name, 'process-channel-event');
      assert.strictEqual(dispatchedJobs[0].data.channelId, mockChannelId);
      assert.strictEqual(dispatchedJobs[0].data.channelEventId, result.eventId);
      assert.strictEqual(dispatchedJobs[0].opts.jobId, `${mockChannelId}_${result.eventId}`);
      assert.strictEqual(dispatchedJobs[0].opts.attempts, 3);
    });

    it('should forward x-request-id as requestId in job data (FINDING-P8-02)', async () => {
      const payload = {
        event_id: 'evt_trace_101',
        text: 'Trace test',
      };

      await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
        'x-request-id': 'req-trace-uuid-12345',
      });

      const job = dispatchedJobs.find(j => (j.data.payload as any)?.event_id === 'evt_trace_101');
      assert.ok(job);
      assert.strictEqual(job.data.requestId, 'req-trace-uuid-12345');
    });

    it('should deduplicate repeated webhook delivery and skip BullMQ queue dispatch', async () => {
      const payload = {
        event_id: 'evt_unique_101',
        text: 'Repeated notification',
      };

      // 1st delivery
      const firstResult = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });
      assert.strictEqual(firstResult.success, true);
      assert.strictEqual(firstResult.duplicated, false);
      assert.strictEqual(dispatchedJobs.length, 1);

      // 2nd delivery with identical event_id
      const secondResult = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });
      assert.strictEqual(secondResult.success, true);
      assert.strictEqual(secondResult.duplicated, true);
      assert.strictEqual(secondResult.eventId, firstResult.eventId);

      // Job should NOT be dispatched again
      assert.strictEqual(dispatchedJobs.length, 1);
    });

    it('should catch P2002 unique constraint collision during concurrent create and return duplicated: true', async () => {
      const payload = {
        event_id: 'evt_race_condition',
        text: 'Concurrent race',
      };

      // Seed an existing event in DB
      const existing = {
        id: 'evt_first_arrival',
        channelId: mockChannelId,
        externalEventId: 'evt_race_condition',
        eventType: 'inbound_webhook',
        payload,
      };
      channelEventsDb.set(existing.id, existing);

      // Force create to throw P2002 (simulating race condition after findUnique returned null)
      const originalCreate = (webhooksService as any).prisma.getClient().channelEvent.create;
      (webhooksService as any).prisma.getClient().channelEvent.create = async () => {
        const err: any = new Error('Unique constraint failed on (channelId, externalEventId)');
        err.code = 'P2002';
        throw err;
      };

      try {
        const result = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
          'x-hub-signature-256': 'valid-signature',
        });

        assert.strictEqual(result.success, true);
        assert.strictEqual(result.duplicated, true);
        assert.strictEqual(result.eventId, 'evt_first_arrival');
      } finally {
        (webhooksService as any).prisma.getClient().channelEvent.create = originalCreate;
      }
    });

    it('should fallback to deterministic SHA-256 hash when externalEventId is omitted', async () => {
      const payload = { text: 'Anonymous event without ID' };

      const result = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });

      assert.strictEqual(result.success, true);
      const storedEvent = channelEventsDb.get(result.eventId!);
      assert.ok(storedEvent.externalEventId);
      assert.strictEqual(storedEvent.externalEventId.length, 64); // 64 hex characters SHA-256
    });

    it('should reject invalid signature with UnauthorizedException (INVALID_WEBHOOK_SIGNATURE)', async () => {
      const payload = { text: 'Tampered payload' };

      // Make adapter fail verification
      const failingAdapter: ChannelAdapter = {
        ...mockFacebookAdapter,
        async verifyWebhook() {
          return false;
        },
      };
      adapterRegistry.register(failingAdapter);

      await assert.rejects(
        () =>
          webhooksService.handleInboundWebhook(mockChannelId, payload, {
            'x-hub-signature-256': 'invalid',
          }),
        (err: any) => {
          assert.ok(err instanceof UnauthorizedException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_WEBHOOK_SIGNATURE');
          return true;
        },
      );
    });

    it('should throw NotFoundException when channel does not exist', async () => {
      await assert.rejects(
        () => webhooksService.handleInboundWebhook('invalid_channel', {}, {}),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('ChannelIngestionProcessor (BullMQ Skeleton Worker)', () => {
    it('should process job and update processedAt on ChannelEvent', async () => {
      // Setup stored ChannelEvent
      const event = {
        id: 'evt_job_test_1',
        channelId: mockChannelId,
        externalEventId: 'ext_1',
        eventType: 'message',
        payload: { text: 'Hi' },
        processedAt: null,
      };
      channelEventsDb.set(event.id, event);

      const mockJob: any = {
        id: 'bullmq_job_1',
        data: {
          channelId: mockChannelId,
          channelEventId: event.id,
          eventType: 'message',
          payload: { text: 'Hi' },
        },
      };

      await processor.process(mockJob);

      const updated = channelEventsDb.get(event.id);
      assert.ok(updated.processedAt instanceof Date);
    });
  });

  describe('WebhooksController Endpoints', () => {
    it('should delegate handleInboundWebhook request', async () => {
      const payload = { id: 'webhook_ctrl_1', msg: 'test' };
      const res = await webhooksController.handleInboundWebhook(
        mockChannelId,
        payload,
        { 'x-hub-signature-256': 'valid-signature' },
        {},
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.duplicated, false);
    });

    it('should delegate verifyWebhook request', async () => {
      let sentText = '';
      const mockRes: any = {
        status: () => mockRes,
        send: (text: string) => {
          sentText = text;
        },
      };

      await webhooksController.verifyWebhook(
        mockChannelId,
        {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'my_verify_token',
          'hub.challenge': 'challenge_received',
        },
        {},
        mockRes,
      );

      assert.strictEqual(sentText, 'challenge_received');
    });
  });
});
