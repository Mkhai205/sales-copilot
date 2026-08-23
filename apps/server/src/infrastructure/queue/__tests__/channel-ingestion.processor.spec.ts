import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ChannelType,
  ConversationStatus,
  DeliveryStatus,
  FileType,
  MessageContentType,
  MessageType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { ChannelIngestionProcessor } from '../channel-ingestion.processor';
import { ChannelAdapterRegistry } from '../../../integrations/channel-adapter.registry';

describe('ChannelIngestionProcessor (Task T-1.5.7: Inbound Ingestion Pipeline Integration & E2E Validation)', () => {
  let processor: ChannelIngestionProcessor;
  let mockPrismaService: any;
  let mockContactResolutionService: any;
  let mockConversationsService: any;
  let mockMessagesService: any;
  let adapterRegistry: ChannelAdapterRegistry;

  let channelsDb: Map<string, any>;
  let channelEventsDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let channelIdentitiesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;

  beforeEach(() => {
    channelsDb = new Map();
    channelEventsDb = new Map();
    contactsDb = new Map();
    channelIdentitiesDb = new Map();
    conversationsDb = new Map();
    messagesDb = new Map();

    const clientMock = {
      channel: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const ch = channelsDb.get(where.id);
          return ch ? { ...ch } : null;
        },
      },
      channelEvent: {
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const evt = channelEventsDb.get(where.id);
          if (evt) {
            const updated = { ...evt, ...data };
            channelEventsDb.set(where.id, updated);
            return { ...updated };
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    // Realistic mock for ContactResolutionService
    mockContactResolutionService = {
      resolveFromChannel: async (params: {
        workspaceId: string;
        channelId: string;
        externalContactId: string;
        contactInfo?: any;
        username?: string;
        metadata?: any;
      }) => {
        let identity = Array.from(channelIdentitiesDb.values()).find(
          (i: any) =>
            i.channelId === params.channelId && i.externalContactId === params.externalContactId,
        );

        let contact: any;
        let isNewContact = false;
        let isNewIdentity = false;

        if (identity) {
          contact = contactsDb.get(identity.contactId);
        } else {
          isNewIdentity = true;
          isNewContact = true;
          const contactId = `cnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          contact = {
            id: contactId,
            workspaceId: params.workspaceId,
            name: params.contactInfo?.name || 'Customer',
            email: params.contactInfo?.email || null,
            phoneNumber: params.contactInfo?.phoneNumber || null,
            avatarUrl: params.contactInfo?.avatarUrl || null,
          };
          contactsDb.set(contactId, contact);

          const identityId = `ident_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          identity = {
            id: identityId,
            contactId,
            workspaceId: params.workspaceId,
            channelId: params.channelId,
            externalContactId: params.externalContactId,
            username: params.username || null,
          };
          channelIdentitiesDb.set(identityId, identity);
        }

        return { contact, channelIdentity: identity, isNewContact, isNewIdentity };
      },
    };

    // Realistic mock for ConversationsService
    mockConversationsService = {
      findOrCreateActiveConversation: async (
        workspaceId: string,
        params: { contactId: string; inboxId: string; channelIdentityId?: string },
      ) => {
        let activeConv = Array.from(conversationsDb.values()).find(
          (c: any) =>
            c.workspaceId === workspaceId &&
            c.contactId === params.contactId &&
            c.inboxId === params.inboxId &&
            c.status === ConversationStatus.OPEN,
        );

        if (!activeConv) {
          const convId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          activeConv = {
            id: convId,
            workspaceId,
            contactId: params.contactId,
            inboxId: params.inboxId,
            channelIdentityId: params.channelIdentityId,
            status: ConversationStatus.OPEN,
            unreadMessagesCount: 0,
            lastActivityAt: new Date(),
          };
          conversationsDb.set(convId, activeConv);
        }

        return { ...activeConv };
      },
    };

    // Realistic mock for MessagesService
    mockMessagesService = {
      create: async (workspaceId: string, conversationId: string, dto: any) => {
        // Check idempotency
        if (dto.externalId) {
          const existing = Array.from(messagesDb.values()).find(
            (m: any) => m.conversationId === conversationId && m.externalId === dto.externalId,
          );
          if (existing) {
            return { ...existing };
          }
        }

        const id = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const record = {
          id,
          conversationId,
          workspaceId,
          senderType: dto.senderType,
          senderId: dto.senderId,
          content: dto.content,
          contentType: dto.contentType || MessageContentType.TEXT,
          messageType: dto.messageType || MessageType.INCOMING,
          externalId: dto.externalId || null,
          attachments: dto.attachments || [],
          metadata: dto.metadata || {},
          createdAt: new Date(),
        };
        messagesDb.set(id, record);

        // Increment unread count in conversation
        const conv = conversationsDb.get(conversationId);
        if (conv) {
          conv.unreadMessagesCount += 1;
          conv.lastActivityAt = new Date();
        }

        return { ...record };
      },
    };

    adapterRegistry = new ChannelAdapterRegistry();

    // Register a mock Facebook Adapter
    adapterRegistry.register({
      channelType: ChannelType.FACEBOOK_MESSENGER,
      verifyWebhook: () => true,
      parseInboundPayload: (rawBody: any) => {
        const messaging = rawBody?.entry?.[0]?.messaging?.[0];
        if (!messaging) return [];
        return [
          {
            externalContactId: messaging.sender.id,
            externalMessageId: messaging.message.mid,
            content: messaging.message.text,
            contentType: MessageContentType.TEXT,
            attachments: messaging.message.attachments?.map((att: any) => ({
              fileUrl: att.payload.url,
              contentType: MessageContentType.IMAGE,
              fileType: FileType.IMAGE,
              fileName: 'fb_image.jpg',
            })),
            senderInfo: {
              name: 'Facebook User',
            },
            timestamp: new Date(),
            rawPayload: rawBody,
          },
        ];
      },
      sendMessage: async () => ({
        externalMessageId: 'fb_out_1',
        deliveryStatus: DeliveryStatus.SENT,
      }),
      getChannelInfo: async () => ({ name: 'Test Page' }),
    });

    processor = new ChannelIngestionProcessor(
      mockPrismaService,
      mockContactResolutionService,
      mockConversationsService,
      mockMessagesService,
      adapterRegistry,
    );

    // Seed test channel
    channelsDb.set('ch_fb_1', {
      id: 'ch_fb_1',
      workspaceId: 'ws_corp',
      inboxId: 'ib_main',
      channelType: ChannelType.FACEBOOK_MESSENGER,
      isConnected: true,
    });
  });

  it('should process new inbound message end-to-end: resolve contact, create conversation, store message, and mark event processed', async () => {
    const eventId = 'evt_fb_100';
    channelEventsDb.set(eventId, {
      id: eventId,
      channelId: 'ch_fb_1',
      externalEventId: 'mid.fb.12345',
      eventType: 'messages',
      payload: {},
      processedAt: null,
    });

    const mockJob: any = {
      id: 'job_1',
      data: {
        channelId: 'ch_fb_1',
        channelEventId: eventId,
        eventType: 'messages',
        payload: {
          entry: [
            {
              messaging: [
                {
                  sender: { id: 'psid_user_999' },
                  message: {
                    mid: 'mid.fb.12345',
                    text: 'Hello, I want to inquire about pricing',
                  },
                },
              ],
            },
          ],
        },
      },
    };

    await processor.process(mockJob);

    // 1. Contact & Identity created
    assert.strictEqual(contactsDb.size, 1);
    assert.strictEqual(channelIdentitiesDb.size, 1);
    const contact = Array.from(contactsDb.values())[0];
    assert.strictEqual(contact.name, 'Facebook User');
    assert.strictEqual(contact.workspaceId, 'ws_corp');

    const identity = Array.from(channelIdentitiesDb.values())[0];
    assert.strictEqual(identity.externalContactId, 'psid_user_999');
    assert.strictEqual(identity.contactId, contact.id);

    // 2. Active Conversation created
    assert.strictEqual(conversationsDb.size, 1);
    const conv = Array.from(conversationsDb.values())[0];
    assert.strictEqual(conv.contactId, contact.id);
    assert.strictEqual(conv.inboxId, 'ib_main');
    assert.strictEqual(conv.status, ConversationStatus.OPEN);
    assert.strictEqual(conv.unreadMessagesCount, 1);

    // 3. Message created
    assert.strictEqual(messagesDb.size, 1);
    const msg = Array.from(messagesDb.values())[0];
    assert.strictEqual(msg.conversationId, conv.id);
    assert.strictEqual(msg.senderType, SenderType.CONTACT);
    assert.strictEqual(msg.senderId, contact.id);
    assert.strictEqual(msg.content, 'Hello, I want to inquire about pricing');
    assert.strictEqual(msg.externalId, 'mid.fb.12345');

    // 4. ChannelEvent marked as processed
    const processedEvent = channelEventsDb.get(eventId);
    assert.ok(processedEvent.processedAt instanceof Date);
  });

  it('should group subsequent inbound messages from same customer into the existing active conversation', async () => {
    // 1. First message
    await processor.process({
      id: 'job_1',
      data: {
        channelId: 'ch_fb_1',
        channelEventId: 'evt_1',
        eventType: 'messages',
        payload: {
          entry: [
            {
              messaging: [
                {
                  sender: { id: 'psid_user_999' },
                  message: { mid: 'mid.fb.1', text: 'First message' },
                },
              ],
            },
          ],
        },
      },
    } as any);

    assert.strictEqual(conversationsDb.size, 1);
    assert.strictEqual(messagesDb.size, 1);
    const firstConvId = Array.from(conversationsDb.values())[0].id;

    // 2. Second message from same customer
    await processor.process({
      id: 'job_2',
      data: {
        channelId: 'ch_fb_1',
        channelEventId: 'evt_2',
        eventType: 'messages',
        payload: {
          entry: [
            {
              messaging: [
                {
                  sender: { id: 'psid_user_999' },
                  message: { mid: 'mid.fb.2', text: 'Second message' },
                },
              ],
            },
          ],
        },
      },
    } as any);

    // Still 1 contact, 1 identity, 1 conversation, but 2 messages
    assert.strictEqual(contactsDb.size, 1);
    assert.strictEqual(channelIdentitiesDb.size, 1);
    assert.strictEqual(conversationsDb.size, 1);
    assert.strictEqual(messagesDb.size, 2);

    const messages = Array.from(messagesDb.values());
    assert.strictEqual(messages[0].conversationId, firstConvId);
    assert.strictEqual(messages[1].conversationId, firstConvId);
    assert.strictEqual(messages[1].content, 'Second message');
  });

  it('should process inbound messages with media attachments', async () => {
    await processor.process({
      id: 'job_media',
      data: {
        channelId: 'ch_fb_1',
        channelEventId: 'evt_media',
        eventType: 'messages',
        payload: {
          entry: [
            {
              messaging: [
                {
                  sender: { id: 'psid_photo_user' },
                  message: {
                    mid: 'mid.fb.media_1',
                    text: 'Check this image',
                    attachments: [
                      {
                        type: 'image',
                        payload: { url: 'https://cdn.facebook.com/pic123.jpg' },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    } as any);

    assert.strictEqual(messagesDb.size, 1);
    const msg = Array.from(messagesDb.values())[0];
    assert.strictEqual(msg.attachments.length, 1);
    assert.strictEqual(msg.attachments[0].storagePath, 'https://cdn.facebook.com/pic123.jpg');
    assert.strictEqual(msg.attachments[0].fileName, 'fb_image.jpg');
  });

  it('should gracefully handle fallback payload when adapter is not registered', async () => {
    channelsDb.set('ch_telegram_1', {
      id: 'ch_telegram_1',
      workspaceId: 'ws_corp',
      inboxId: 'ib_telegram',
      channelType: ChannelType.TELEGRAM,
      isConnected: true,
    });

    await processor.process({
      id: 'job_fallback',
      data: {
        channelId: 'ch_telegram_1',
        channelEventId: 'evt_tg_1',
        eventType: 'message',
        payload: {
          externalContactId: 'tg_user_888',
          externalMessageId: 'tg_msg_999',
          content: 'Hello from Telegram via fallback payload',
          senderInfo: {
            name: 'Telegram User',
            username: 'tg_user',
          },
        },
      },
    } as any);

    assert.strictEqual(contactsDb.size, 1);
    assert.strictEqual(conversationsDb.size, 1);
    assert.strictEqual(messagesDb.size, 1);

    const msg = Array.from(messagesDb.values())[0];
    assert.strictEqual(msg.content, 'Hello from Telegram via fallback payload');
    assert.strictEqual(msg.externalId, 'tg_msg_999');
  });

  it('should skip processing and log warning when channel does not exist', async () => {
    await processor.process({
      id: 'job_ghost',
      data: {
        channelId: 'ch_non_existent',
        channelEventId: 'evt_ghost',
        eventType: 'message',
        payload: {},
      },
    } as any);

    assert.strictEqual(contactsDb.size, 0);
    assert.strictEqual(conversationsDb.size, 0);
    assert.strictEqual(messagesDb.size, 0);
  });
});
