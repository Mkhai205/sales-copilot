import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { InboxesController } from '../inboxes.controller';
import { InboxesService } from '../inboxes.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('InboxesController (Presentation Layer Endpoints)', () => {
  let controller: InboxesController;
  let mockService: any;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_alpha_1',
    role: WorkspaceRole.OWNER,
    workspace: {
      id: 'ws_alpha_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      billingPlan: 'FREE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockService = {
      listInboxes: async (workspaceId: string) => [
        {
          id: 'ib_1',
          workspaceId,
          name: 'Support Line',
          channelType: ChannelType.TELEGRAM,
          settings: {},
          isAutoAssignmentEnabled: false,
          memberCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
      createInbox: async (workspaceId: string, dto: any) => ({
        id: 'ib_new',
        workspaceId,
        name: dto.name,
        channelType: dto.channelType,
        settings: dto.settings || {},
        isAutoAssignmentEnabled: dto.isAutoAssignmentEnabled || false,
        memberCount: 0,
        channel: {
          id: 'chn_new',
          workspaceId,
          inboxId: 'ib_new',
          channelType: dto.channelType,
          settings: {},
          isConnected: true,
          credentials: dto.channelCredentials || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      getInboxById: async (workspaceId: string, inboxId: string) => ({
        id: inboxId,
        workspaceId,
        name: 'Support Line',
        channelType: ChannelType.TELEGRAM,
        settings: {},
        isAutoAssignmentEnabled: false,
        memberCount: 0,
        channel: {
          id: 'chn_1',
          workspaceId,
          inboxId,
          channelType: ChannelType.TELEGRAM,
          settings: {},
          isConnected: true,
          credentials: { botToken: '123:abc' },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      updateInbox: async (workspaceId: string, inboxId: string, dto: any) => ({
        id: inboxId,
        workspaceId,
        name: dto.name || 'Updated Name',
        channelType: ChannelType.TELEGRAM,
        settings: dto.settings || {},
        isAutoAssignmentEnabled: dto.isAutoAssignmentEnabled || false,
        memberCount: 0,
        channel: {
          id: 'chn_1',
          workspaceId,
          inboxId,
          channelType: ChannelType.TELEGRAM,
          settings: {},
          isConnected: true,
          credentials: dto.channelCredentials || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      deleteInbox: async (_workspaceId: string, _inboxId: string) => ({
        success: true,
        message: 'Inbox deleted successfully',
      }),
    };

    controller = new InboxesController(mockService as InboxesService);
  });

  it('should list all inboxes for current workspace context', async () => {
    const result = await controller.listInboxes(mockContext);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'ib_1');
    assert.strictEqual(result[0].name, 'Support Line');
  });

  it('should handle inbox creation request', async () => {
    const dto = {
      name: 'Sales Channel',
      channelType: ChannelType.ZALO,
      channelCredentials: { secret: 'xyz' },
    };

    const result = await controller.createInbox(mockContext, dto as any);
    assert.strictEqual(result.id, 'ib_new');
    assert.strictEqual(result.name, 'Sales Channel');
    assert.strictEqual(result.channelType, ChannelType.ZALO);
  });

  it('should handle get inbox detail request', async () => {
    const result = await controller.getInbox(mockContext, 'ib_1');
    assert.strictEqual(result.id, 'ib_1');
    assert.ok(result.channel);
    assert.deepStrictEqual(result.channel.credentials, { botToken: '123:abc' });
  });

  it('should handle update inbox request', async () => {
    const result = await controller.updateInbox(mockContext, 'ib_1', { name: 'Renamed Inbox' });
    assert.strictEqual(result.name, 'Renamed Inbox');
  });

  it('should handle delete inbox request', async () => {
    const result = await controller.deleteInbox(mockContext, 'ib_1');
    assert.strictEqual(result.success, true);
  });
});
