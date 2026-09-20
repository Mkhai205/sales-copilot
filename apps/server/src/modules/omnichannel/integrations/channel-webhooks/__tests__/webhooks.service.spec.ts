import { expectReject } from '../../../../../../test/test-assertions';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ChannelType, DeliveryStatus } from '@sales-copilot/shared-contracts';
import { WebhooksService } from '../webhooks.service';
import { WebhooksController } from '../webhooks.controller';
import { ChannelIngestionProcessor } from '../../../../../infrastructure/queue/channel-ingestion.processor';
import { ChannelAdapterRegistry } from '../../channel-adapter.registry';
import { ChannelCredentialService } from '../../../inboxes/channel-credential.service';
import { ConfigService } from '@nestjs/config';
import type { ChannelAdapter } from '../../channel-adapter.interface';
import type {
  InboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../../channel-adapter.types';

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
        updateMany: async ({
          where,
          data,
        }: {
          where: { id?: string; channelId?: string };
          data: any;
        }) => {
          let count = 0;
          for (const [id, ev] of channelEventsDb.entries()) {
            if (
              (!where.id || ev.id === where.id) &&
              (!where.channelId || ev.channelId === where.channelId)
            ) {
              channelEventsDb.set(id, { ...ev, ...data });
              count++;
            }
          }
          return { count };
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

      expect(result).toBe(challenge);
    });

    it('should throw UnauthorizedException when hub.verify_token does not match', async () => {
      await expectReject(
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
          expect(err instanceof UnauthorizedException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INVALID_VERIFY_TOKEN');
          return true;
        },
      );
    });

    it('should throw NotFoundException when channel does not exist', async () => {
      await expectReject(
        () => webhooksService.verifyChallenge('non_existent_channel', {}, {}),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('CHANNEL_NOT_FOUND');
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

      expect(result.success).toBe(true);
      expect(result.duplicated).toBe(false);
      expect(result.eventId).toBeTruthy();

      // Verify ChannelEvent stored
      expect(channelEventsDb.size).toBe(1);
      const storedEvent = channelEventsDb.get(result.eventId!);
      expect(storedEvent).toBeTruthy();
      expect(storedEvent.channelId).toBe(mockChannelId);
      expect(storedEvent.externalEventId).toBe('mid.fb.message.999');

      // Verify BullMQ job dispatched
      expect(dispatchedJobs.length).toBe(1);
      expect(dispatchedJobs[0].name).toBe('process-channel-event');
      expect(dispatchedJobs[0].data.channelId).toBe(mockChannelId);
      expect(dispatchedJobs[0].data.channelEventId).toBe(result.eventId);
      expect(dispatchedJobs[0].opts.jobId).toBe(`${mockChannelId}_${result.eventId}`);
      expect(dispatchedJobs[0].opts.attempts).toBe(3);
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
      expect(job).toBeTruthy();
      expect(job.data.requestId).toBe('req-trace-uuid-12345');
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
      expect(firstResult.success).toBe(true);
      expect(firstResult.duplicated).toBe(false);
      expect(dispatchedJobs.length).toBe(1);

      // 2nd delivery with identical event_id
      const secondResult = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });
      expect(secondResult.success).toBe(true);
      expect(secondResult.duplicated).toBe(true);
      expect(secondResult.eventId).toBe(firstResult.eventId);

      // Job should NOT be dispatched again
      expect(dispatchedJobs.length).toBe(1);
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

        expect(result.success).toBe(true);
        expect(result.duplicated).toBe(true);
        expect(result.eventId).toBe('evt_first_arrival');
      } finally {
        (webhooksService as any).prisma.getClient().channelEvent.create = originalCreate;
      }
    });

    it('should fallback to deterministic SHA-256 hash when externalEventId is omitted', async () => {
      const payload = { text: 'Anonymous event without ID' };

      const result = await webhooksService.handleInboundWebhook(mockChannelId, payload, {
        'x-hub-signature-256': 'valid-signature',
      });

      expect(result.success).toBe(true);
      const storedEvent = channelEventsDb.get(result.eventId!);
      expect(storedEvent.externalEventId).toBeTruthy();
      expect(storedEvent.externalEventId.length).toBe(64); // 64 hex characters SHA-256
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

      await expectReject(
        () =>
          webhooksService.handleInboundWebhook(mockChannelId, payload, {
            'x-hub-signature-256': 'invalid',
          }),
        (err: any) => {
          expect(err instanceof UnauthorizedException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INVALID_WEBHOOK_SIGNATURE');
          return true;
        },
      );
    });

    it('should throw NotFoundException when channel does not exist', async () => {
      await expectReject(
        () => webhooksService.handleInboundWebhook('invalid_channel', {}, {}),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('CHANNEL_NOT_FOUND');
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
      expect(updated.processedAt instanceof Date).toBeTruthy();
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

      expect(res.success).toBe(true);
      expect(res.duplicated).toBe(false);
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

      expect(sentText).toBe('challenge_received');
    });
  });
});
