import {
  ChannelType,
  DeliveryStatus,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { OutboundDeliveryProcessor } from '../outbound-delivery.processor';
import { ChannelAdapterRegistry } from '../channel-adapter.registry';
import { ChannelAdapter } from '../channel-adapter.interface';
import {
  ChannelContext,
  OutboundMessagePayload,
  SendMessageResult,
} from '../channel-adapter.types';
import { OutboundDeliveryJobData } from '../outbound-message.listener';

describe('OutboundDeliveryProcessor', () => {
  const workspaceId = 'ws_test';
  const conversationId = 'conv_1';
  const messageId = 'msg_out_1';

  const jobData: OutboundDeliveryJobData = { workspaceId, conversationId, messageId };

  let processor: OutboundDeliveryProcessor;
  let adapterRegistry: ChannelAdapterRegistry;
  let deliveredMessages: Array<{ channel: ChannelContext; message: OutboundMessagePayload }>;
  let deliveryWrites: Array<Record<string, unknown>>;
  let releasedLocks: Array<{ key: string; token: string }>;
  let sendMessageImpl: (
    channel: ChannelContext,
    message: OutboundMessagePayload,
  ) => Promise<SendMessageResult>;
  let seededMessage: Record<string, unknown> | null;
  let seededConversation: boolean;
  let withRecipient: boolean;
  let lockAvailable: boolean;

  const buildJob = (overrides: { attemptsMade?: number; attempts?: number } = {}) =>
    ({
      data: jobData,
      attemptsMade: overrides.attemptsMade ?? 1,
      opts: { attempts: overrides.attempts ?? 5 },
    }) as any;

  const seedMessage = (overrides: Record<string, unknown> = {}) => ({
    id: messageId,
    workspaceId,
    conversationId,
    senderType: SenderType.USER,
    senderId: 'usr_agent_1',
    messageType: MessageType.OUTGOING,
    contentType: MessageContentType.TEXT,
    content: 'Hello customer!',
    deliveryStatus: DeliveryStatus.PENDING,
    externalId: null,
    metadata: {},
    attachments: [],
    ...overrides,
  });

  const createClientMock = () => ({
    message: { findFirst: async () => (seededMessage ? { ...seededMessage } : null) },
    conversation: {
      findFirst: async () => {
        if (!seededConversation) return null;
        return {
          id: conversationId,
          workspaceId,
          inboxId: 'ib_1',
          contactId: 'cnt_1',
          customAttributes: null,
          inbox: {
            id: 'ib_1',
            channel: {
              id: 'ch_fb_1',
              workspaceId,
              channelType: ChannelType.FACEBOOK_MESSENGER,
              providerAccountId: 'page_123',
              credentials: { encrypted: 'encrypted_fb_token' },
              settings: {},
            },
          },
          channelIdentity: withRecipient
            ? { externalContactId: 'psid_user_777', metadata: null }
            : null,
          contact: { id: 'cnt_1', name: 'Customer 1', identifier: null },
        };
      },
    },
    channelIdentity: { findFirst: async () => null },
  });

  const rebuildProcessor = () => {
    adapterRegistry = new ChannelAdapterRegistry();
    if (withAdapter) {
      const mockAdapter: ChannelAdapter = {
        channelType: ChannelType.FACEBOOK_MESSENGER,
        verifyWebhook: () => true,
        parseInboundPayload: () => [],
        sendMessage: async (channel, message) => {
          deliveredMessages.push({ channel, message });
          return sendMessageImpl(channel, message);
        },
        getChannelInfo: async () => ({ name: 'FB Page' }),
      };
      adapterRegistry.register(mockAdapter);
    }

    processor = new OutboundDeliveryProcessor(
      { getClient: () => createClientMock() } as any,
      adapterRegistry,
      { decryptChannelCredentials: () => ({ pageAccessToken: 'EAAB_PAGE_TOKEN_123' }) } as any,
      {
        markOutboundDelivery: async (
          _ws: string,
          _msgId: string,
          result: Record<string, unknown>,
        ) => {
          deliveryWrites.push(result);
          return { id: messageId, ...result };
        },
      } as any,
      {
        acquireLock: async () => (lockAvailable ? 'lock_token_1' : null),
        releaseLock: async (key: string, token: string) => {
          releasedLocks.push({ key, token });
          return true;
        },
      } as any,
      { getSignedUrl: async (key: string) => `https://signed.example/${key}` } as any,
    );
  };

  let withAdapter: boolean;

  beforeEach(() => {
    deliveredMessages = [];
    deliveryWrites = [];
    releasedLocks = [];
    sendMessageImpl = async () => ({
      externalMessageId: 'mid.fb.outbound.999',
      deliveryStatus: DeliveryStatus.SENT,
    });
    seededMessage = seedMessage();
    seededConversation = true;
    withRecipient = true;
    withAdapter = true;
    lockAvailable = true;

    rebuildProcessor();
  });

  it('should deliver via the adapter and mark the message SENT with externalId', async () => {
    await processor.process(buildJob());

    expect(deliveredMessages.length).toBe(1);
    expect(deliveredMessages[0].message.recipientExternalId).toBe('psid_user_777');
    expect(deliveredMessages[0].message.content).toBe('Hello customer!');
    expect(deliveredMessages[0].channel.credentials.pageAccessToken).toBe('EAAB_PAGE_TOKEN_123');

    expect(deliveryWrites).toEqual([
      { externalId: 'mid.fb.outbound.999', deliveryStatus: DeliveryStatus.SENT },
    ]);
    expect(releasedLocks).toEqual([
      { key: `lock:outbound:conv:${conversationId}`, token: 'lock_token_1' },
    ]);
  });

  it('should sign attachment URLs from storage paths for the provider payload', async () => {
    seededMessage = seedMessage({
      attachments: [
        {
          id: 'att_1',
          storagePath: `attachments/${workspaceId}/${messageId}/a.png`,
          fileName: 'a.png',
          fileType: 'IMAGE',
          fileSize: 12,
        },
      ],
    });

    await processor.process(buildJob());

    expect(deliveredMessages[0].message.attachments?.[0].fileUrl).toBe(
      `https://signed.example/attachments/${workspaceId}/${messageId}/a.png`,
    );
  });

  it('should rethrow provider errors before the final attempt so BullMQ retries', async () => {
    sendMessageImpl = async () => {
      throw new Error('Facebook Graph API error (#4): rate limit');
    };

    await expect(processor.process(buildJob({ attemptsMade: 1, attempts: 5 }))).rejects.toThrow(
      'Facebook Graph API error (#4): rate limit',
    );
    expect(deliveryWrites.length).toBe(0);
    expect(releasedLocks.length).toBe(1);
  });

  it('should mark the message FAILED with deliveryError on the final attempt', async () => {
    sendMessageImpl = async () => {
      throw new Error('Facebook Graph API error (#100): Invalid parameter');
    };

    await processor.process(buildJob({ attemptsMade: 5, attempts: 5 }));

    expect(deliveryWrites).toEqual([
      {
        deliveryStatus: DeliveryStatus.FAILED,
        deliveryError: 'Facebook Graph API error (#100): Invalid parameter',
      },
    ]);
    expect(releasedLocks.length).toBe(1);
  });

  it('should mark the message FAILED when no recipient external ID exists', async () => {
    withRecipient = false;
    rebuildProcessor();

    await processor.process(buildJob());

    expect(deliveredMessages.length).toBe(0);
    expect(deliveryWrites).toEqual([
      { deliveryStatus: DeliveryStatus.FAILED, deliveryError: 'NO_RECIPIENT_EXTERNAL_ID' },
    ]);
  });

  it('should mark the message FAILED when no adapter is registered for the channel type', async () => {
    withAdapter = false;
    rebuildProcessor();

    await processor.process(buildJob());

    expect(deliveredMessages.length).toBe(0);
    expect(deliveryWrites).toEqual([
      { deliveryStatus: DeliveryStatus.FAILED, deliveryError: 'CHANNEL_ADAPTER_NOT_FOUND' },
    ]);
  });

  it('should throw (and retry later) when the per-conversation lock is contended', async () => {
    lockAvailable = false;

    await expect(processor.process(buildJob())).rejects.toThrow('OUTBOUND_LOCK_CONTENTION');
    expect(deliveredMessages.length).toBe(0);
    expect(deliveryWrites.length).toBe(0);
  });

  it('should drop the job when the message was deleted before delivery', async () => {
    seededMessage = null;

    await processor.process(buildJob());

    expect(deliveredMessages.length).toBe(0);
    expect(deliveryWrites.length).toBe(0);
  });

  it('should drop the job when the message already reached the provider', async () => {
    seededMessage = seedMessage({
      externalId: 'mid.fb.already',
      deliveryStatus: DeliveryStatus.SENT,
    });

    await processor.process(buildJob());

    expect(deliveredMessages.length).toBe(0);
    expect(deliveryWrites.length).toBe(0);
  });
});
