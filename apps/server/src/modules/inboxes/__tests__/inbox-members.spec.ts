import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { InboxesService } from '../inboxes.service';
import { InboxMembersController } from '../inbox-members.controller';
import { ChannelCredentialService } from '../channel-credential.service';
import { ConfigService } from '@nestjs/config';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('InboxMember Management (Feature F-1.3.2 pt.2 & BR-1.3)', () => {
  let service: InboxesService;
  let inboxesDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let inboxMembersDb: Map<string, any>;
  let usersDb: Map<string, any>;
  let workspaceMembersDb: Map<string, any>;

  const wsAlpha = 'ws_alpha_1';
  const wsBeta = 'ws_beta_2';

  const userAgent1 = {
    id: 'usr_agent_1',
    email: 'agent1@alphacorp.com',
    name: 'Agent One',
    avatarUrl: null,
  };
  const userAgent2 = {
    id: 'usr_agent_2',
    email: 'agent2@alphacorp.com',
    name: 'Agent Two',
    avatarUrl: 'https://avatar.com/agent2.png',
  };
  const userExternal = {
    id: 'usr_external_99',
    email: 'external@othercorp.com',
    name: 'External User',
    avatarUrl: null,
  };

  beforeEach(() => {
    inboxesDb = new Map();
    channelsDb = new Map();
    inboxMembersDb = new Map();
    usersDb = new Map();
    workspaceMembersDb = new Map();

    usersDb.set(userAgent1.id, userAgent1);
    usersDb.set(userAgent2.id, userAgent2);
    usersDb.set(userExternal.id, userExternal);

    // userAgent1 (AGENT) & userAgent2 (ADMIN) belong to wsAlpha
    workspaceMembersDb.set(`${wsAlpha}:${userAgent1.id}`, {
      id: 'wm_1',
      workspaceId: wsAlpha,
      userId: userAgent1.id,
      role: WorkspaceRole.AGENT,
      user: userAgent1,
    });
    workspaceMembersDb.set(`${wsAlpha}:${userAgent2.id}`, {
      id: 'wm_2',
      workspaceId: wsAlpha,
      userId: userAgent2.id,
      role: WorkspaceRole.ADMIN,
      user: userAgent2,
    });

    // userExternal belongs only to wsBeta
    workspaceMembersDb.set(`${wsBeta}:${userExternal.id}`, {
      id: 'wm_ext',
      workspaceId: wsBeta,
      userId: userExternal.id,
      role: WorkspaceRole.AGENT,
      user: userExternal,
    });

    const mockConfigService = {
      get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    const credentialService = new ChannelCredentialService(
      mockConfigService as unknown as ConfigService,
    );

    const clientMock = {
      inbox: {
        findFirst: async ({ where }: { where: { id: string; workspaceId?: string } }) => {
          const inbox = inboxesDb.get(where.id);
          if (!inbox) return null;
          if (where.workspaceId && inbox.workspaceId !== where.workspaceId) return null;
          return inbox;
        },
        create: async ({ data }: { data: any }) => {
          const newInbox = {
            id: `ib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inboxesDb.set(newInbox.id, newInbox);
          return newInbox;
        },
      },
      channel: {
        findFirst: async () => null,
        create: async ({ data }: { data: any }) => {
          const newChannel = {
            id: `chn_${Date.now()}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          channelsDb.set(newChannel.id, newChannel);
          return newChannel;
        },
      },
      workspaceMember: {
        findFirst: async ({ where }: { where: { workspaceId: string; userId: string } }) => {
          const member = workspaceMembersDb.get(`${where.workspaceId}:${where.userId}`);
          if (!member) return null;
          return {
            ...member,
            user: usersDb.get(where.userId),
          };
        },
      },
      inboxMember: {
        findFirst: async ({ where }: { where: { inboxId: string; userId: string } }) => {
          for (const m of inboxMembersDb.values()) {
            if (m.inboxId === where.inboxId && m.userId === where.userId) {
              return m;
            }
          }
          return null;
        },
        findMany: async ({ where }: { where: { inboxId: string } }) => {
          const results: any[] = [];
          for (const m of inboxMembersDb.values()) {
            if (m.inboxId === where.inboxId) {
              const u = usersDb.get(m.userId);
              const wmList: any[] = [];
              for (const wm of workspaceMembersDb.values()) {
                if (wm.userId === m.userId) {
                  wmList.push({ role: wm.role });
                }
              }
              results.push({
                ...m,
                user: {
                  ...u,
                  workspaceMembers: wmList,
                },
              });
            }
          }
          return results;
        },
        create: async ({ data }: { data: { inboxId: string; userId: string } }) => {
          const newMember = {
            id: `im_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            inboxId: data.inboxId,
            userId: data.userId,
            createdAt: new Date(),
          };
          inboxMembersDb.set(newMember.id, newMember);
          return newMember;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = inboxMembersDb.get(where.id);
          inboxMembersDb.delete(where.id);
          return existing;
        },
      },
    };

    const mockPrismaService: any = {
      getClient: () => clientMock,
      runInTransaction: async (cb: (ctx: any) => Promise<any>) => cb({ tx: clientMock }),
    };

    service = new InboxesService(mockPrismaService, credentialService);
  });

  describe('Add Member to Inbox (BR-1.3 Enforcement)', () => {
    it('should add a valid workspace member to the inbox successfully', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Tech Support',
        channelType: ChannelType.WEB_CHAT,
      });

      const member = await service.addMember(wsAlpha, inbox.id, userAgent1.id);

      assert.ok(member.id);
      assert.strictEqual(member.inboxId, inbox.id);
      assert.strictEqual(member.userId, userAgent1.id);
      assert.strictEqual(member.user.email, userAgent1.email);
      assert.strictEqual(member.user.role, WorkspaceRole.AGENT);

      // Verify in list
      const membersList = await service.listMembers(wsAlpha, inbox.id);
      assert.strictEqual(membersList.length, 1);
      assert.strictEqual(membersList[0].userId, userAgent1.id);
    });

    it('should throw BadRequestException (INVALID_INBOX_MEMBER) when user is NOT in workspace (BR-1.3)', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Sales Inbox',
        channelType: ChannelType.TELEGRAM,
      });

      // userExternal belongs to wsBeta, not wsAlpha
      await assert.rejects(
        () => service.addMember(wsAlpha, inbox.id, userExternal.id),
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_INBOX_MEMBER');
          return true;
        },
      );
    });

    it('should throw ConflictException (INBOX_MEMBER_ALREADY_EXISTS) on duplicate member addition', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Billing Support',
        channelType: ChannelType.EMAIL,
      });

      await service.addMember(wsAlpha, inbox.id, userAgent1.id);

      await assert.rejects(
        () => service.addMember(wsAlpha, inbox.id, userAgent1.id),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_MEMBER_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should throw NotFoundException when adding member to non-existent inbox or in another workspace', async () => {
      await assert.rejects(
        () => service.addMember(wsAlpha, 'non_existent_inbox', userAgent1.id),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('List Inbox Members', () => {
    it('should list all members with their respective roles and profiles', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'General Support',
        channelType: ChannelType.WEB_CHAT,
      });

      await service.addMember(wsAlpha, inbox.id, userAgent1.id);
      await service.addMember(wsAlpha, inbox.id, userAgent2.id);

      const members = await service.listMembers(wsAlpha, inbox.id);
      assert.strictEqual(members.length, 2);

      const m1 = members.find(m => m.userId === userAgent1.id);
      const m2 = members.find(m => m.userId === userAgent2.id);

      assert.ok(m1);
      assert.strictEqual(m1.user.name, 'Agent One');
      assert.strictEqual(m1.user.role, WorkspaceRole.AGENT);

      assert.ok(m2);
      assert.strictEqual(m2.user.name, 'Agent Two');
      assert.strictEqual(m2.user.role, WorkspaceRole.ADMIN);
    });

    it('should throw NotFoundException when listing members for non-existent inbox', async () => {
      await assert.rejects(
        () => service.listMembers(wsAlpha, 'unknown_inbox'),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('Remove Member from Inbox', () => {
    it('should remove a member from an inbox successfully', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Escalations',
        channelType: ChannelType.ZALO,
      });

      await service.addMember(wsAlpha, inbox.id, userAgent1.id);
      assert.strictEqual((await service.listMembers(wsAlpha, inbox.id)).length, 1);

      const result = await service.removeMember(wsAlpha, inbox.id, userAgent1.id);
      assert.strictEqual(result.success, true);

      assert.strictEqual((await service.listMembers(wsAlpha, inbox.id)).length, 0);
    });

    it('should throw NotFoundException (INBOX_MEMBER_NOT_FOUND) when removing member not in inbox', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Escalations',
        channelType: ChannelType.ZALO,
      });

      await assert.rejects(
        () => service.removeMember(wsAlpha, inbox.id, userAgent1.id),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_MEMBER_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('InboxMembersController Endpoints', () => {
    let controller: InboxMembersController;

    const mockContext: WorkspaceContext = {
      workspaceId: wsAlpha,
      role: WorkspaceRole.OWNER,
      workspace: {
        id: wsAlpha,
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
      controller = new InboxMembersController(service);
    });

    it('should handle list members endpoint', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Controller Test Inbox',
        channelType: ChannelType.WEB_CHAT,
      });
      await service.addMember(wsAlpha, inbox.id, userAgent1.id);

      const list = await controller.listMembers(mockContext, inbox.id);
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].userId, userAgent1.id);
    });

    it('should handle add member endpoint', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Controller Add Inbox',
        channelType: ChannelType.WEB_CHAT,
      });

      const added = await controller.addMember(mockContext, inbox.id, { userId: userAgent1.id });
      assert.strictEqual(added.userId, userAgent1.id);
    });

    it('should handle remove member endpoint', async () => {
      const inbox = await service.createInbox(wsAlpha, {
        name: 'Controller Remove Inbox',
        channelType: ChannelType.WEB_CHAT,
      });
      await service.addMember(wsAlpha, inbox.id, userAgent1.id);

      const removed = await controller.removeMember(mockContext, inbox.id, userAgent1.id);
      assert.strictEqual(removed.success, true);
    });
  });
});
