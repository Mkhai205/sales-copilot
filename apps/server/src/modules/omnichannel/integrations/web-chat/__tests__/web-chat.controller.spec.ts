import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ChannelType,
  MessageContentType,
  MessageType,
  SenderType,
  widgetContactRequestSchema,
} from '@sales-copilot/shared-contracts';
import { WebChatController } from '../web-chat.controller';
import { WebChatAdapter } from '../web-chat.adapter';
import { WidgetTokenPayload, WidgetTokenService } from '../widget-token.service';

describe('WebChatController (Widget REST API Endpoints)', () => {
  let controller: WebChatController;
  let mockPrisma: any;
  let mockCredentialService: any;
  let mockContactResolutionService: any;
  let mockMessagesService: any;
  let webChatAdapter: WebChatAdapter;
  let widgetTokenService: WidgetTokenService;

  const mockChannel = {
    id: 'chan_web_001',
    workspaceId: 'ws_test_001',
    inboxId: 'inbox_web_001',
    channelType: ChannelType.WEB_CHAT,
    providerAccountId: 'wt_sample_token_123',
    credentials: {
      widgetToken: 'wt_sample_token_123',
    },
    settings: {
      welcomeTitle: 'Live Support Chat',
      welcomeTagline: 'Ask us anything',
      widgetColor: '#0055ff',
      greetingMessage: 'Hello there!',
      websiteUrl: 'https://example.com',
      replyTime: 'in_a_few_minutes',
      preChatFormEnabled: true,
      allowedDomains: 'https://example.com',
      hmacMandatory: false,
    },
  };

  const mockContact = {
    id: 'cont_001',
    workspaceId: 'ws_test_001',
    name: 'Anonymous Visitor',
    identifier: null,
  };

  const mockIdentity = {
    id: 'ci_001',
    channelId: 'chan_web_001',
    contactId: 'cont_001',
    externalContactId: 'anon_vis_001',
  };

  const mockConversation = {
    id: 'conv_001',
    workspaceId: 'ws_test_001',
    inboxId: 'inbox_web_001',
    contactId: 'cont_001',
    status: 'OPEN',
    updatedAt: new Date(),
    messages: [
      {
        id: 'msg_001',
        content: 'Latest message preview',
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(() => {
    mockPrisma = {
      getClient: () => ({
        channel: {
          findFirst: async (query: any) => {
            if (query.where?.providerAccountId === 'wt_sample_token_123') {
              return mockChannel;
            }
            return null;
          },
          findMany: async () => [mockChannel],
        },
        conversation: {
          findMany: async (query: any) => {
            if (query.where?.contactId === 'cont_001') {
              return [mockConversation];
            }
            return [];
          },
          findFirst: async (query: any) => {
            if (query.where?.id === 'conv_001') {
              return mockConversation;
            }
            if (query.where?.id === 'conv_other_user') {
              return {
                ...mockConversation,
                id: 'conv_other_user',
                contactId: 'cont_other_visitor_999',
              };
            }
            return null;
          },
        },
      }),
    };

    mockCredentialService = {
      decrypt: (_creds: any) => ({
        widgetToken: 'wt_sample_token_123',
      }),
    };

    mockContactResolutionService = {
      resolveFromChannel: async (_params: any) => ({
        contact: mockContact,
        channelIdentity: mockIdentity,
        isNewContact: true,
      }),
    };

    mockMessagesService = {
      list: async (_wsId: string, convId: string, query: any, _isAgent: boolean) => ({
        items: [
          {
            id: 'msg_001',
            conversationId: convId,
            content: 'Hello visitor',
            messageType: MessageType.OUTGOING,
            contentType: MessageContentType.TEXT,
            senderType: SenderType.USER,
            isPrivate: false,
          },
        ],
        meta: {
          total: 1,
          page: query.page || 1,
          limit: query.limit || 50,
          totalPages: 1,
          hasNextPage: false,
          hasPrevPage: false,
        },
      }),
    };

    webChatAdapter = new WebChatAdapter();
    widgetTokenService = new WidgetTokenService();

    controller = new WebChatController(
      mockPrisma,
      mockCredentialService,
      mockContactResolutionService,
      mockMessagesService,
      webChatAdapter,
      widgetTokenService,
    );
  });

  describe('GET /api/v1/widget/config', () => {
    it('should return widget config when valid website_token is provided', async () => {
      const config = await controller.getWidgetConfig('wt_sample_token_123');

      assert.strictEqual(config.channelId, mockChannel.id);
      assert.strictEqual(config.inboxId, mockChannel.inboxId);
      assert.strictEqual((config as any).widgetColor, '#0055ff');
      assert.strictEqual((config as any).welcomeTitle, 'Live Support Chat');
      assert.strictEqual((config as any).greetingMessage, 'Hello there!');
    });

    it('should support alternative query parameter names for token', async () => {
      const config = await controller.getWidgetConfig(undefined, 'wt_sample_token_123');
      assert.strictEqual(config.channelId, mockChannel.id);
    });

    it('should throw BadRequestException when token is omitted', async () => {
      await assert.rejects(
        async () => controller.getWidgetConfig(),
        (err: any) => {
          assert.strictEqual(err.name, 'BadRequestException');
          assert.strictEqual(err.response?.code, 'WEBSITE_TOKEN_REQUIRED');
          return true;
        },
      );
    });

    it('should throw NotFoundException when channel is not found', async () => {
      await assert.rejects(
        async () => controller.getWidgetConfig('non_existent_token'),
        (err: any) => {
          assert.strictEqual(err.name, 'NotFoundException');
          assert.strictEqual(err.response?.code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('POST /api/v1/widget/contact', () => {
    it('should create/resolve contact and return Contact JWT token', async () => {
      const response = await controller.getOrCreateContact({
        websiteToken: 'wt_sample_token_123',
        name: 'Jane Visitor',
        email: 'jane@example.com',
      });

      assert.strictEqual(response.contactToken, mockIdentity.externalContactId);
      assert.strictEqual(response.isNewContact, true);
      assert.strictEqual(typeof response.token, 'string');

      // Verify returned JWT token
      const verified = widgetTokenService.verifyToken(response.token);
      assert.strictEqual(verified.contactId, mockContact.id);
      assert.strictEqual(verified.workspaceId, mockChannel.workspaceId);
      assert.strictEqual(verified.channelId, mockChannel.id);
      assert.strictEqual(verified.widgetToken, 'wt_sample_token_123');
    });

    it('should throw BadRequestException when website token is missing in body', async () => {
      await assert.rejects(
        async () => controller.getOrCreateContact({ name: 'Jane' }),
        (err: any) => {
          assert.strictEqual(err.name, 'BadRequestException');
          assert.strictEqual(err.response?.code, 'WEBSITE_TOKEN_REQUIRED');
          return true;
        },
      );
    });

    it('should fail schema validation when email is formatted invalidly', () => {
      const parsed = widgetContactRequestSchema.safeParse({
        websiteToken: 'wt_sample_token_123',
        email: 'not-an-email',
      });
      assert.strictEqual(parsed.success, false);
    });

    it('should throw NotFoundException when channel is not found', async () => {
      await assert.rejects(
        async () => controller.getOrCreateContact({ websiteToken: 'invalid_token' }),
        (err: any) => {
          assert.strictEqual(err.name, 'NotFoundException');
          assert.strictEqual(err.response?.code, 'CHANNEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('GET /api/v1/widget/conversations', () => {
    it('should return visitor conversation history when authenticated', async () => {
      const tokenPayload: WidgetTokenPayload = {
        contactId: 'cont_001',
        workspaceId: 'ws_test_001',
        channelId: 'chan_web_001',
        inboxId: 'inbox_web_001',
        externalContactId: 'anon_vis_001',
        widgetToken: 'wt_sample_token_123',
      };
      const token = widgetTokenService.generateToken(tokenPayload);

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        query: {},
      };

      const result = await controller.getVisitorConversations(mockReq);

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].id, 'conv_001');
      assert.strictEqual(result.meta.total, 1);
    });

    it('should throw UnauthorizedException when token is missing', async () => {
      const mockReq: any = {
        headers: {},
        query: {},
      };

      await assert.rejects(
        async () => controller.getVisitorConversations(mockReq),
        (err: any) => {
          assert.strictEqual(err.name, 'UnauthorizedException');
          return true;
        },
      );
    });
  });

  describe('GET /api/v1/widget/conversations/:conversationId/messages', () => {
    it('should return conversation messages when visitor is authorized', async () => {
      const tokenPayload: WidgetTokenPayload = {
        contactId: 'cont_001',
        workspaceId: 'ws_test_001',
        channelId: 'chan_web_001',
        inboxId: 'inbox_web_001',
        externalContactId: 'anon_vis_001',
        widgetToken: 'wt_sample_token_123',
      };
      const token = widgetTokenService.generateToken(tokenPayload);

      const mockReq: any = {
        headers: {
          authorization: `Bearer ${token}`,
        },
        query: {},
      };

      const result = await controller.getConversationMessages('conv_001', mockReq, 1, 20);

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].id, 'msg_001');
      assert.strictEqual(result.items[0].isPrivate, false);
      assert.strictEqual(result.meta.total, 1);
    });

    it('should throw NotFoundException when conversation does not exist', async () => {
      const tokenPayload: WidgetTokenPayload = {
        contactId: 'cont_001',
        workspaceId: 'ws_test_001',
        channelId: 'chan_web_001',
        inboxId: 'inbox_web_001',
        externalContactId: 'anon_vis_001',
        widgetToken: 'wt_sample_token_123',
      };
      const token = widgetTokenService.generateToken(tokenPayload);

      const mockReq: any = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
      };

      await assert.rejects(
        async () => controller.getConversationMessages('conv_not_found', mockReq),
        (err: any) => {
          assert.strictEqual(err.name, 'NotFoundException');
          assert.strictEqual(err.response?.code, 'CONVERSATION_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw ForbiddenException when visitor attempts to access another visitor conversation', async () => {
      const tokenPayload: WidgetTokenPayload = {
        contactId: 'cont_001',
        workspaceId: 'ws_test_001',
        channelId: 'chan_web_001',
        inboxId: 'inbox_web_001',
        externalContactId: 'anon_vis_001',
        widgetToken: 'wt_sample_token_123',
      };
      const token = widgetTokenService.generateToken(tokenPayload);

      const mockReq: any = {
        headers: { authorization: `Bearer ${token}` },
        query: {},
      };

      await assert.rejects(
        async () => controller.getConversationMessages('conv_other_user', mockReq),
        (err: any) => {
          assert.strictEqual(err.name, 'ForbiddenException');
          assert.strictEqual(err.response?.code, 'UNAUTHORIZED_CONVERSATION_ACCESS');
          return true;
        },
      );
    });
  });
});
