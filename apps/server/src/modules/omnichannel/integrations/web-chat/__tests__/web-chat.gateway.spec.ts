import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ChannelType,
  DeliveryStatus,
  FileType,
  MessageContentType,
} from '@sales-copilot/shared-contracts';
import { WebChatGateway, WidgetSocketData } from '../web-chat.gateway';
import { WebChatAdapter } from '../web-chat.adapter';

describe('WebChatGateway (Widget WebSocket Namespace /widget)', () => {
  let gateway: WebChatGateway;
  let mockPrisma: any;
  let mockCredentialService: any;
  let mockContactResolutionService: any;
  let mockConversationsService: any;
  let mockMessagesService: any;
  let webChatAdapter: WebChatAdapter;
  let mockEventEmitter: EventEmitter2;
  let emittedServerEvents: Array<{ room: string; event: string; payload: unknown }>;
  let emittedInternalEvents: Array<{ event: string; payload: unknown }>;

  const mockChannel = {
    id: 'chan_web_001',
    workspaceId: 'ws_test_001',
    inboxId: 'inbox_web_001',
    channelType: ChannelType.WEB_CHAT,
    providerAccountId: 'wt_valid_token_123',
    credentials: {
      widgetToken: 'wt_valid_token_123',
      hmacSecret: 'secret_hmac_key_999',
      hmacMandatory: false,
    },
    settings: {
      greetingMessage: 'Hello, how can we help?',
      widgetColor: '#1f93ff',
    },
  };

  const mockContact = {
    id: 'cont_001',
    workspaceId: 'ws_test_001',
    name: 'Anonymous Visitor',
    identifier: 'ident_001',
  };

  const mockIdentity = {
    id: 'ci_001',
    channelId: 'chan_web_001',
    contactId: 'cont_001',
    externalContactId: 'ext_vis_001',
  };

  const createMockSocket = (handshakeOverrides: any = {}) => {
    const emittedToClient: Array<{ event: string; payload: unknown }> = [];
    const joinedRooms: string[] = [];
    let disconnected = false;

    const socket: any = {
      id: `socket_${Math.random().toString(36).slice(2, 8)}`,
      handshake: {
        auth: {},
        query: {},
        headers: {},
        ...handshakeOverrides,
      },
      data: {} as WidgetSocketData,
      emit: (event: string, payload: unknown) => {
        emittedToClient.push({ event, payload });
      },
      join: (room: string) => {
        joinedRooms.push(room);
      },
      disconnect: (close?: boolean) => {
        disconnected = close ?? true;
      },
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          emittedServerEvents.push({ room, event, payload });
        },
      }),
      _getEmitted: () => emittedToClient,
      _getJoinedRooms: () => joinedRooms,
      _isDisconnected: () => disconnected,
    };

    return socket;
  };

  beforeEach(() => {
    emittedServerEvents = [];
    emittedInternalEvents = [];

    mockPrisma = {
      getClient: () => ({
        channel: {
          findFirst: async (query: any) => {
            const or = query.where?.OR;
            const matchesToken =
              query.where?.providerAccountId === 'wt_valid_token_123' ||
              or?.some(
                (c: any) =>
                  c.providerAccountId === 'wt_valid_token_123' ||
                  c.inboxId === 'wt_valid_token_123',
              );
            if (matchesToken) {
              return mockChannel;
            }
            return null;
          },
          findMany: async (_query: any) => {
            return [mockChannel];
          },
        },
      }),
    };

    mockCredentialService = {
      decrypt: (encrypted: string) => {
        if (encrypted === 'encrypted_wt_token') {
          return { widgetToken: 'wt_from_creds_456' };
        }
        return {};
      },
    };

    mockContactResolutionService = {
      resolveFromChannel: async (_params: any) => ({
        contact: mockContact,
        channelIdentity: mockIdentity,
        isNewContact: false,
        isNewIdentity: false,
      }),
      identify: async (_workspaceId: string, _currentContact: any, info: any) => ({
        ...mockContact,
        name: info.name || mockContact.name,
        identifier: info.identifier,
        email: info.email,
      }),
    };

    mockConversationsService = {
      findOrCreateActiveConversation: async (_wsId: string, _params: any) => ({
        id: 'conv_web_001',
        workspaceId: 'ws_test_001',
        contactId: 'cont_001',
        inboxId: 'inbox_web_001',
      }),
    };

    mockMessagesService = {
      create: async (wsId: string, convId: string, dto: any) => ({
        id: 'msg_web_001',
        conversationId: convId,
        workspaceId: wsId,
        senderType: dto.senderType,
        senderId: dto.senderId,
        messageType: dto.messageType,
        contentType: dto.contentType,
        content: dto.content,
        externalId: dto.externalId,
        deliveryStatus: DeliveryStatus.SENT,
        createdAt: new Date().toISOString(),
      }),
    };

    mockEventEmitter = {
      emit: (event: string, payload: unknown) => {
        emittedInternalEvents.push({ event, payload });
        return true;
      },
    } as unknown as EventEmitter2;

    webChatAdapter = new WebChatAdapter();

    gateway = new WebChatGateway(
      mockPrisma,
      mockCredentialService,
      mockContactResolutionService,
      mockConversationsService,
      mockMessagesService,
      webChatAdapter,
      mockEventEmitter,
    );

    gateway.server = {
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => {
          emittedServerEvents.push({ room, event, payload });
        },
      }),
    } as any;
  });

  describe('Gateway Lifecycle & afterInit', () => {
    it('should initialize without error', () => {
      expect(() => gateway.afterInit(gateway.server)).not.toThrow();
    });
  });

  describe('handleConnection()', () => {
    it('should authenticate client with widget_token in auth object and join rooms', async () => {
      const socket = createMockSocket({
        auth: { widget_token: 'wt_valid_token_123', visitorId: 'vis_ext_99' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:connected');

      const connectedPayload = emitted[0].payload as any;
      expect(connectedPayload.contactId).toBe(mockContact.id);
      expect(connectedPayload.greetingMessage).toBe('Hello, how can we help?');

      const rooms = socket._getJoinedRooms();
      expect(rooms.includes(`widget:${mockChannel.id}:${mockContact.id}`)).toBeTruthy();
      expect(rooms.includes(`widget:${mockContact.id}`)).toBeTruthy();

      expect(socket.data.workspaceId).toBe(mockChannel.workspaceId);
      expect(socket.data.channelId).toBe(mockChannel.id);
      expect(socket.data.contactId).toBe(mockContact.id);
    });

    it('should extract widget_token from query parameters', async () => {
      const socket = createMockSocket({
        query: { website_token: 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      expect(socket._getEmitted()[0].event).toBe('widget:connected');
    });

    it('should extract widget_token from headers', async () => {
      const socket = createMockSocket({
        headers: { 'x-widget-token': 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      expect(socket._getEmitted()[0].event).toBe('widget:connected');
    });

    it('should resolve channel by inboxId when providerAccountId is not direct match (TASK-3A-06)', async () => {
      const channelWithInboxMatch = {
        ...mockChannel,
        inboxId: 'inbox_direct_token_456',
        providerAccountId: null,
      };

      mockPrisma.getClient = () => ({
        channel: {
          findFirst: async ({ where }: any) => {
            const or = where?.OR;
            if (
              where?.providerAccountId === 'inbox_direct_token_456' ||
              or?.some((c: any) => c.inboxId === 'inbox_direct_token_456')
            ) {
              return channelWithInboxMatch;
            }
            return null;
          },
        },
      });

      const socket = createMockSocket({
        auth: { widget_token: 'inbox_direct_token_456' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(false);
      expect(socket._getEmitted()[0].event).toBe('widget:connected');
    });

    it('should disconnect client when widget_token is missing', async () => {
      const socket = createMockSocket({
        auth: {},
        query: {},
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:error');
      expect((emitted[0].payload as any).code).toBe('UNAUTHORIZED');
    });

    it('should disconnect client when channel is not found', async () => {
      const socket = createMockSocket({
        auth: { widget_token: 'invalid_token_999' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:error');
      expect((emitted[0].payload as any).code).toBe('CHANNEL_NOT_FOUND');
    });

    it('should handle internal errors gracefully during connection', async () => {
      mockContactResolutionService.resolveFromChannel = async () => {
        throw new Error('Database connection failed');
      };

      const socket = createMockSocket({
        auth: { widget_token: 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      expect(socket._isDisconnected()).toBe(true);
      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:error');
      expect((emitted[0].payload as any).code).toBe('INTERNAL_ERROR');
    });
  });

  describe('handleDisconnect()', () => {
    it('should handle authenticated client disconnect cleanly', () => {
      const socket = createMockSocket();
      socket.data = {
        contactId: 'cont_123',
        channelId: 'chan_123',
      };

      expect(() => gateway.handleDisconnect(socket)).not.toThrow();
    });

    it('should handle unauthenticated client disconnect cleanly', () => {
      const socket = createMockSocket();
      expect(() => gateway.handleDisconnect(socket)).not.toThrow();
    });
  });

  describe('handleSendMessage() (@SubscribeMessage widget:send_message)', () => {
    it('should create incoming message and emit confirmation back to visitor', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        inboxId: mockChannel.inboxId,
        contactId: mockContact.id,
        channelIdentityId: mockIdentity.id,
      };

      const payload = {
        content: 'I need assistance with an invoice',
        contentType: MessageContentType.TEXT,
        tempId: 'temp_client_msg_001',
      };

      const response = await gateway.handleSendMessage(socket, payload);

      expect(response.success).toBe(true);
      expect(response.messageId).toBe('msg_web_001');

      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:message_sent');
      expect((emitted[0].payload as any).tempId).toBe('temp_client_msg_001');
      expect((emitted[0].payload as any).message.id).toBe('msg_web_001');

      expect(emittedServerEvents.length).toBe(1);
      expect(emittedServerEvents[0].room).toBe(`widget:${mockChannel.id}:${mockContact.id}`);
      expect(emittedServerEvents[0].event).toBe('widget:message');
    });

    it('should handle incoming message with attachments', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        inboxId: mockChannel.inboxId,
        contactId: mockContact.id,
      };

      const payload = {
        content: 'See screenshot',
        contentType: MessageContentType.IMAGE,
        attachments: [
          {
            fileUrl: 'https://example.com/image.png',
            fileName: 'image.png',
            fileType: 'IMAGE',
            fileSize: 2048,
            contentType: 'image/png',
          },
        ],
      };

      let capturedDto: any;
      mockMessagesService.create = async (_wsId: string, _convId: string, dto: any) => {
        capturedDto = dto;
        return { id: 'msg_att_001', ...dto };
      };

      const response = await gateway.handleSendMessage(socket, payload);

      expect(response.success).toBe(true);
      expect(capturedDto.attachments?.length).toBe(1);
      expect(capturedDto.attachments[0].fileType).toBe(FileType.IMAGE);
      expect(capturedDto.attachments[0].fileUrl).toBe('https://example.com/image.png');
    });

    it('should reject message when socket is unauthenticated', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleSendMessage(socket, { content: 'Hello' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('UNAUTHORIZED');
      expect(socket._getEmitted()[0].event).toBe('widget:error');
    });

    it('should handle error during message creation and emit error event', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        contactId: mockContact.id,
        inboxId: mockChannel.inboxId,
      };

      mockMessagesService.create = async () => {
        throw new Error('Message validation failed');
      };

      const response = await gateway.handleSendMessage(socket, {
        content: 'Hi',
        tempId: 'temp_failed',
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Message validation failed');

      const emitted = socket._getEmitted();
      expect(emitted[0].event).toBe('widget:error');
      expect((emitted[0].payload as any).code).toBe('MESSAGE_SEND_FAILED');
      expect((emitted[0].payload as any).tempId).toBe('temp_failed');
    });
  });

  describe('handleIdentify() (@SubscribeMessage widget:identify)', () => {
    it('should identify visitor and update contact details without HMAC requirement', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
      };

      const payload = {
        identifier: 'user_cust_999',
        name: 'Alice Wonder',
        email: 'alice@wonderland.com',
      };

      const response = await gateway.handleIdentify(socket, payload);

      expect(response.success).toBe(true);
      expect(response.contactId).toBe(mockContact.id);

      const emitted = socket._getEmitted();
      expect(emitted.length).toBe(1);
      expect(emitted[0].event).toBe('widget:identified');
      expect((emitted[0].payload as any).contact.name).toBe('Alice Wonder');
    });

    it('should verify valid HMAC signature when hmacSecret is configured', async () => {
      const secret = 'secret_hmac_key_999';
      const identifier = 'user_cust_999';
      const validSignature = webChatAdapter.generateHmacSignature(identifier, secret);

      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        hmacSecret: secret,
      };

      const payload = {
        identifier,
        name: 'Alice Wonder',
        hmacSignature: validSignature,
      };

      const response = await gateway.handleIdentify(socket, payload);

      expect(response.success).toBe(true);
      expect(socket._getEmitted()[0].event).toBe('widget:identified');
    });

    it('should reject identification when HMAC signature is invalid', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        hmacSecret: 'secret_hmac_key_999',
      };

      const payload = {
        identifier: 'user_cust_999',
        hmacSignature: 'invalid_hmac_signature_hex',
      };

      const response = await gateway.handleIdentify(socket, payload);

      expect(response.success).toBe(false);
      expect(response.error).toBe('INVALID_HMAC_SIGNATURE');
      expect(socket._getEmitted()[0].event).toBe('widget:error');
      expect((socket._getEmitted()[0].payload as any).code).toBe('INVALID_HMAC_SIGNATURE');
    });

    it('should reject identification when HMAC is mandatory but signature is omitted', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        hmacSecret: 'secret_hmac_key_999',
        hmacMandatory: true,
      };

      const payload = {
        identifier: 'user_cust_999',
      };

      const response = await gateway.handleIdentify(socket, payload);

      expect(response.success).toBe(false);
      expect(response.error).toBe('HMAC_REQUIRED');
      expect(socket._getEmitted()[0].event).toBe('widget:error');
      expect((socket._getEmitted()[0].payload as any).code).toBe('HMAC_REQUIRED');
    });

    it('should reject identify from unauthenticated socket', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleIdentify(socket, { identifier: 'id123' });

      expect(response.success).toBe(false);
      expect(response.error).toBe('UNAUTHORIZED');
    });
  });

  describe('handleTyping() (@SubscribeMessage widget:typing)', () => {
    it('should emit typing event on internal EventEmitter2', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        externalContactId: 'ext_vis_001',
      };

      const response = await gateway.handleTyping(socket, { isTyping: true });

      expect(response.success).toBe(true);
      expect(emittedInternalEvents.length).toBe(1);
      expect(emittedInternalEvents[0].event).toBe('widget.visitor_typing');
      const payload = emittedInternalEvents[0].payload as any;
      expect(payload.workspaceId).toBe(mockChannel.workspaceId);
      expect(payload.contactId).toBe(mockContact.id);
      expect(payload.isTyping).toBe(true);
    });

    it('should return false for unauthenticated socket typing event', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleTyping(socket, { isTyping: true });
      expect(response.success).toBe(false);
    });

    it('should throttle rapid visitor typing bursts when sent within 1000ms cooldown (FINDING-P7-03)', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        externalContactId: 'ext_vis_001',
      };

      const firstResponse = await gateway.handleTyping(socket, { isTyping: true });
      expect(firstResponse.success).toBe(true);
      expect((firstResponse as any).throttled).toBe(undefined);
      expect(emittedInternalEvents.length).toBe(1);

      // Rapid consecutive typing event within 1000ms
      const secondResponse = await gateway.handleTyping(socket, { isTyping: true });
      expect(secondResponse.success).toBe(true);
      expect((secondResponse as any).throttled).toBe(true);
      // EventEmitter should NOT have emitted second event
      expect(emittedInternalEvents.length).toBe(1);
    });

    it('should allow typing event after 1000ms cooldown expires', async () => {
      const socket = createMockSocket();
      socket.data = {
        workspaceId: mockChannel.workspaceId,
        channelId: mockChannel.id,
        contactId: mockContact.id,
        externalContactId: 'ext_vis_001',
        lastTypingAt: Date.now() - 1500, // 1.5s ago
      };

      const response = await gateway.handleTyping(socket, { isTyping: true });
      expect(response.success).toBe(true);
      expect((response as any).throttled).toBe(undefined);
      expect(emittedInternalEvents.length).toBe(1);
    });
  });

  describe('handleOutboundMessage() (@OnEvent widget.outbound_message)', () => {
    it('should broadcast outbound message to visitor socket rooms', () => {
      const eventPayload = {
        workspaceId: 'ws_test_001',
        channelId: 'chan_web_001',
        inboxId: 'inbox_web_001',
        recipientExternalId: 'ext_vis_001',
        message: {
          recipientExternalId: 'ext_vis_001',
          content: 'Agent reply from dashboard',
          contentType: MessageContentType.TEXT,
        },
        sentAt: new Date(),
      };

      gateway.handleOutboundMessage(eventPayload as any);

      expect(emittedServerEvents.length).toBe(2);
      expect(emittedServerEvents[0].room).toBe('widget:chan_web_001:ext_vis_001');
      expect(emittedServerEvents[0].event).toBe('widget:message');
      expect(emittedServerEvents[1].room).toBe('widget:ext_vis_001');
      expect(emittedServerEvents[1].event).toBe('widget:message');
      expect((emittedServerEvents[0].payload as any).content).toBe('Agent reply from dashboard');
    });

    it('should ignore event when payload or recipientExternalId is missing', () => {
      expect(() => gateway.handleOutboundMessage(null as any)).not.toThrow();
      expect(() => gateway.handleOutboundMessage({} as any)).not.toThrow();
    });
  });
});
