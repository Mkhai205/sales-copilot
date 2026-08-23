import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
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
  let mockContactIdentifyService: any;
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
            const providerAccountId = query.where?.providerAccountId;
            if (providerAccountId === 'wt_valid_token_123') {
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
    };

    mockContactIdentifyService = {
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
      mockContactIdentifyService,
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
      assert.doesNotThrow(() => gateway.afterInit(gateway.server));
    });
  });

  describe('handleConnection()', () => {
    it('should authenticate client with widget_token in auth object and join rooms', async () => {
      const socket = createMockSocket({
        auth: { widget_token: 'wt_valid_token_123', visitorId: 'vis_ext_99' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:connected');

      const connectedPayload = emitted[0].payload as any;
      assert.strictEqual(connectedPayload.contactId, mockContact.id);
      assert.strictEqual(connectedPayload.greetingMessage, 'Hello, how can we help?');

      const rooms = socket._getJoinedRooms();
      assert.ok(rooms.includes(`widget:${mockChannel.id}:${mockContact.id}`));
      assert.ok(rooms.includes(`widget:${mockContact.id}`));

      assert.strictEqual(socket.data.workspaceId, mockChannel.workspaceId);
      assert.strictEqual(socket.data.channelId, mockChannel.id);
      assert.strictEqual(socket.data.contactId, mockContact.id);
    });

    it('should extract widget_token from query parameters', async () => {
      const socket = createMockSocket({
        query: { website_token: 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:connected');
    });

    it('should extract widget_token from headers', async () => {
      const socket = createMockSocket({
        headers: { 'x-widget-token': 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:connected');
    });

    it('should resolve channel by decrypting credentials when providerAccountId is not direct match', async () => {
      const channelWithEncryptedCreds = {
        ...mockChannel,
        providerAccountId: null,
        credentials: { encrypted: 'encrypted_wt_token' },
      };

      mockPrisma.getClient = () => ({
        channel: {
          findFirst: async () => null,
          findMany: async () => [channelWithEncryptedCreds],
        },
      });

      const socket = createMockSocket({
        auth: { widget_token: 'wt_from_creds_456' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), false);
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:connected');
    });

    it('should disconnect client when widget_token is missing', async () => {
      const socket = createMockSocket({
        auth: {},
        query: {},
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:error');
      assert.strictEqual((emitted[0].payload as any).code, 'UNAUTHORIZED');
    });

    it('should disconnect client when channel is not found', async () => {
      const socket = createMockSocket({
        auth: { widget_token: 'invalid_token_999' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:error');
      assert.strictEqual((emitted[0].payload as any).code, 'CHANNEL_NOT_FOUND');
    });

    it('should handle internal errors gracefully during connection', async () => {
      mockContactResolutionService.resolveFromChannel = async () => {
        throw new Error('Database connection failed');
      };

      const socket = createMockSocket({
        auth: { widget_token: 'wt_valid_token_123' },
      });

      await gateway.handleConnection(socket);

      assert.strictEqual(socket._isDisconnected(), true);
      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:error');
      assert.strictEqual((emitted[0].payload as any).code, 'INTERNAL_ERROR');
    });
  });

  describe('handleDisconnect()', () => {
    it('should handle authenticated client disconnect cleanly', () => {
      const socket = createMockSocket();
      socket.data = {
        contactId: 'cont_123',
        channelId: 'chan_123',
      };

      assert.doesNotThrow(() => gateway.handleDisconnect(socket));
    });

    it('should handle unauthenticated client disconnect cleanly', () => {
      const socket = createMockSocket();
      assert.doesNotThrow(() => gateway.handleDisconnect(socket));
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

      assert.strictEqual(response.success, true);
      assert.strictEqual(response.messageId, 'msg_web_001');

      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:message_sent');
      assert.strictEqual((emitted[0].payload as any).tempId, 'temp_client_msg_001');
      assert.strictEqual((emitted[0].payload as any).message.id, 'msg_web_001');

      assert.strictEqual(emittedServerEvents.length, 1);
      assert.strictEqual(emittedServerEvents[0].room, `widget:${mockChannel.id}:${mockContact.id}`);
      assert.strictEqual(emittedServerEvents[0].event, 'widget:message');
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

      assert.strictEqual(response.success, true);
      assert.strictEqual(capturedDto.attachments?.length, 1);
      assert.strictEqual(capturedDto.attachments[0].fileType, FileType.IMAGE);
      assert.strictEqual(capturedDto.attachments[0].fileUrl, 'https://example.com/image.png');
    });

    it('should reject message when socket is unauthenticated', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleSendMessage(socket, { content: 'Hello' });

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.error, 'UNAUTHORIZED');
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:error');
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

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.error, 'Message validation failed');

      const emitted = socket._getEmitted();
      assert.strictEqual(emitted[0].event, 'widget:error');
      assert.strictEqual((emitted[0].payload as any).code, 'MESSAGE_SEND_FAILED');
      assert.strictEqual((emitted[0].payload as any).tempId, 'temp_failed');
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

      assert.strictEqual(response.success, true);
      assert.strictEqual(response.contactId, mockContact.id);

      const emitted = socket._getEmitted();
      assert.strictEqual(emitted.length, 1);
      assert.strictEqual(emitted[0].event, 'widget:identified');
      assert.strictEqual((emitted[0].payload as any).contact.name, 'Alice Wonder');
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

      assert.strictEqual(response.success, true);
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:identified');
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

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.error, 'INVALID_HMAC_SIGNATURE');
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:error');
      assert.strictEqual((socket._getEmitted()[0].payload as any).code, 'INVALID_HMAC_SIGNATURE');
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

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.error, 'HMAC_REQUIRED');
      assert.strictEqual(socket._getEmitted()[0].event, 'widget:error');
      assert.strictEqual((socket._getEmitted()[0].payload as any).code, 'HMAC_REQUIRED');
    });

    it('should reject identify from unauthenticated socket', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleIdentify(socket, { identifier: 'id123' });

      assert.strictEqual(response.success, false);
      assert.strictEqual(response.error, 'UNAUTHORIZED');
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

      assert.strictEqual(response.success, true);
      assert.strictEqual(emittedInternalEvents.length, 1);
      assert.strictEqual(emittedInternalEvents[0].event, 'widget.visitor_typing');
      const payload = emittedInternalEvents[0].payload as any;
      assert.strictEqual(payload.workspaceId, mockChannel.workspaceId);
      assert.strictEqual(payload.contactId, mockContact.id);
      assert.strictEqual(payload.isTyping, true);
    });

    it('should return false for unauthenticated socket typing event', async () => {
      const socket = createMockSocket();
      socket.data = {};

      const response = await gateway.handleTyping(socket, { isTyping: true });
      assert.strictEqual(response.success, false);
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

      assert.strictEqual(emittedServerEvents.length, 2);
      assert.strictEqual(emittedServerEvents[0].room, 'widget:chan_web_001:ext_vis_001');
      assert.strictEqual(emittedServerEvents[0].event, 'widget:message');
      assert.strictEqual(emittedServerEvents[1].room, 'widget:ext_vis_001');
      assert.strictEqual(emittedServerEvents[1].event, 'widget:message');
      assert.strictEqual(
        (emittedServerEvents[0].payload as any).content,
        'Agent reply from dashboard',
      );
    });

    it('should ignore event when payload or recipientExternalId is missing', () => {
      assert.doesNotThrow(() => gateway.handleOutboundMessage(null as any));
      assert.doesNotThrow(() => gateway.handleOutboundMessage({} as any));
    });
  });
});
