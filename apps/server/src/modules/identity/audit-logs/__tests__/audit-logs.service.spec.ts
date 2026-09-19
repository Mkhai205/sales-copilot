import { AuditLogService } from '../audit-logs.service';

describe('AuditLogService (Feature F-1.8.4: Audit Logging)', () => {
  let service: AuditLogService;
  let mockPrismaService: any;
  let auditLogsDb: Array<any>;
  let usersDb: Map<string, any>;

  beforeEach(() => {
    auditLogsDb = [];
    usersDb = new Map();

    usersDb.set('usr_admin_1', {
      id: 'usr_admin_1',
      email: 'admin@acme.com',
      name: 'Admin One',
      avatarUrl: 'https://example.com/avatar1.png',
    });

    usersDb.set('usr_agent_2', {
      id: 'usr_agent_2',
      email: 'agent2@acme.com',
      name: 'Agent Two',
      avatarUrl: null,
    });

    const clientMock = {
      auditLog: {
        create: async ({ data }: { data: any }) => {
          const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const user = data.userId ? usersDb.get(data.userId) || null : null;
          const record = {
            id,
            workspaceId: data.workspaceId,
            userId: data.userId,
            action: data.action,
            resourceType: data.resourceType,
            resourceId: data.resourceId,
            payload: data.payload ?? null,
            ipAddress: data.ipAddress ?? null,
            createdAt: new Date(),
            user,
          };
          auditLogsDb.push(record);
          return { ...record };
        },

        findMany: async ({
          where,
          skip = 0,
          take = 20,
          orderBy,
        }: {
          where?: any;
          skip?: number;
          take?: number;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          const results = auditLogsDb.filter(item => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.action && item.action !== where.action) return false;
            if (where?.userId && item.userId !== where.userId) return false;
            if (where?.resourceType && item.resourceType !== where.resourceType) return false;
            if (where?.resourceId && item.resourceId !== where.resourceId) return false;
            if (where?.createdAt?.gte && new Date(item.createdAt) < new Date(where.createdAt.gte))
              return false;
            if (where?.createdAt?.lte && new Date(item.createdAt) > new Date(where.createdAt.lte))
              return false;
            return true;
          });

          if (orderBy?.createdAt) {
            const dir = orderBy.createdAt;
            results.sort((a, b) => {
              const aTime = new Date(a.createdAt).getTime();
              const bTime = new Date(b.createdAt).getTime();
              return dir === 'desc' ? bTime - aTime : aTime - bTime;
            });
          }

          return results.slice(skip, skip + take).map(r => ({ ...r }));
        },

        count: async ({ where }: { where?: any }) => {
          const matched = auditLogsDb.filter(item => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.action && item.action !== where.action) return false;
            if (where?.userId && item.userId !== where.userId) return false;
            if (where?.resourceType && item.resourceType !== where.resourceType) return false;
            if (where?.resourceId && item.resourceId !== where.resourceId) return false;
            if (where?.createdAt?.gte && new Date(item.createdAt) < new Date(where.createdAt.gte))
              return false;
            if (where?.createdAt?.lte && new Date(item.createdAt) > new Date(where.createdAt.lte))
              return false;
            return true;
          });
          return matched.length;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new AuditLogService(mockPrismaService);
  });

  describe('log (direct immutable logging)', () => {
    it('should log an immutable audit log entry with full details and user relation', async () => {
      const entry = await service.log({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        action: 'MEMBER_ADDED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: 'wm_123',
        payload: { email: 'newmember@acme.com', role: 'AGENT' },
        ipAddress: '127.0.0.1',
      });

      expect(entry.workspaceId).toBe('ws_1');
      expect(entry.userId).toBe('usr_admin_1');
      expect(entry.action).toBe('MEMBER_ADDED');
      expect(entry.resourceType).toBe('WORKSPACE_MEMBER');
      expect(entry.resourceId).toBe('wm_123');
      expect(entry.payload).toEqual({ email: 'newmember@acme.com', role: 'AGENT' });
      expect(entry.ipAddress).toBe('127.0.0.1');
      expect(entry.user?.email).toBe('admin@acme.com');
      expect(entry.createdAt).toBeTruthy();

      expect(auditLogsDb.length).toBe(1);
    });

    it('should allow system actions with null userId', async () => {
      const entry = await service.log({
        workspaceId: 'ws_1',
        userId: null,
        action: 'AUTOMATION_TRIGGERED',
        resourceType: 'AUTOMATION_RULE',
        resourceId: 'rule_99',
        payload: { ruleName: 'Auto-reply outside hours' },
      });

      expect(entry.userId).toBe(null);
      expect(entry.user).toBe(null);
      expect(entry.action).toBe('AUTOMATION_TRIGGERED');
    });
  });

  describe('list & filtering', () => {
    beforeEach(async () => {
      await service.log({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        action: 'MEMBER_ADDED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: 'wm_1',
      });
      await service.log({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        action: 'ROLE_CHANGED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: 'wm_1',
      });
      await service.log({
        workspaceId: 'ws_1',
        userId: 'usr_agent_2',
        action: 'CONTACT_MERGED',
        resourceType: 'CONTACT',
        resourceId: 'cnt_target',
      });
      await service.log({
        workspaceId: 'ws_2',
        userId: 'usr_admin_1',
        action: 'MEMBER_ADDED',
        resourceType: 'WORKSPACE_MEMBER',
        resourceId: 'wm_2',
      });
    });

    it('should list all logs for workspace with pagination meta', async () => {
      const result = await service.list('ws_1');
      expect(result.items.length).toBe(3);
      expect(result.meta.total).toBe(3);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
      expect(result.meta.hasMore).toBe(false);
    });

    it('should filter by action type', async () => {
      const result = await service.list('ws_1', { action: 'MEMBER_ADDED' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].action).toBe('MEMBER_ADDED');
    });

    it('should filter by actor / userId', async () => {
      const result = await service.list('ws_1', { actorId: 'usr_agent_2' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].action).toBe('CONTACT_MERGED');
    });

    it('should filter by resourceType', async () => {
      const result = await service.list('ws_1', { resourceType: 'CONTACT' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].resourceId).toBe('cnt_target');
    });

    it('should filter by resourceId', async () => {
      const result = await service.list('ws_1', { resourceId: 'wm_1' });
      expect(result.items.length).toBe(2);
    });

    it('should enforce tenant isolation (workspace 2 logs not visible in workspace 1)', async () => {
      const ws1 = await service.list('ws_1');
      const ws2 = await service.list('ws_2');

      expect(ws1.items.length).toBe(3);
      expect(ws2.items.length).toBe(1);
      expect(ws2.items[0].workspaceId).toBe('ws_2');
    });

    it('should handle pagination with page and limit', async () => {
      const page1 = await service.list('ws_1', { page: 1, limit: 2 });
      expect(page1.items.length).toBe(2);
      expect(page1.meta.total).toBe(3);
      expect(page1.meta.hasMore).toBe(true);

      const page2 = await service.list('ws_1', { page: 2, limit: 2 });
      expect(page2.items.length).toBe(1);
      expect(page2.meta.hasMore).toBe(false);
    });
  });

  describe('Event Listeners (Event-Driven Automated Auditing)', () => {
    it('should record audit log on contact.merged event', async () => {
      await service.handleContactMerged({
        workspaceId: 'ws_1',
        performedByUserId: 'usr_admin_1',
        primaryContactId: 'cnt_1',
        mergedContactId: 'cnt_2',
      });

      expect(auditLogsDb.length).toBe(1);
      expect(auditLogsDb[0].action).toBe('CONTACT_MERGED');
      expect(auditLogsDb[0].resourceType).toBe('CONTACT');
      expect(auditLogsDb[0].resourceId).toBe('cnt_1');
    });

    it('should record audit log on channel.created and channel.deleted events', async () => {
      await service.handleChannelCreated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        channelId: 'ch_fb',
        channelType: 'FACEBOOK_MESSENGER',
        inboxId: 'ib_1',
      });

      await service.handleChannelDeleted({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        channelId: 'ch_fb',
        channelType: 'FACEBOOK_MESSENGER',
      });

      expect(auditLogsDb.length).toBe(2);
      expect(auditLogsDb[0].action).toBe('CHANNEL_CREATED');
      expect(auditLogsDb[1].action).toBe('CHANNEL_DELETED');
    });

    it('should record audit log on label.created and label.deleted events', async () => {
      await service.handleLabelCreated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        label: { id: 'lbl_vip', title: 'VIP', color: '#FF0000' },
      });

      await service.handleLabelDeleted({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        labelId: 'lbl_vip',
        title: 'VIP',
      });

      expect(auditLogsDb.length).toBe(2);
      expect(auditLogsDb[0].action).toBe('LABEL_CREATED');
      expect(auditLogsDb[1].action).toBe('LABEL_DELETED');
    });

    it('should record audit log on canned_response.created and canned_response.deleted events', async () => {
      await service.handleCannedResponseCreated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        cannedResponse: { id: 'cr_1', shortCode: 'chao' },
      });

      await service.handleCannedResponseDeleted({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        cannedResponseId: 'cr_1',
        shortCode: 'chao',
      });

      expect(auditLogsDb.length).toBe(2);
      expect(auditLogsDb[0].action).toBe('CANNED_RESPONSE_CREATED');
      expect(auditLogsDb[1].action).toBe('CANNED_RESPONSE_DELETED');
    });

    it('should record audit log on automation_rule created, updated, and deleted events', async () => {
      await service.handleAutomationRuleCreated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        rule: {
          id: 'rule_1',
          name: 'VIP Auto Assign',
          eventTrigger: 'MESSAGE_CREATED',
          isActive: true,
        },
      });

      await service.handleAutomationRuleUpdated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        rule: {
          id: 'rule_1',
          name: 'VIP Auto Assign Updated',
          eventTrigger: 'MESSAGE_CREATED',
          isActive: false,
        },
      });

      await service.handleAutomationRuleDeleted({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        ruleId: 'rule_1',
        name: 'VIP Auto Assign Updated',
      });

      expect(auditLogsDb.length).toBe(3);
      expect(auditLogsDb[0].action).toBe('AUTOMATION_RULE_CREATED');
      expect(auditLogsDb[0].resourceType).toBe('AUTOMATION_RULE');
      expect(auditLogsDb[1].action).toBe('AUTOMATION_RULE_UPDATED');
      expect(auditLogsDb[2].action).toBe('AUTOMATION_RULE_DELETED');
    });

    it('should record audit log on workspace_member added, role_updated, and removed events (FINDING-P8-01)', async () => {
      await service.handleWorkspaceMemberAdded({
        workspaceId: 'ws_1',
        performedByUserId: 'usr_admin_1',
        memberId: 'wm_1',
        userId: 'usr_agent_2',
        email: 'agent2@acme.com',
        role: 'AGENT',
      });

      await service.handleWorkspaceMemberRoleUpdated({
        workspaceId: 'ws_1',
        performedByUserId: 'usr_admin_1',
        memberId: 'wm_1',
        userId: 'usr_agent_2',
        oldRole: 'AGENT',
        newRole: 'ADMIN',
      });

      await service.handleWorkspaceMemberRemoved({
        workspaceId: 'ws_1',
        performedByUserId: 'usr_admin_1',
        memberId: 'wm_1',
        userId: 'usr_agent_2',
        role: 'ADMIN',
      });

      expect(auditLogsDb.length).toBe(3);
      expect(auditLogsDb[0].action).toBe('WORKSPACE_MEMBER_ADDED');
      expect(auditLogsDb[0].resourceType).toBe('WORKSPACE_MEMBER');
      expect(auditLogsDb[0].resourceId).toBe('wm_1');
      expect(auditLogsDb[0].payload.role).toBe('AGENT');

      expect(auditLogsDb[1].action).toBe('WORKSPACE_MEMBER_ROLE_UPDATED');
      expect(auditLogsDb[1].payload.newRole).toBe('ADMIN');

      expect(auditLogsDb[2].action).toBe('WORKSPACE_MEMBER_REMOVED');
    });

    it('should record audit log on webhook_subscription created, updated, and deleted events (FINDING-P8-01)', async () => {
      await service.handleWebhookSubscriptionCreated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        subscription: {
          id: 'sub_1',
          url: 'https://example.com/webhook',
          subscriptions: ['message.created'],
          isActive: true,
        },
      });

      await service.handleWebhookSubscriptionUpdated({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        subscription: {
          id: 'sub_1',
          url: 'https://example.com/webhook-v2',
          subscriptions: ['message.created', 'conversation.created'],
          isActive: true,
        },
      });

      await service.handleWebhookSubscriptionDeleted({
        workspaceId: 'ws_1',
        userId: 'usr_admin_1',
        subscriptionId: 'sub_1',
        url: 'https://example.com/webhook-v2',
      });

      expect(auditLogsDb.length).toBe(3);
      expect(auditLogsDb[0].action).toBe('WEBHOOK_SUBSCRIPTION_CREATED');
      expect(auditLogsDb[0].resourceType).toBe('WEBHOOK_SUBSCRIPTION');
      expect(auditLogsDb[0].resourceId).toBe('sub_1');

      expect(auditLogsDb[1].action).toBe('WEBHOOK_SUBSCRIPTION_UPDATED');
      expect(auditLogsDb[2].action).toBe('WEBHOOK_SUBSCRIPTION_DELETED');
      expect(auditLogsDb[2].resourceId).toBe('sub_1');
    });
  });
});
