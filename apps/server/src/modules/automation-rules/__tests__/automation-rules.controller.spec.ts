import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AutomationRulesController } from '../automation-rules.controller';
import {
  AutomationActionType,
  AutomationEventTrigger,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import type { JwtUserPayload } from '../../auth';

describe('AutomationRulesController (Presentation Layer Endpoints)', () => {
  let controller: AutomationRulesController;
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
          id: 'rule_1',
          workspaceId,
          name: 'Auto Assign VIP',
          description: 'VIP support rule',
          eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
          conditions: [],
          actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'vip' } }],
          isActive: true,
          createdAt: '2026-08-25T00:00:00Z',
          updatedAt: '2026-08-25T00:00:00Z',
        },
      ],
      create: async (workspaceId: string, dto: any, _actorUserId?: string) => ({
        id: 'rule_new',
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        eventTrigger: dto.eventTrigger,
        conditions: dto.conditions ?? [],
        actions: dto.actions ?? [],
        isActive: dto.isActive ?? true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      getById: async (workspaceId: string, id: string) => ({
        id,
        workspaceId,
        name: 'Auto Assign VIP',
        description: 'VIP support rule',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'vip' } }],
        isActive: true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      update: async (workspaceId: string, id: string, dto: any, _actorUserId?: string) => ({
        id,
        workspaceId,
        name: dto.name ?? 'Auto Assign VIP',
        description: dto.description ?? null,
        eventTrigger: dto.eventTrigger ?? AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: dto.conditions ?? [],
        actions: dto.actions ?? [
          { type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'vip' } },
        ],
        isActive: dto.isActive ?? true,
        createdAt: '2026-08-25T00:00:00Z',
        updatedAt: '2026-08-25T00:00:00Z',
      }),
      delete: async (_workspaceId: string, _id: string, _actorUserId?: string) => ({
        success: true,
      }),
    };

    controller = new AutomationRulesController(mockService as any);
  });

  it('should list automation rules passing workspaceId and query from context', async () => {
    const result = await controller.list(context, { isActive: true });
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, 'Auto Assign VIP');
    assert.strictEqual(result[0].workspaceId, 'ws_test_123');
  });

  it('should create automation rule delegating to service with actor userId', async () => {
    const result = await controller.create(context, user, {
      name: 'New Rule',
      eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
      conditions: [],
      actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'new' } }],
      isActive: true,
    });
    assert.strictEqual(result.name, 'New Rule');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should get automation rule by ID delegating to service', async () => {
    const result = await controller.getById(context, 'rule_1');
    assert.strictEqual(result.id, 'rule_1');
    assert.strictEqual(result.workspaceId, 'ws_test_123');
  });

  it('should update automation rule delegating to service', async () => {
    const result = await controller.update(context, user, 'rule_1', {
      name: 'Updated Rule',
    });
    assert.strictEqual(result.name, 'Updated Rule');
    assert.strictEqual(result.id, 'rule_1');
  });

  it('should delete automation rule delegating to service', async () => {
    const result = await controller.delete(context, user, 'rule_1');
    assert.deepStrictEqual(result, { success: true });
  });
});
