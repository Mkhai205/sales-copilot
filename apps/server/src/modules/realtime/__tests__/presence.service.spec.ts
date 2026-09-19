import { assertDefined } from '../../../../test/test-assertions';
import {
  DomainEvent,
  PresenceEntry,
  PresenceStatus,
  PresenceUpdatedEvent,
} from '@sales-copilot/shared-contracts';
import { PresenceService } from '../presence.service';

describe('PresenceService (Agent Realtime Presence & Redis Store — Task 13)', () => {
  let presenceService: PresenceService;
  let mockRedis: any;
  let mockEventEmitter: any;
  let emittedDomainEvents: Array<{ event: string; payload: unknown }>;

  const workspaceId1 = '11111111-1111-1111-1111-111111111111';
  const workspaceId2 = '22222222-2222-2222-2222-222222222222';
  const userId1 = 'usr_agent_001';
  const userId2 = 'usr_agent_002';

  // In-memory redis mock state
  let redisHashes: Record<string, Record<string, string>>;
  let redisKeys: Record<string, { value: string; ttl: number; setAt: number }>;

  beforeEach(() => {
    emittedDomainEvents = [];
    redisHashes = {};
    redisKeys = {};

    mockEventEmitter = {
      emit: (event: string, payload: unknown) => {
        emittedDomainEvents.push({ event, payload });
      },
    };

    mockRedis = {
      hset: async (key: string, field: string, value: string) => {
        if (!redisHashes[key]) redisHashes[key] = {};
        redisHashes[key][field] = value;
        return 1;
      },
      hget: async (key: string, field: string) => {
        return redisHashes[key]?.[field] || null;
      },
      hdel: async (key: string, ...fields: string[]) => {
        if (!redisHashes[key]) return 0;
        let count = 0;
        for (const f of fields) {
          if (f in redisHashes[key]) {
            delete redisHashes[key][f];
            count++;
          }
        }
        return count;
      },
      hgetall: async (key: string) => {
        return redisHashes[key] || {};
      },
      get: async (key: string) => {
        const item = redisKeys[key];
        if (!item) return null;
        if (item.ttl > 0 && Date.now() - item.setAt > item.ttl * 1000) {
          delete redisKeys[key];
          return null;
        }
        return item.value;
      },
      setex: async (key: string, ttlSeconds: number, value: string) => {
        redisKeys[key] = {
          value,
          ttl: ttlSeconds,
          setAt: Date.now(),
        };
      },
      del: async (keyOrKeys: string | string[]) => {
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        let count = 0;
        for (const k of keys) {
          if (k in redisKeys) {
            delete redisKeys[k];
            count++;
          }
        }
        return count;
      },
      ttl: async (key: string) => {
        const item = redisKeys[key];
        if (!item) return -2;
        const elapsedSec = Math.floor((Date.now() - item.setAt) / 1000);
        const remaining = item.ttl - elapsedSec;
        return remaining > 0 ? remaining : -2;
      },
      scan: async (pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Object.keys(redisHashes).filter(k => k.startsWith(prefix));
      },
    };

    presenceService = new PresenceService(mockRedis, mockEventEmitter);
  });

  describe('1. Online/Offline Lifecycle & Transitions', () => {
    it('should store ONLINE presence entry in Redis Hash and set 90s TTL user key', async () => {
      const entry = await presenceService.setOnline(workspaceId1, userId1);

      expect(entry.userId).toBe(userId1);
      expect(entry.status).toBe(PresenceStatus.ONLINE);
      assertDefined(entry.lastSeenAt);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      assertDefined(rawHash);
      const parsedHash = JSON.parse(rawHash);
      expect(parsedHash.userId).toBe(userId1);
      expect(parsedHash.status).toBe(PresenceStatus.ONLINE);

      // Verify Redis user key with TTL
      const userKey = `presence:user:${userId1}:${workspaceId1}`;
      const userVal = await mockRedis.get(userKey);
      expect(userVal).toBe(PresenceStatus.ONLINE);
      const ttl = await mockRedis.ttl(userKey);
      expect(ttl > 80 && ttl <= 90).toBeTruthy();

      // Verify domain event emitted
      expect(emittedDomainEvents.length).toBe(1);
      expect(emittedDomainEvents[0].event).toBe(DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      expect(eventPayload.workspaceId).toBe(workspaceId1);
      expect(eventPayload.userId).toBe(userId1);
      expect(eventPayload.status).toBe(PresenceStatus.ONLINE);
    });

    it('should update presence entry to OFFLINE and remove TTL user key', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      emittedDomainEvents = [];

      const entry = await presenceService.setOffline(workspaceId1, userId1);

      expect(entry.userId).toBe(userId1);
      expect(entry.status).toBe(PresenceStatus.OFFLINE);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      const parsed = JSON.parse(rawHash);
      expect(parsed.status).toBe(PresenceStatus.OFFLINE);

      // Verify user TTL key deleted
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      expect(userVal).toBe(null);

      // Verify domain event emitted
      expect(emittedDomainEvents.length).toBe(1);
      expect(emittedDomainEvents[0].event).toBe(DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      expect(eventPayload.status).toBe(PresenceStatus.OFFLINE);
    });

    it('should set status to AWAY and set TTL key to AWAY', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      emittedDomainEvents = [];

      const entry = await presenceService.setAway(workspaceId1, userId1);

      expect(entry.userId).toBe(userId1);
      expect(entry.status).toBe(PresenceStatus.AWAY);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      const parsed = JSON.parse(rawHash);
      expect(parsed.status).toBe(PresenceStatus.AWAY);

      // Verify user TTL key
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      expect(userVal).toBe(PresenceStatus.AWAY);

      // Verify domain event emitted
      expect(emittedDomainEvents.length).toBe(1);
      expect(emittedDomainEvents[0].event).toBe(DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      expect(eventPayload.status).toBe(PresenceStatus.AWAY);
    });
  });

  describe('2. Heartbeat Renewal', () => {
    it('should refresh user TTL key to 90s and update lastSeenAt in hash', async () => {
      await presenceService.setOnline(workspaceId1, userId1);

      const heartbeatEntry = await presenceService.heartbeat(workspaceId1, userId1);

      expect(heartbeatEntry.userId).toBe(userId1);
      expect(heartbeatEntry.status).toBe(PresenceStatus.ONLINE);

      // Verify TTL refreshed
      const ttl = await mockRedis.ttl(`presence:user:${userId1}:${workspaceId1}`);
      expect(ttl > 80 && ttl <= 90).toBeTruthy();
    });

    it('should maintain AWAY status on heartbeat if user was set to AWAY', async () => {
      await presenceService.setAway(workspaceId1, userId1);

      const entry = await presenceService.heartbeat(workspaceId1, userId1);

      expect(entry.status).toBe(PresenceStatus.AWAY);
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      expect(userVal).toBe(PresenceStatus.AWAY);
    });
  });

  describe('3. Presence Queries & Tenant Isolation', () => {
    it('should enforce tenant isolation (presence in workspace 1 does not appear in workspace 2)', async () => {
      await presenceService.setOnline(workspaceId1, userId1);

      const ws1Presence = await presenceService.getWorkspacePresence(workspaceId1);
      const ws2Presence = await presenceService.getWorkspacePresence(workspaceId2);

      expect(ws1Presence.length).toBe(1);
      expect(ws1Presence[0].userId).toBe(userId1);
      expect(ws2Presence.length).toBe(0);

      const userInWs2 = await presenceService.getUserPresence(workspaceId2, userId1);
      expect(userInWs2).toBe(null);
    });

    it('should return null when user has no presence record in target workspace', async () => {
      const result = await presenceService.getUserPresence(workspaceId1, 'non_existent_user');
      expect(result).toBe(null);
    });

    it('should return active presence entry for online user', async () => {
      await presenceService.setOnline(workspaceId1, userId1);

      const result = await presenceService.getUserPresence(workspaceId1, userId1);
      assertDefined(result);
      expect(result.userId).toBe(userId1);
      expect(result.status).toBe(PresenceStatus.ONLINE);
    });

    it('should return OFFLINE if user TTL key has expired even if hash status was ONLINE', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      // Manually delete/expire TTL key
      await mockRedis.del(`presence:user:${userId1}:${workspaceId1}`);

      const result = await presenceService.getUserPresence(workspaceId1, userId1);
      assertDefined(result);
      expect(result.status).toBe(PresenceStatus.OFFLINE);
    });

    it('should return only online and away users by default, excluding offline users', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setAway(workspaceId1, userId2);
      await presenceService.setOffline(workspaceId1, 'usr_agent_003');

      const onlineOnly = await presenceService.getWorkspacePresence(workspaceId1, false);
      expect(onlineOnly.length).toBe(2);
      const userIds = onlineOnly.map(u => u.userId);
      expect(userIds.includes(userId1)).toBeTruthy();
      expect(userIds.includes(userId2)).toBeTruthy();
      expect(userIds.includes('usr_agent_003')).toBe(false);

      const includeOffline = await presenceService.getWorkspacePresence(workspaceId1, true);
      expect(includeOffline.length).toBe(3);
    });

    it('should gracefully handle malformed JSON entries in redis hash without throwing', async () => {
      await mockRedis.hset(
        `presence:workspace:${workspaceId1}`,
        'corrupted_user',
        '{ invalid-json',
      );

      const list = await presenceService.getWorkspacePresence(workspaceId1);
      expect(list).toEqual([]);

      const single = await presenceService.getUserPresence(workspaceId1, 'corrupted_user');
      expect(single).toBe(null);
    });
  });

  describe('4. Scheduled Stale Presence Cleanup (@Cron)', () => {
    it('should mark agents with expired TTL as OFFLINE across all workspaces during cleanup', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setOnline(workspaceId2, userId2);
      emittedDomainEvents = [];

      // Expire user 1's TTL
      await mockRedis.del(`presence:user:${userId1}:${workspaceId1}`);

      await presenceService.cleanupStalePresence();

      // Verify user 1 marked OFFLINE in hash
      const user1Presence = await presenceService.getUserPresence(workspaceId1, userId1);
      expect(user1Presence?.status).toBe(PresenceStatus.OFFLINE);

      // Verify user 2 remains ONLINE
      const user2Presence = await presenceService.getUserPresence(workspaceId2, userId2);
      expect(user2Presence?.status).toBe(PresenceStatus.ONLINE);

      // Verify domain event emitted for user 1
      const offlineEvents = emittedDomainEvents.filter(
        e =>
          (e.payload as any).userId === userId1 &&
          (e.payload as any).status === PresenceStatus.OFFLINE,
      );
      expect(offlineEvents.length).toBe(1);
    });

    it('should mark idle agents (> 5 minutes inactive) as AWAY during cleanup', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      emittedDomainEvents = [];

      // Manually adjust lastSeenAt to 6 minutes ago in hash, but keep TTL active
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      const entry: PresenceEntry = {
        userId: userId1,
        status: PresenceStatus.ONLINE,
        lastSeenAt: sixMinutesAgo,
      };
      await mockRedis.hset(`presence:workspace:${workspaceId1}`, userId1, JSON.stringify(entry));

      await presenceService.cleanupStalePresence();

      // Verify user 1 marked AWAY
      const user1Presence = await presenceService.getUserPresence(workspaceId1, userId1);
      expect(user1Presence?.status).toBe(PresenceStatus.AWAY);

      // Verify domain event emitted
      const awayEvents = emittedDomainEvents.filter(
        e =>
          (e.payload as any).userId === userId1 &&
          (e.payload as any).status === PresenceStatus.AWAY,
      );
      expect(awayEvents.length).toBe(1);
    });

    it('should ignore already OFFLINE entries during cleanup', async () => {
      await presenceService.setOffline(workspaceId1, userId1);
      emittedDomainEvents = [];

      await presenceService.cleanupStalePresence();

      expect(emittedDomainEvents.length).toBe(0);
    });
  });

  describe('5. Agent Connection & Disconnection Event Listeners', () => {
    it('should automatically set agent ONLINE in all available workspaces upon agent.connected event', async () => {
      await presenceService.handleAgentConnected({
        userId: userId1,
        availableWorkspaceIds: [workspaceId1, workspaceId2],
      });

      const ws1 = await presenceService.getUserPresence(workspaceId1, userId1);
      const ws2 = await presenceService.getUserPresence(workspaceId2, userId1);

      expect(ws1?.status).toBe(PresenceStatus.ONLINE);
      expect(ws2?.status).toBe(PresenceStatus.ONLINE);
    });

    it('should automatically set agent OFFLINE in all joined workspaces upon agent.disconnected event', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setOnline(workspaceId2, userId1);

      await presenceService.handleAgentDisconnected({
        userId: userId1,
        joinedWorkspaceIds: [workspaceId1, workspaceId2],
      });

      const ws1 = await presenceService.getUserPresence(workspaceId1, userId1);
      const ws2 = await presenceService.getUserPresence(workspaceId2, userId1);

      expect(ws1?.status).toBe(PresenceStatus.OFFLINE);
      expect(ws2?.status).toBe(PresenceStatus.OFFLINE);
    });
  });

  describe('6. Defensive Error Handling', () => {
    it('should not throw if Redis operations encounter errors', async () => {
      mockRedis.hset = async () => {
        throw new Error('Redis connection failure');
      };
      mockRedis.scan = async () => {
        throw new Error('Redis connection failure');
      };

      await await expect(async () => {
        await presenceService.setOnline(workspaceId1, userId1);
      }).resolves.not.toThrow();

      await await expect(async () => {
        await presenceService.setOffline(workspaceId1, userId1);
      }).resolves.not.toThrow();

      await await expect(async () => {
        await presenceService.setAway(workspaceId1, userId1);
      }).resolves.not.toThrow();

      await await expect(async () => {
        await presenceService.heartbeat(workspaceId1, userId1);
      }).resolves.not.toThrow();

      await await expect(async () => {
        await presenceService.cleanupStalePresence();
      }).resolves.not.toThrow();
    });
  });
});
