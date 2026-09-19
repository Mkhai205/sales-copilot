import { expectThrow, assertDefined } from '../../../../../test/test-assertions';
import { NotFoundException } from '@nestjs/common';
import { ChannelType, DeliveryStatus, MessageContentType } from '@sales-copilot/shared-contracts';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  ChannelInfo,
  InboundMessagePayload,
  OutboundMessagePayload,
  SendMessageResult,
  WebhookVerificationRequest,
} from '../channel-adapter.types';

// Helper to construct a mock ChannelAdapter
function createMockAdapter(channelType: ChannelType): ChannelAdapter {
  return {
    channelType,
    verifyWebhook: (_req: WebhookVerificationRequest, _creds?: Record<string, unknown>) => true,
    parseInboundPayload: (rawBody: unknown): InboundMessagePayload[] => {
      const body = rawBody as any;
      return [
        {
          externalContactId: body?.senderId || 'ext_user_1',
          externalMessageId: body?.msgId || 'ext_msg_1',
          content: body?.text || 'Hello world',
          contentType: MessageContentType.TEXT,
          timestamp: new Date(),
        },
      ];
    },
    sendMessage: async (
      _channel: ChannelContext,
      _msg: OutboundMessagePayload,
    ): Promise<SendMessageResult> => {
      return {
        externalMessageId: 'out_msg_123',
        deliveryStatus: DeliveryStatus.SENT,
      };
    },
    getChannelInfo: async (_channel: ChannelContext): Promise<ChannelInfo> => {
      return {
        providerAccountId: 'page_123',
        name: `Test Channel for ${channelType}`,
      };
    },
  };
}

describe('ChannelAdapterRegistry (Channel Integration Abstraction)', () => {
  let registry: ChannelAdapterRegistry;

  beforeEach(() => {
    registry = new ChannelAdapterRegistry();
  });

  describe('Registration & Retrieval', () => {
    it('should register and retrieve an adapter by its channelType', () => {
      const telegramAdapter = createMockAdapter(ChannelType.TELEGRAM);

      registry.register(telegramAdapter);

      expect(registry.has(ChannelType.TELEGRAM)).toBe(true);
      const retrieved = registry.get(ChannelType.TELEGRAM);
      expect(retrieved).toBe(telegramAdapter);
      expect(retrieved.channelType).toBe(ChannelType.TELEGRAM);
    });

    it('should support registration with explicit channelType parameter', () => {
      const zaloAdapter = createMockAdapter(ChannelType.ZALO);

      registry.register(ChannelType.ZALO, zaloAdapter);

      expect(registry.has(ChannelType.ZALO)).toBe(true);
      const retrieved = registry.get(ChannelType.ZALO);
      expect(retrieved).toBe(zaloAdapter);
    });

    it('should list all registered types and adapter instances', () => {
      const fbAdapter = createMockAdapter(ChannelType.FACEBOOK_MESSENGER);
      const telegramAdapter = createMockAdapter(ChannelType.TELEGRAM);
      const emailAdapter = createMockAdapter(ChannelType.EMAIL);

      registry.register(fbAdapter);
      registry.register(telegramAdapter);
      registry.register(emailAdapter);

      const registeredTypes = registry.getRegisteredTypes();
      expect(registeredTypes.length).toBe(3);
      expect(registeredTypes.includes(ChannelType.FACEBOOK_MESSENGER)).toBeTruthy();
      expect(registeredTypes.includes(ChannelType.TELEGRAM)).toBeTruthy();
      expect(registeredTypes.includes(ChannelType.EMAIL)).toBeTruthy();

      const allAdapters = registry.getAll();
      expect(allAdapters.length).toBe(3);
      expect(allAdapters.includes(fbAdapter)).toBeTruthy();
      expect(allAdapters.includes(telegramAdapter)).toBeTruthy();
      expect(allAdapters.includes(emailAdapter)).toBeTruthy();
    });

    it('should allow overwriting an existing adapter registration', () => {
      const initialAdapter = createMockAdapter(ChannelType.WEB_CHAT);
      const replacementAdapter = createMockAdapter(ChannelType.WEB_CHAT);

      registry.register(initialAdapter);
      expect(registry.get(ChannelType.WEB_CHAT)).toBe(initialAdapter);

      registry.register(replacementAdapter);
      expect(registry.get(ChannelType.WEB_CHAT)).toBe(replacementAdapter);
    });

    it('should clear all registered adapters', () => {
      registry.register(createMockAdapter(ChannelType.TELEGRAM));
      registry.register(createMockAdapter(ChannelType.ZALO));

      expect(registry.getAll().length).toBe(2);

      registry.clear();

      expect(registry.getAll().length).toBe(0);
      expect(registry.has(ChannelType.TELEGRAM)).toBe(false);
    });
  });

  describe('Error Handling & Invariants', () => {
    it('should throw NotFoundException when getting an unregistered adapter', () => {
      expect(registry.has(ChannelType.ZALO)).toBe(false);

      expectThrow(
        () => registry.get(ChannelType.ZALO),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          const response = err.getResponse() as any;
          expect(response.code).toBe('CHANNEL_ADAPTER_NOT_FOUND');
          expect(response.details?.channelType).toBe(ChannelType.ZALO);
          return true;
        },
      );
    });

    it('should throw Error when registering invalid adapter object', () => {
      expectThrow(() => registry.register({} as any), /valid channelType/);
    });

    it('should throw Error when registering with type but missing adapter instance', () => {
      expectThrow(
        () => registry.register(ChannelType.TELEGRAM, undefined as any),
        /Adapter instance must be provided/,
      );
    });
  });

  describe('ChannelAdapter Contract Invocations', () => {
    it('should execute all 4 ChannelAdapter contract methods successfully on a registered adapter', async () => {
      const adapter = createMockAdapter(ChannelType.FACEBOOK_MESSENGER);
      registry.register(adapter);

      const resolvedAdapter = registry.get(ChannelType.FACEBOOK_MESSENGER);

      // 1. verifyWebhook
      const isValid = await resolvedAdapter.verifyWebhook({
        headers: { 'x-hub-signature-256': 'sha256=123' },
        rawBody: '{"entry":[]}',
      });
      expect(isValid).toBe(true);

      // 2. parseInboundPayload
      const inboundPayloads = await resolvedAdapter.parseInboundPayload({
        senderId: 'psid_9999',
        msgId: 'mid_8888',
        text: 'Xin chào shop!',
      });
      expect(Array.isArray(inboundPayloads)).toBe(true);
      expect(inboundPayloads.length).toBe(1);
      expect(inboundPayloads[0].externalContactId).toBe('psid_9999');
      expect(inboundPayloads[0].externalMessageId).toBe('mid_8888');
      expect(inboundPayloads[0].content).toBe('Xin chào shop!');
      expect(inboundPayloads[0].contentType).toBe(MessageContentType.TEXT);

      // 3. sendMessage
      const channelContext: ChannelContext = {
        channelId: 'chn_123',
        inboxId: 'ib_123',
        workspaceId: 'ws_123',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        credentials: { accessToken: 'EAAB...' },
        providerAccountId: 'page_123',
      };
      const outboundPayload: OutboundMessagePayload = {
        recipientExternalId: 'psid_9999',
        content: 'Dạ shop có thể hỗ trợ gì cho bạn?',
        contentType: MessageContentType.TEXT,
      };

      const sendResult = await resolvedAdapter.sendMessage(channelContext, outboundPayload);
      expect(sendResult.externalMessageId).toBe('out_msg_123');
      expect(sendResult.deliveryStatus).toBe(DeliveryStatus.SENT);

      // 4. getChannelInfo
      const info = await resolvedAdapter.getChannelInfo(channelContext);
      expect(info.providerAccountId).toBe('page_123');
      expect(info.name).toBe(`Test Channel for ${ChannelType.FACEBOOK_MESSENGER}`);
    });

    it('should support parsing inbound delivery status payloads with DeliveryStatusInfo', async () => {
      const deliveryReceiptAdapter: ChannelAdapter = {
        channelType: ChannelType.FACEBOOK_MESSENGER,
        verifyWebhook: () => true,
        parseInboundPayload: (rawBody: unknown): InboundMessagePayload[] => {
          const body = rawBody as any;
          if (body?.delivery) {
            return [
              {
                eventKind: 'delivery_status',
                externalContactId: body.senderId,
                externalMessageId: body.delivery.mid,
                contentType: MessageContentType.TEXT,
                timestamp: new Date(),
                deliveryStatusInfo: {
                  externalMessageId: body.delivery.mid,
                  status: DeliveryStatus.DELIVERED,
                  timestamp: new Date(body.delivery.watermark || Date.now()),
                },
              },
            ];
          }
          return [];
        },
        sendMessage: async () => ({
          externalMessageId: 'out_1',
          deliveryStatus: DeliveryStatus.SENT,
        }),
        getChannelInfo: async () => ({ name: 'FB' }),
      };

      registry.register(deliveryReceiptAdapter);

      const parsed = await registry.get(ChannelType.FACEBOOK_MESSENGER).parseInboundPayload({
        senderId: 'psid_123',
        delivery: { mid: 'mid_delivered_1', watermark: 1700000000000 },
      });

      expect(parsed.length).toBe(1);
      expect(parsed[0].eventKind).toBe('delivery_status');
      expect(parsed[0].externalContactId).toBe('psid_123');
      assertDefined(parsed[0].deliveryStatusInfo);
      expect(parsed[0].deliveryStatusInfo.externalMessageId).toBe('mid_delivered_1');
      expect(parsed[0].deliveryStatusInfo.status).toBe(DeliveryStatus.DELIVERED);
    });
  });
});
