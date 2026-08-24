import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlatformRole, PresenceEntry, PresenceStatus } from '@sales-copilot/shared-contracts';
import { PresenceController } from '../presence.controller';
import type { JwtUserPayload } from '../../auth/types/jwt-payload.type';

describe('PresenceController (REST API Endpoints — Task 9)', () => {
  let controller: PresenceController;
  let mockPresenceService: any;
  let mockPrisma: any;

  const validWorkspaceId = '11111111-1111-1111-1111-111111111111';
  const unauthorizedWorkspaceId = '99999999-9999-9999-9999-999999999999';
  const validUserId = 'usr_agent_001';
  const targetUserId = 'usr_agent_002';

  const mockUser: JwtUserPayload = {
    userId: validUserId,
    email: 'agent@salescopilot.io',
    role: PlatformRole.USER,
  };

  const mockPresenceList: PresenceEntry[] = [
    {
      userId: validUserId,
      status: PresenceStatus.ONLINE,
      lastSeenAt: new Date().toISOString(),
    },
    {
      userId: targetUserId,
      status: PresenceStatus.AWAY,
      lastSeenAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    mockPresenceService = {
      getWorkspacePresence: async (workspaceId: string, includeOffline?: boolean) => {
        if (workspaceId === validWorkspaceId) {
          if (includeOffline) {
            return [
              ...mockPresenceList,
              {
                userId: 'usr_offline',
                status: PresenceStatus.OFFLINE,
                lastSeenAt: new Date().toISOString(),
              },
            ];
          }
          return mockPresenceList;
        }
        return [];
      },
      getUserPresence: async (workspaceId: string, userId: string) => {
        if (workspaceId === validWorkspaceId && userId === targetUserId) {
          return mockPresenceList[1];
        }
        return null;
      },
    };

    mockPrisma = {
      getClient: () => ({
        workspaceMember: {
          findFirst: async (args: any) => {
            if (
              args.where?.workspaceId === validWorkspaceId &&
              args.where?.userId === validUserId
            ) {
              return { workspaceId: validWorkspaceId, userId: validUserId };
            }
            return null;
          },
        },
      }),
    };

    controller = new PresenceController(mockPresenceService, mockPrisma);
  });

  describe('GET /workspaces/:workspaceId/presence', () => {
    it('should successfully retrieve workspace presence list for authorized workspace member', async () => {
      const result = await controller.getWorkspacePresence(validWorkspaceId, mockUser);

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].userId, validUserId);
      assert.strictEqual(result[0].status, PresenceStatus.ONLINE);
      assert.strictEqual(result[1].userId, targetUserId);
      assert.strictEqual(result[1].status, PresenceStatus.AWAY);
    });

    it('should include offline agents when includeOffline is set to true', async () => {
      const result = await controller.getWorkspacePresence(validWorkspaceId, mockUser, 'true');

      assert.strictEqual(result.length, 3);
      const offlineMember = result.find(m => m.status === PresenceStatus.OFFLINE);
      assert.ok(offlineMember);
      assert.strictEqual(offlineMember.userId, 'usr_offline');
    });

    it('should throw ForbiddenException when user is not a member of the workspace', async () => {
      await assert.rejects(
        async () => {
          await controller.getWorkspacePresence(unauthorizedWorkspaceId, mockUser);
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          const res = err.getResponse() as any;
          assert.strictEqual(res.code, 'WORKSPACE_ACCESS_DENIED');
          return true;
        },
      );
    });
  });

  describe('GET /workspaces/:workspaceId/presence/:userId', () => {
    it('should successfully retrieve presence status for a specific user', async () => {
      const result = await controller.getUserPresence(validWorkspaceId, targetUserId, mockUser);

      assert.ok(result);
      assert.strictEqual(result.userId, targetUserId);
      assert.strictEqual(result.status, PresenceStatus.AWAY);
    });

    it('should throw NotFoundException when presence record does not exist for target user', async () => {
      await assert.rejects(
        async () => {
          await controller.getUserPresence(validWorkspaceId, 'non_existent_user', mockUser);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          const res = err.getResponse() as any;
          assert.strictEqual(res.code, 'PRESENCE_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw ForbiddenException when caller is not a member of the workspace', async () => {
      await assert.rejects(
        async () => {
          await controller.getUserPresence(unauthorizedWorkspaceId, targetUserId, mockUser);
        },
        (err: any) => {
          assert.ok(err instanceof ForbiddenException);
          const res = err.getResponse() as any;
          assert.strictEqual(res.code, 'WORKSPACE_ACCESS_DENIED');
          return true;
        },
      );
    });
  });
});
