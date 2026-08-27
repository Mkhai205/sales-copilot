import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { MessagesController } from '../messages.controller';
import {
  DeliveryStatus,
  MessageContentType,
  MessageType,
  PlatformRole,
  SenderType,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import type { JwtUserPayload } from '../../auth/types/jwt-payload.type';

describe('MessagesController (Presentation Layer Endpoints)', () => {
  let controller: MessagesController;
  let mockMessagesService: any;
  let context: WorkspaceContext;
  let mockUser: JwtUserPayload;

  beforeEach(() => {
    context = {
      workspaceId: 'ws_test_123',
      role: WorkspaceRole.AGENT,
      workspace: {
        id: 'ws_test_123',
        name: 'Acme Corp',
        slug: 'acme-corp',
        billingPlan: 'FREE',
        timezone: 'Asia/Ho_Chi_Minh',
        defaultLanguage: 'vi',
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };

    mockUser = {
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'agent@acme.com',
      role: PlatformRole.USER,
    };

    mockMessagesService = {
      list: async (
        workspaceId: string,
        conversationId: string,
        _query?: any,
        isAgent?: boolean,
      ) => ({
        items: [
          {
            id: 'msg_1',
            conversationId,
            workspaceId,
            senderType: SenderType.CONTACT,
            senderId: 'cnt_1',
            messageType: MessageType.INCOMING,
            contentType: MessageContentType.TEXT,
            content: 'Hello!',
            isPrivate: false,
            deliveryStatus: DeliveryStatus.DELIVERED,
            attachments: [],
            createdAt: '2026-08-23T00:00:00Z',
          },
        ],
        meta: {
          page: 1,
          limit: 50,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
      create: async (workspaceId: string, conversationId: string, dto: any, files?: any) => ({
        id: 'msg_new',
        conversationId,
        workspaceId,
        senderType: dto.senderType,
        senderId: dto.senderId,
        messageType: dto.messageType ?? MessageType.OUTGOING,
        contentType: dto.contentType ?? MessageContentType.TEXT,
        content: dto.content,
        isPrivate: dto.isPrivate ?? false,
        deliveryStatus: DeliveryStatus.SENT,
        attachments: files ? [{ id: 'att_1', fileName: 'test.png' }] : [],
        createdAt: '2026-08-23T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string, _isAgent?: boolean) => ({
        id,
        conversationId: 'conv_1',
        workspaceId,
        senderType: SenderType.USER,
        senderId: 'usr_agent_123',
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Hi there!',
        isPrivate: false,
        deliveryStatus: DeliveryStatus.SENT,
        attachments: [],
        createdAt: '2026-08-23T00:00:00Z',
      }),
      updateDeliveryStatus: async (workspaceId: string, id: string, dto: any) => ({
        id,
        conversationId: 'conv_1',
        workspaceId,
        senderType: SenderType.USER,
        senderId: 'usr_agent_123',
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Hi there!',
        isPrivate: false,
        deliveryStatus: dto.deliveryStatus,
        attachments: [],
        createdAt: '2026-08-23T00:00:00Z',
      }),
      delete: async (_workspaceId: string, _id: string) => ({ success: true }),
    };

    controller = new MessagesController(mockMessagesService as any);
  });

  it('should list messages delegating to service with workspaceId and conversationId', async () => {
    const res = await controller.list(context, 'conv_1');
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.items[0].conversationId, 'conv_1');
    assert.strictEqual(res.items[0].workspaceId, 'ws_test_123');
  });

  it('should create message and default senderId to authenticated user', async () => {
    const res = await controller.create(context, mockUser, 'conv_1', {
      content: 'Replying to customer',
    });

    assert.strictEqual(res.id, 'msg_new');
    assert.strictEqual(res.senderId, '11111111-1111-1111-1111-111111111111');
    assert.strictEqual(res.content, 'Replying to customer');
  });

  it('should parse boolean string for isPrivate in multipart uploads', async () => {
    const res = await controller.create(context, mockUser, 'conv_1', {
      content: 'Private note',
      isPrivate: 'true',
    });

    assert.strictEqual(res.isPrivate, true);
  });

  it('should get message by id', async () => {
    const res = await controller.getById(context, 'msg_1');
    assert.strictEqual(res.id, 'msg_1');
    assert.strictEqual(res.content, 'Hi there!');
  });

  it('should update message delivery status', async () => {
    const res = await controller.updateDeliveryStatus(context, 'msg_1', {
      deliveryStatus: DeliveryStatus.READ,
    });
    assert.strictEqual(res.deliveryStatus, DeliveryStatus.READ);
  });

  it('should throw ZodError on invalid message creation payload', async () => {
    await assert.rejects(
      async () => {
        await controller.create(context, mockUser, 'conv_1', {
          content: 'Hello',
          senderType: 'INVALID_SENDER_TYPE',
        });
      },
      (err: any) => {
        assert.ok(err.name === 'ZodError');
        return true;
      },
    );
  });

  it('should delete message', async () => {
    const res = await controller.delete(context, 'msg_1');
    assert.deepStrictEqual(res, { success: true });
  });
});
