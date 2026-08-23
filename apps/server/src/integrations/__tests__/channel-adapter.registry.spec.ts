import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
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

      assert.strictEqual(registry.has(ChannelType.TELEGRAM), true);
      const retrieved = registry.get(ChannelType.TELEGRAM);
      assert.strictEqual(retrieved, telegramAdapter);
      assert.strictEqual(retrieved.channelType, ChannelType.TELEGRAM);
    });

    it('should support registration with explicit channelType parameter', () => {
      const zaloAdapter = createMockAdapter(ChannelType.ZALO);

      registry.register(ChannelType.ZALO, zaloAdapter);

      assert.strictEqual(registry.has(ChannelType.ZALO), true);
      const retrieved = registry.get(ChannelType.ZALO);
      assert.strictEqual(retrieved, zaloAdapter);
    });

    it('should list all registered types and adapter instances', () => {
      const fbAdapter = createMockAdapter(ChannelType.FACEBOOK_MESSENGER);
      const telegramAdapter = createMockAdapter(ChannelType.TELEGRAM);
      const emailAdapter = createMockAdapter(ChannelType.EMAIL);

      registry.register(fbAdapter);
      registry.register(telegramAdapter);
      registry.register(emailAdapter);

      const registeredTypes = registry.getRegisteredTypes();
      assert.strictEqual(registeredTypes.length, 3);
      assert.ok(registeredTypes.includes(ChannelType.FACEBOOK_MESSENGER));
      assert.ok(registeredTypes.includes(ChannelType.TELEGRAM));
      assert.ok(registeredTypes.includes(ChannelType.EMAIL));

      const allAdapters = registry.getAll();
      assert.strictEqual(allAdapters.length, 3);
      assert.ok(allAdapters.includes(fbAdapter));
      assert.ok(allAdapters.includes(telegramAdapter));
      assert.ok(allAdapters.includes(emailAdapter));
    });

    it('should allow overwriting an existing adapter registration', () => {
      const initialAdapter = createMockAdapter(ChannelType.WEB_CHAT);
      const replacementAdapter = createMockAdapter(ChannelType.WEB_CHAT);

      registry.register(initialAdapter);
      assert.strictEqual(registry.get(ChannelType.WEB_CHAT), initialAdapter);

      registry.register(replacementAdapter);
      assert.strictEqual(registry.get(ChannelType.WEB_CHAT), replacementAdapter);
    });

    it('should clear all registered adapters', () => {
      registry.register(createMockAdapter(ChannelType.TELEGRAM));
      registry.register(createMockAdapter(ChannelType.ZALO));

      assert.strictEqual(registry.getAll().length, 2);

      registry.clear();

      assert.strictEqual(registry.getAll().length, 0);
      assert.strictEqual(registry.has(ChannelType.TELEGRAM), false);
    });
  });

  describe('Error Handling & Invariants', () => {
    it('should throw NotFoundException when getting an unregistered adapter', () => {
      assert.strictEqual(registry.has(ChannelType.ZALO), false);

      assert.throws(
        () => registry.get(ChannelType.ZALO),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          const response = err.getResponse() as any;
          assert.strictEqual(response.code, 'CHANNEL_ADAPTER_NOT_FOUND');
          assert.strictEqual(response.details?.channelType, ChannelType.ZALO);
          return true;
        },
      );
    });

    it('should throw Error when registering invalid adapter object', () => {
      assert.throws(() => registry.register({} as any), /valid channelType/);
    });

    it('should throw Error when registering with type but missing adapter instance', () => {
      assert.throws(
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
      assert.strictEqual(isValid, true);

      // 2. parseInboundPayload
      const inboundPayloads = await resolvedAdapter.parseInboundPayload({
        senderId: 'psid_9999',
        msgId: 'mid_8888',
        text: 'Xin chào shop!',
      });
      assert.strictEqual(Array.isArray(inboundPayloads), true);
      assert.strictEqual(inboundPayloads.length, 1);
      assert.strictEqual(inboundPayloads[0].externalContactId, 'psid_9999');
      assert.strictEqual(inboundPayloads[0].externalMessageId, 'mid_8888');
      assert.strictEqual(inboundPayloads[0].content, 'Xin chào shop!');
      assert.strictEqual(inboundPayloads[0].contentType, MessageContentType.TEXT);

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
      assert.strictEqual(sendResult.externalMessageId, 'out_msg_123');
      assert.strictEqual(sendResult.deliveryStatus, DeliveryStatus.SENT);

      // 4. getChannelInfo
      const info = await resolvedAdapter.getChannelInfo(channelContext);
      assert.strictEqual(info.providerAccountId, 'page_123');
      assert.strictEqual(info.name, `Test Channel for ${ChannelType.FACEBOOK_MESSENGER}`);
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

      assert.strictEqual(parsed.length, 1);
      assert.strictEqual(parsed[0].eventKind, 'delivery_status');
      assert.strictEqual(parsed[0].externalContactId, 'psid_123');
      assert.ok(parsed[0].deliveryStatusInfo);
      assert.strictEqual(parsed[0].deliveryStatusInfo.externalMessageId, 'mid_delivered_1');
      assert.strictEqual(parsed[0].deliveryStatusInfo.status, DeliveryStatus.DELIVERED);
    });
  });
});
