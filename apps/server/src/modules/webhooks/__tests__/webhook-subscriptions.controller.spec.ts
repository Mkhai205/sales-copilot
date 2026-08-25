import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WebhookSubscriptionsController } from '../webhook-subscriptions.controller';
import { WebhookEventType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import type { JwtUserPayload } from '../../auth';

describe('WebhookSubscriptionsController (Presentation Layer Endpoints)', () => {
  let controller: WebhookSubscriptionsController;
  let mockService: any;
  let context: WorkspaceContext;
  let user: JwtUserPayload;

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

    user = {
      userId: 'usr_admin_1',
      email: 'admin@acme.com',
      role: 'USER' as any,
    };

    mockService = {
      list: async (workspaceId: string, _query: any) => [
        {
          id: 'sub_1',
          workspaceId,
          url: 'https://example.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
          secretKey: 'secret-123',
          isActive: true,
          createdAt: '2026-08-25T00:00:00Z',
          updatedAt: '2026-08-25T00:00:00Z',
        },
      ],
      create: async (workspaceId: string, dto: any, _actorUserId?: string) => ({
        id: 'sub_new',
        workspaceId,
        url: dto.url,
        subscriptions: dto.subscriptions ?? [],
        secretKey: dto.secretKey ?? 'generated-secret',
        isActive: dto.isActive ?? true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string) => ({
        id,
        workspaceId,
        url: 'https://example.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
        secretKey: 'secret-123',
        isActive: true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      update: async (workspaceId: string, id: string, dto: any, _actorUserId?: string) => ({
        id,
        workspaceId,
        url: dto.url ?? 'https://example.com/webhook',
        subscriptions: dto.subscriptions ?? [WebhookEventType.MESSAGE_CREATED],
        secretKey: dto.secretKey ?? 'secret-123',
        isActive: dto.isActive ?? true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      delete: async (_workspaceId: string, _id: string, _actorUserId?: string) => ({
        success: true,
      }),
    };

    controller = new WebhookSubscriptionsController(mockService as any);
  });

  it('should list webhook subscriptions in workspace', async () => {
    const result = await controller.list(context, { isActive: true });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'sub_1');
    assert.strictEqual(result[0].url, 'https://example.com/webhook');
  });

  it('should create a new webhook subscription', async () => {
    const dto = {
      url: 'https://crm.partner.io/events',
      subscriptions: [WebhookEventType.CONTACT_CREATED],
      secretKey: 'custom-secret-key-12345',
      isActive: true,
    };

    const result = await controller.create(context, user, dto);
    assert.strictEqual(result.id, 'sub_new');
    assert.strictEqual(result.url, 'https://crm.partner.io/events');
    assert.deepStrictEqual(result.subscriptions, [WebhookEventType.CONTACT_CREATED]);
  });

  it('should get a webhook subscription detail by ID', async () => {
    const result = await controller.getById(context, 'sub_1');
    assert.strictEqual(result.id, 'sub_1');
    assert.strictEqual(result.workspaceId, context.workspaceId);
  });

  it('should update an existing webhook subscription', async () => {
    const dto = {
      isActive: false,
    };

    const result = await controller.update(context, user, 'sub_1', dto);
    assert.strictEqual(result.id, 'sub_1');
  });

  it('should delete a webhook subscription', async () => {
    const result = await controller.delete(context, user, 'sub_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
