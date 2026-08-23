import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConversationsController } from '../conversations.controller';
import {
  ConversationPriority,
  ConversationStatus,
  Priority,
  WorkspaceRole,
  PlatformRole,
} from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import type { JwtUserPayload } from '../../auth/types/jwt-payload.type';

describe('ConversationsController (Presentation Layer Endpoints)', () => {
  let controller: ConversationsController;
  let mockConversationsService: any;
  let context: WorkspaceContext;
  let mockUser: JwtUserPayload;

  beforeEach(() => {
    context = {
      workspaceId: 'ws_test_123',
      role: WorkspaceRole.ADMIN,
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
      userId: 'usr_admin_123',
      email: 'admin@acme.com',
      role: PlatformRole.USER,
    };

    mockConversationsService = {
      list: async (workspaceId: string, query: any) => ({
        items: [
          {
            id: 'conv_1',
            displayId: 1,
            workspaceId,
            contactId: 'cnt_1',
            inboxId: 'ib_1',
            status: ConversationStatus.OPEN,
            priority: ConversationPriority.MEDIUM,
            unreadMessagesCount: 0,
            lastActivityAt: '2026-08-23T00:00:00Z',
            createdAt: '2026-08-23T00:00:00Z',
            updatedAt: '2026-08-23T00:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, hasMore: false },
      }),
      create: async (workspaceId: string, dto: any) => ({
        id: 'conv_new',
        displayId: 2,
        workspaceId,
        contactId: dto.contactId,
        inboxId: dto.inboxId,
        assigneeId: dto.assigneeId ?? null,
        teamId: dto.teamId ?? null,
        status: ConversationStatus.OPEN,
        priority: dto.priority ?? ConversationPriority.MEDIUM,
        unreadMessagesCount: 0,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string) => ({
        id,
        displayId: 1,
        workspaceId,
        contactId: 'cnt_1',
        inboxId: 'ib_1',
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.MEDIUM,
        unreadMessagesCount: 0,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      updateStatus: async (workspaceId: string, id: string, dto: any) => ({
        id,
        displayId: 1,
        workspaceId,
        status: dto.status,
        snoozedUntil: dto.snoozedUntil ?? null,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      assign: async (workspaceId: string, id: string, dto: any, userId?: string) => ({
        id,
        displayId: 1,
        workspaceId,
        assigneeId: dto.assigneeId ?? null,
        teamId: dto.teamId ?? null,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      updatePriority: async (workspaceId: string, id: string, dto: any) => ({
        id,
        displayId: 1,
        workspaceId,
        priority: dto.priority,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      resetUnreadCount: async (workspaceId: string, id: string) => ({
        id,
        displayId: 1,
        workspaceId,
        unreadMessagesCount: 0,
        lastActivityAt: '2026-08-23T00:00:00Z',
        createdAt: '2026-08-23T00:00:00Z',
        updatedAt: '2026-08-23T00:00:00Z',
      }),
      getLabels: async (workspaceId: string, id: string) => [
        {
          id: 'lbl_1',
          workspaceId,
          title: 'VIP',
          color: '#FF0000',
          showOnSidebar: true,
          createdAt: '2026-08-23T00:00:00Z',
        },
      ],
      assignLabels: async (workspaceId: string, id: string, labelIds: string[]) => [
        {
          id: 'lbl_1',
          workspaceId,
          title: 'VIP',
          color: '#FF0000',
          showOnSidebar: true,
          createdAt: '2026-08-23T00:00:00Z',
        },
      ],
      removeLabel: async (workspaceId: string, id: string, labelId: string) => ({ success: true }),
    };

    controller = new ConversationsController(mockConversationsService as any);
  });

  it('should list conversations delegating to service with workspaceId from context', async () => {
    const res = await controller.list(context);
    assert.strictEqual(res.items.length, 1);
    assert.strictEqual(res.meta.total, 1);
    assert.strictEqual(res.items[0].workspaceId, 'ws_test_123');
  });

  it('should create conversation delegating to service', async () => {
    const created = await controller.create(context, {
      contactId: '11111111-1111-1111-1111-111111111111',
      inboxId: '22222222-2222-2222-2222-222222222222',
      priority: Priority.HIGH,
    });
    assert.strictEqual(created.id, 'conv_new');
    assert.strictEqual(created.priority, ConversationPriority.HIGH);
  });

  it('should get conversation by ID', async () => {
    const found = await controller.getById(context, 'conv_1');
    assert.strictEqual(found.id, 'conv_1');
  });

  it('should update conversation status', async () => {
    const updated = await controller.updateStatus(context, 'conv_1', {
      status: ConversationStatus.PENDING,
    });
    assert.strictEqual(updated.status, ConversationStatus.PENDING);
  });

  it('should assign conversation with user and workspace context', async () => {
    const assigned = await controller.assign(context, mockUser, 'conv_1', {
      assigneeId: '33333333-3333-3333-3333-333333333333',
    });
    assert.strictEqual(assigned.assigneeId, '33333333-3333-3333-3333-333333333333');
  });

  it('should update conversation priority', async () => {
    const updated = await controller.updatePriority(context, 'conv_1', {
      priority: Priority.URGENT,
    });
    assert.strictEqual(updated.priority, Priority.URGENT);
  });

  it('should reset unread count', async () => {
    const reset = await controller.resetUnread(context, 'conv_1');
    assert.strictEqual(reset.unreadMessagesCount, 0);
  });

  it('should get labels for a conversation', async () => {
    const labels = await controller.getLabels(context, 'conv_1');
    assert.strictEqual(labels.length, 1);
    assert.strictEqual(labels[0].title, 'VIP');
  });

  it('should assign labels to conversation', async () => {
    const labels = await controller.assignLabels(context, 'conv_1', {
      labelIds: ['44444444-4444-4444-4444-444444444444'],
    });
    assert.strictEqual(labels.length, 1);
  });

  it('should remove label from conversation', async () => {
    const result = await controller.removeLabel(context, 'conv_1', 'lbl_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
