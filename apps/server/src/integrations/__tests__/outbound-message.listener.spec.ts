import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ChannelType,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { OutboundMessageListener, MessageCreatedEventPayload } from '../outbound-message.listener';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  OutboundMessagePayload,
  SendMessageResult,
} from '../channel-adapter.types';

describe('OutboundMessageListener (Task S-3: Event-driven Outbound Delivery)', () => {
  let listener: OutboundMessageListener;
  let mockPrismaService: any;
  let adapterRegistry: ChannelAdapterRegistry;
  let mockCredentialService: any;

  let conversationsDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let channelIdentitiesDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let deliveredMessages: Array<{ channel: ChannelContext; message: OutboundMessagePayload }>;

  beforeEach(() => {
    conversationsDb = new Map();
    channelsDb = new Map();
    channelIdentitiesDb = new Map();
    messagesDb = new Map();
    deliveredMessages = [];

    const clientMock = {
      conversation: {
        findFirst: async ({ where }: { where: { id: string; workspaceId: string } }) => {
          const conv = conversationsDb.get(where.id);
          if (!conv || conv.workspaceId !== where.workspaceId) return null;

          const channel = channelsDb.get(conv.inboxId);
          const channelIdentity = Array.from(channelIdentitiesDb.values()).find(
            (ci: any) =>
              ci.contactId === conv.contactId &&
              ci.channelId === channel?.id &&
              ci.workspaceId === where.workspaceId,
          );

          return {
            ...conv,
            inbox: {
              id: conv.inboxId,
              channel: channel ? { ...channel } : null,
            },
            channelIdentity: channelIdentity ? { ...channelIdentity } : null,
            contact: {
              id: conv.contactId,
              name: 'Customer 1',
              identifier: conv.contactIdentifier || null,
            },
          };
        },
      },
      channelIdentity: {
        findFirst: async ({
          where,
        }: {
          where: { workspaceId: string; channelId: string; contactId: string };
        }) => {
          const ci = Array.from(channelIdentitiesDb.values()).find(
            (item: any) =>
              item.workspaceId === where.workspaceId &&
              item.channelId === where.channelId &&
              item.contactId === where.contactId,
          );
          return ci ? { ...ci } : null;
        },
      },
      message: {
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const msg = messagesDb.get(where.id);
          if (msg) {
            const updated = { ...msg, ...data };
            messagesDb.set(where.id, updated);
            return { ...updated };
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    mockCredentialService = {
      decrypt: (ciphertext: string) => {
        if (ciphertext === 'encrypted_fb_token') {
          return { pageAccessToken: 'EAAB_PAGE_TOKEN_123' };
        }
        return {};
      },
    };

    adapterRegistry = new ChannelAdapterRegistry();

    // Register a mock Facebook Adapter
    const mockFacebookAdapter: ChannelAdapter = {
      channelType: ChannelType.FACEBOOK_MESSENGER,
      verifyWebhook: () => true,
      parseInboundPayload: () => [],
      sendMessage: async (
        channel: ChannelContext,
        message: OutboundMessagePayload,
      ): Promise<SendMessageResult> => {
        deliveredMessages.push({ channel, message });
        return {
          externalMessageId: 'mid.fb.outbound.999',
          deliveryStatus: DeliveryStatus.SENT,
        };
      },
      getChannelInfo: async () => ({ name: 'FB Page' }),
    };

    adapterRegistry.register(mockFacebookAdapter);

    listener = new OutboundMessageListener(
      mockPrismaService,
      adapterRegistry,
      mockCredentialService,
    );

    // Seed conversation and channel
    channelsDb.set('ib_1', {
      id: 'ch_fb_1',
      workspaceId: 'ws_test',
      inboxId: 'ib_1',
      channelType: ChannelType.FACEBOOK_MESSENGER,
      providerAccountId: 'page_123',
      credentials: { encrypted: 'encrypted_fb_token' },
      isConnected: true,
    });

    conversationsDb.set('conv_1', {
      id: 'conv_1',
      workspaceId: 'ws_test',
      inboxId: 'ib_1',
      contactId: 'cnt_1',
      channelIdentityId: 'ident_1',
    });

    channelIdentitiesDb.set('ident_1', {
      id: 'ident_1',
      workspaceId: 'ws_test',
      channelId: 'ch_fb_1',
      contactId: 'cnt_1',
      externalContactId: 'psid_user_777',
    });
  });

  it('should deliver outgoing message successfully via registered ChannelAdapter', async () => {
    const msgId = 'msg_out_1';
    messagesDb.set(msgId, {
      id: msgId,
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      senderType: SenderType.USER,
      senderId: 'usr_agent_1',
      messageType: MessageType.OUTGOING,
      contentType: MessageContentType.TEXT,
      content: 'Hello customer! How can I help you?',
      deliveryStatus: DeliveryStatus.PENDING,
      externalId: null,
    });

    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      message: {
        id: msgId,
        workspaceId: 'ws_test',
        conversationId: 'conv_1',
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Hello customer! How can I help you?',
        isPrivate: false,
        deliveryStatus: DeliveryStatus.PENDING,
        externalId: null,
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    // 1. Adapter received message
    assert.strictEqual(deliveredMessages.length, 1);
    assert.strictEqual(deliveredMessages[0].message.recipientExternalId, 'psid_user_777');
    assert.strictEqual(deliveredMessages[0].message.content, 'Hello customer! How can I help you?');
    assert.strictEqual(
      deliveredMessages[0].channel.credentials.pageAccessToken,
      'EAAB_PAGE_TOKEN_123',
    );

    // 2. Message record updated in database
    const updated = messagesDb.get(msgId);
    assert.strictEqual(updated.externalId, 'mid.fb.outbound.999');
    assert.strictEqual(updated.deliveryStatus, DeliveryStatus.SENT);
  });

  it('should skip incoming messages (MessageType.INCOMING)', async () => {
    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      message: {
        id: 'msg_in_1',
        workspaceId: 'ws_test',
        conversationId: 'conv_1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        contentType: MessageContentType.TEXT,
        content: 'Customer inbound query',
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    assert.strictEqual(deliveredMessages.length, 0);
  });

  it('should skip private notes (isPrivate = true)', async () => {
    const msgId = 'msg_note_1';
    messagesDb.set(msgId, {
      id: msgId,
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      senderType: SenderType.USER,
      messageType: MessageType.OUTGOING,
      contentType: MessageContentType.TEXT,
      content: 'Internal agent note: customer asked for 10% discount',
      isPrivate: true,
    });

    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      isPrivate: true,
      message: {
        id: msgId,
        workspaceId: 'ws_test',
        conversationId: 'conv_1',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Internal agent note: customer asked for 10% discount',
        isPrivate: true,
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    assert.strictEqual(deliveredMessages.length, 0);
  });

  it('should skip messages originating from contacts (SenderType.CONTACT)', async () => {
    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      message: {
        id: 'msg_contact_out',
        workspaceId: 'ws_test',
        conversationId: 'conv_1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.OUTGOING, // edge case
        contentType: MessageContentType.TEXT,
        content: 'Should not deliver contact outbound',
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    assert.strictEqual(deliveredMessages.length, 0);
  });

  it('should skip when no adapter is registered for channelType', async () => {
    channelsDb.set('ib_unsupported', {
      id: 'ch_telegram_unreg',
      workspaceId: 'ws_test',
      inboxId: 'ib_unsupported',
      channelType: ChannelType.TELEGRAM,
      credentials: {},
    });

    conversationsDb.set('conv_tg', {
      id: 'conv_tg',
      workspaceId: 'ws_test',
      inboxId: 'ib_unsupported',
      contactId: 'cnt_1',
    });

    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_tg',
      message: {
        id: 'msg_unreg',
        workspaceId: 'ws_test',
        conversationId: 'conv_tg',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Hello on Telegram',
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    assert.strictEqual(deliveredMessages.length, 0);
  });

  it('should mark message as FAILED when no recipient external ID is found', async () => {
    // Conversation with contact having no identity
    conversationsDb.set('conv_no_ident', {
      id: 'conv_no_ident',
      workspaceId: 'ws_test',
      inboxId: 'ib_1',
      contactId: 'cnt_unknown_identity',
    });

    const msgId = 'msg_fail_no_id';
    messagesDb.set(msgId, {
      id: msgId,
      workspaceId: 'ws_test',
      conversationId: 'conv_no_ident',
      deliveryStatus: DeliveryStatus.PENDING,
    });

    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_no_ident',
      message: {
        id: msgId,
        workspaceId: 'ws_test',
        conversationId: 'conv_no_ident',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Hello stranger',
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    const updated = messagesDb.get(msgId);
    assert.strictEqual(updated.deliveryStatus, DeliveryStatus.FAILED);
    assert.strictEqual(updated.metadata?.deliveryError, 'NO_RECIPIENT_EXTERNAL_ID');
    assert.strictEqual(deliveredMessages.length, 0);
  });

  it('should mark message as FAILED when adapter.sendMessage throws an error', async () => {
    // Register failing adapter
    const failingAdapter: ChannelAdapter = {
      channelType: ChannelType.FACEBOOK_MESSENGER,
      verifyWebhook: () => true,
      parseInboundPayload: () => [],
      sendMessage: async () => {
        throw new Error('Facebook Graph API error (#100): Invalid parameter');
      },
      getChannelInfo: async () => ({ name: 'FB Page' }),
    };

    adapterRegistry.register(failingAdapter);

    const msgId = 'msg_failing_delivery';
    messagesDb.set(msgId, {
      id: msgId,
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      deliveryStatus: DeliveryStatus.PENDING,
    });

    const eventPayload: MessageCreatedEventPayload = {
      workspaceId: 'ws_test',
      conversationId: 'conv_1',
      message: {
        id: msgId,
        workspaceId: 'ws_test',
        conversationId: 'conv_1',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Message that will fail',
      },
    };

    await listener.handleOutboundMessage(eventPayload);

    const updated = messagesDb.get(msgId);
    assert.strictEqual(updated.deliveryStatus, DeliveryStatus.FAILED);
    assert.ok(updated.metadata?.deliveryError?.includes('Facebook Graph API error (#100)'));
  });
});
