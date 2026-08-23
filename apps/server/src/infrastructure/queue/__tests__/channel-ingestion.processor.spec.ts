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
      message: {
        findFirst: async ({
          where,
        }: {
          where: { workspaceId?: string; externalId?: string; id?: string };
        }) => {
          const msg = Array.from(messagesDb.values()).find(
            (m: any) =>
              (!where.workspaceId || m.workspaceId === where.workspaceId) &&
              (!where.externalId || m.externalId === where.externalId) &&
              (!where.id || m.id === where.id),
          );
          return msg ? { ...msg } : null;
        },
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
        if (rawBody?.deliveryStatusInfo) {
          return [
            {
              eventKind: 'delivery_status',
              externalContactId: rawBody.externalContactId || 'system',
              externalMessageId: rawBody.deliveryStatusInfo.externalMessageId,
              contentType: MessageContentType.TEXT,
              timestamp: new Date(),
              deliveryStatusInfo: rawBody.deliveryStatusInfo,
            },
          ];
        }

        const messaging = rawBody?.entry?.[0]?.messaging?.[0];
        if (!messaging) return [];

        if (messaging.delivery) {
          return [
            {
              eventKind: 'delivery_status',
              externalContactId: messaging.sender?.id || 'system',
              externalMessageId: messaging.delivery.mids?.[0] || messaging.delivery.mid,
              contentType: MessageContentType.TEXT,
              timestamp: new Date(),
              deliveryStatusInfo: {
                externalMessageId: messaging.delivery.mids?.[0] || messaging.delivery.mid,
                status: DeliveryStatus.DELIVERED,
                timestamp: new Date(messaging.delivery.watermark || Date.now()),
              },
            },
          ];
        }

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

  describe('Delivery Status Updates (Feature Task S-2)', () => {
    it('should update Message.deliveryStatus when receiving delivery status event', async () => {
      // Seed existing outgoing message
      const msgId = 'msg_outgoing_1';
      messagesDb.set(msgId, {
        id: msgId,
        conversationId: 'conv_1',
        workspaceId: 'ws_corp',
        senderType: SenderType.USER,
        senderId: 'usr_agent_1',
        content: 'Your order has shipped',
        contentType: MessageContentType.TEXT,
        messageType: MessageType.OUTGOING,
        externalId: 'mid.fb.out_123',
        deliveryStatus: DeliveryStatus.SENT,
        createdAt: new Date(),
      });

      const eventId = 'evt_delivery_1';
      channelEventsDb.set(eventId, {
        id: eventId,
        channelId: 'ch_fb_1',
        externalEventId: 'mid.fb.out_123',
        eventType: 'message_deliveries',
        processedAt: null,
      });

      const mockJob: any = {
        id: 'job_deliv_1',
        data: {
          channelId: 'ch_fb_1',
          channelEventId: eventId,
          eventType: 'message_deliveries',
          payload: {
            eventKind: 'delivery_status',
            deliveryStatusInfo: {
              externalMessageId: 'mid.fb.out_123',
              status: DeliveryStatus.DELIVERED,
              timestamp: new Date(),
            },
          },
        },
      };

      await processor.process(mockJob);

      // Verify deliveryStatus updated to DELIVERED
      const updatedMsg = messagesDb.get(msgId);
      assert.strictEqual(updatedMsg.deliveryStatus, DeliveryStatus.DELIVERED);

      // Verify channelEvent marked processed
      const updatedEvt = channelEventsDb.get(eventId);
      assert.ok(updatedEvt.processedAt instanceof Date);
    });

    it('should gracefully handle delivery status update when message externalId is not found', async () => {
      const eventId = 'evt_delivery_unknown';
      channelEventsDb.set(eventId, {
        id: eventId,
        channelId: 'ch_fb_1',
        externalEventId: 'mid.unknown_999',
        eventType: 'message_reads',
        processedAt: null,
      });

      const mockJob: any = {
        id: 'job_deliv_2',
        data: {
          channelId: 'ch_fb_1',
          channelEventId: eventId,
          eventType: 'message_reads',
          payload: {
            eventKind: 'delivery_status',
            deliveryStatusInfo: {
              externalMessageId: 'mid.unknown_999',
              status: DeliveryStatus.READ,
              timestamp: new Date(),
            },
          },
        },
      };

      await processor.process(mockJob);

      // No crash, and channelEvent marked processed
      const updatedEvt = channelEventsDb.get(eventId);
      assert.ok(updatedEvt.processedAt instanceof Date);
    });
  });

  describe('Media Download to StorageService (Feature Task S-2)', () => {
    it('should download external media attachments and upload to MinIO when StorageService is provided', async () => {
      const uploadedFiles: Array<{ key: string; contentType: string; buffer: Buffer }> = [];
      const mockStorageService: any = {
        upload: async (buffer: Buffer, contentType: string, key: string) => {
          uploadedFiles.push({ key, contentType, buffer });
        },
        getPublicUrl: (key: string) => `https://minio.salescopilot.test/${key}`,
      };

      const processorWithStorage = new ChannelIngestionProcessor(
        mockPrismaService,
        mockContactResolutionService,
        mockConversationsService,
        mockMessagesService,
        adapterRegistry,
        mockStorageService,
      );

      // Mock globalThis.fetch for this test
      const originalFetch = globalThis.fetch;
      const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      globalThis.fetch = async (url: any) => {
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => fakeImageBytes.buffer,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
        } as any;
      };

      try {
        await processorWithStorage.process({
          id: 'job_media_download',
          data: {
            channelId: 'ch_fb_1',
            channelEventId: 'evt_media_dl',
            eventType: 'messages',
            payload: {
              entry: [
                {
                  messaging: [
                    {
                      sender: { id: 'psid_media_downloader' },
                      message: {
                        mid: 'mid.fb.media_dl_1',
                        text: 'Photo from user',
                        attachments: [
                          {
                            type: 'image',
                            payload: { url: 'https://cdn.fb.test/attachments/photo_123.jpg' },
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

        assert.strictEqual(uploadedFiles.length, 1);
        assert.ok(uploadedFiles[0].key.startsWith('attachments/ws_corp/inbound/'));
        assert.ok(uploadedFiles[0].key.includes('fb_image.jpg'));
        assert.strictEqual(uploadedFiles[0].contentType, 'image/jpeg');

        const msg = Array.from(messagesDb.values())[0];
        assert.strictEqual(msg.attachments.length, 1);
        assert.ok(msg.attachments[0].storagePath.startsWith('attachments/ws_corp/inbound/'));
        assert.ok(msg.attachments[0].fileUrl.startsWith('https://minio.salescopilot.test/'));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should fall back to original external URL gracefully if media download fails', async () => {
      const mockStorageService: any = {
        upload: async () => {},
        getPublicUrl: (key: string) => `https://minio.test/${key}`,
      };

      const processorWithStorage = new ChannelIngestionProcessor(
        mockPrismaService,
        mockContactResolutionService,
        mockConversationsService,
        mockMessagesService,
        adapterRegistry,
        mockStorageService,
      );

      // Mock fetch failure (e.g. 404 or network timeout)
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async () => {
        return {
          ok: false,
          status: 404,
          statusText: 'Not Found',
        } as any;
      };

      try {
        await processorWithStorage.process({
          id: 'job_media_fail',
          data: {
            channelId: 'ch_fb_1',
            channelEventId: 'evt_media_fail',
            eventType: 'messages',
            payload: {
              entry: [
                {
                  messaging: [
                    {
                      sender: { id: 'psid_user_fail' },
                      message: {
                        mid: 'mid.fb.fail_1',
                        text: 'Broken link photo',
                        attachments: [
                          {
                            type: 'image',
                            payload: { url: 'https://cdn.fb.test/broken_link.jpg' },
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

        // Message should still be created with fallback external URL
        const msg = Array.from(messagesDb.values())[0];
        assert.strictEqual(msg.attachments.length, 1);
        assert.strictEqual(msg.attachments[0].storagePath, 'https://cdn.fb.test/broken_link.jpg');
        assert.strictEqual(msg.attachments[0].fileUrl, 'https://cdn.fb.test/broken_link.jpg');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
