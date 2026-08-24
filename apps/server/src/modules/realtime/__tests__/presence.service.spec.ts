import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  DomainEvent,
  PresenceEntry,
  PresenceStatus,
  PresenceUpdatedEvent,
} from '@sales-copilot/shared-contracts';
import { PresenceService } from '../presence.service';

describe('PresenceService (Agent Realtime Presence & Redis Store — Task 8)', () => {
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

  describe('setOnline', () => {
    it('should store ONLINE presence entry in Redis Hash and set 90s TTL user key', async () => {
      const entry = await presenceService.setOnline(workspaceId1, userId1);

      assert.strictEqual(entry.userId, userId1);
      assert.strictEqual(entry.status, PresenceStatus.ONLINE);
      assert.ok(entry.lastSeenAt);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      assert.ok(rawHash);
      const parsedHash = JSON.parse(rawHash);
      assert.strictEqual(parsedHash.userId, userId1);
      assert.strictEqual(parsedHash.status, PresenceStatus.ONLINE);

      // Verify Redis user key with TTL
      const userKey = `presence:user:${userId1}:${workspaceId1}`;
      const userVal = await mockRedis.get(userKey);
      assert.strictEqual(userVal, PresenceStatus.ONLINE);
      const ttl = await mockRedis.ttl(userKey);
      assert.ok(ttl > 80 && ttl <= 90);

      // Verify domain event emitted
      assert.strictEqual(emittedDomainEvents.length, 1);
      assert.strictEqual(emittedDomainEvents[0].event, DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      assert.strictEqual(eventPayload.workspaceId, workspaceId1);
      assert.strictEqual(eventPayload.userId, userId1);
      assert.strictEqual(eventPayload.status, PresenceStatus.ONLINE);
    });
  });

  describe('setOffline', () => {
    it('should update presence entry to OFFLINE and remove TTL user key', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      emittedDomainEvents = [];

      const entry = await presenceService.setOffline(workspaceId1, userId1);

      assert.strictEqual(entry.userId, userId1);
      assert.strictEqual(entry.status, PresenceStatus.OFFLINE);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      const parsed = JSON.parse(rawHash);
      assert.strictEqual(parsed.status, PresenceStatus.OFFLINE);

      // Verify user TTL key deleted
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      assert.strictEqual(userVal, null);

      // Verify domain event emitted
      assert.strictEqual(emittedDomainEvents.length, 1);
      assert.strictEqual(emittedDomainEvents[0].event, DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      assert.strictEqual(eventPayload.status, PresenceStatus.OFFLINE);
    });
  });

  describe('setAway', () => {
    it('should set status to AWAY and set TTL key to AWAY', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      emittedDomainEvents = [];

      const entry = await presenceService.setAway(workspaceId1, userId1);

      assert.strictEqual(entry.userId, userId1);
      assert.strictEqual(entry.status, PresenceStatus.AWAY);

      // Verify Redis Hash
      const rawHash = await mockRedis.hget(`presence:workspace:${workspaceId1}`, userId1);
      const parsed = JSON.parse(rawHash);
      assert.strictEqual(parsed.status, PresenceStatus.AWAY);

      // Verify user TTL key
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      assert.strictEqual(userVal, PresenceStatus.AWAY);

      // Verify domain event emitted
      assert.strictEqual(emittedDomainEvents.length, 1);
      assert.strictEqual(emittedDomainEvents[0].event, DomainEvent.PRESENCE_UPDATED);
      const eventPayload = emittedDomainEvents[0].payload as PresenceUpdatedEvent;
      assert.strictEqual(eventPayload.status, PresenceStatus.AWAY);
    });
  });

  describe('heartbeat', () => {
    it('should refresh user TTL key to 90s and update lastSeenAt in hash', async () => {
      const initialEntry = await presenceService.setOnline(workspaceId1, userId1);

      // Advance time slightly
      const heartbeatEntry = await presenceService.heartbeat(workspaceId1, userId1);

      assert.strictEqual(heartbeatEntry.userId, userId1);
      assert.strictEqual(heartbeatEntry.status, PresenceStatus.ONLINE);

      // Verify TTL refreshed
      const ttl = await mockRedis.ttl(`presence:user:${userId1}:${workspaceId1}`);
      assert.ok(ttl > 80 && ttl <= 90);
    });

    it('should maintain AWAY status on heartbeat if user was set to AWAY', async () => {
      await presenceService.setAway(workspaceId1, userId1);

      const entry = await presenceService.heartbeat(workspaceId1, userId1);

      assert.strictEqual(entry.status, PresenceStatus.AWAY);
      const userVal = await mockRedis.get(`presence:user:${userId1}:${workspaceId1}`);
      assert.strictEqual(userVal, PresenceStatus.AWAY);
    });
  });

  describe('getUserPresence', () => {
    it('should return null when user has no presence record', async () => {
      const result = await presenceService.getUserPresence(workspaceId1, 'non_existent_user');
      assert.strictEqual(result, null);
    });

    it('should return active presence entry for online user', async () => {
      await presenceService.setOnline(workspaceId1, userId1);

      const result = await presenceService.getUserPresence(workspaceId1, userId1);
      assert.ok(result);
      assert.strictEqual(result.userId, userId1);
      assert.strictEqual(result.status, PresenceStatus.ONLINE);
    });

    it('should return OFFLINE if user TTL key has expired even if hash status was ONLINE', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      // Manually delete/expire TTL key
      await mockRedis.del(`presence:user:${userId1}:${workspaceId1}`);

      const result = await presenceService.getUserPresence(workspaceId1, userId1);
      assert.ok(result);
      assert.strictEqual(result.status, PresenceStatus.OFFLINE);
    });
  });

  describe('getWorkspacePresence', () => {
    it('should return empty list when workspace has no presence data', async () => {
      const result = await presenceService.getWorkspacePresence(workspaceId1);
      assert.deepStrictEqual(result, []);
    });

    it('should return only online and away users by default, excluding offline users', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setAway(workspaceId1, userId2);
      await presenceService.setOffline(workspaceId1, 'usr_agent_003');

      const onlineOnly = await presenceService.getWorkspacePresence(workspaceId1, false);
      assert.strictEqual(onlineOnly.length, 2);
      const userIds = onlineOnly.map(u => u.userId);
      assert.ok(userIds.includes(userId1));
      assert.ok(userIds.includes(userId2));
      assert.strictEqual(userIds.includes('usr_agent_003'), false);

      const includeOffline = await presenceService.getWorkspacePresence(workspaceId1, true);
      assert.strictEqual(includeOffline.length, 3);
    });

    it('should treat members with expired TTL keys as OFFLINE and exclude them from active list', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setOnline(workspaceId1, userId2);

      // Expire userId2's key
      await mockRedis.del(`presence:user:${userId2}:${workspaceId1}`);

      const active = await presenceService.getWorkspacePresence(workspaceId1, false);
      assert.strictEqual(active.length, 1);
      assert.strictEqual(active[0].userId, userId1);
    });
  });

  describe('Scheduled Stale Presence Cleanup (@Cron)', () => {
    it('should mark agents with expired TTL as OFFLINE during cleanup', async () => {
      await presenceService.setOnline(workspaceId1, userId1);
      await presenceService.setOnline(workspaceId1, userId2);
      emittedDomainEvents = [];

      // Expire user 1's TTL
      await mockRedis.del(`presence:user:${userId1}:${workspaceId1}`);

      await presenceService.cleanupStalePresence();

      // Verify user 1 marked OFFLINE in hash
      const user1Presence = await presenceService.getUserPresence(workspaceId1, userId1);
      assert.strictEqual(user1Presence?.status, PresenceStatus.OFFLINE);

      // Verify user 2 remains ONLINE
      const user2Presence = await presenceService.getUserPresence(workspaceId1, userId2);
      assert.strictEqual(user2Presence?.status, PresenceStatus.ONLINE);

      // Verify domain event emitted for user 1
      const offlineEvents = emittedDomainEvents.filter(
        e =>
          (e.payload as any).userId === userId1 &&
          (e.payload as any).status === PresenceStatus.OFFLINE,
      );
      assert.strictEqual(offlineEvents.length, 1);
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
      assert.strictEqual(user1Presence?.status, PresenceStatus.AWAY);

      // Verify domain event emitted
      const awayEvents = emittedDomainEvents.filter(
        e =>
          (e.payload as any).userId === userId1 &&
          (e.payload as any).status === PresenceStatus.AWAY,
      );
      assert.strictEqual(awayEvents.length, 1);
    });

    it('should ignore already OFFLINE entries during cleanup', async () => {
      await presenceService.setOffline(workspaceId1, userId1);
      emittedDomainEvents = [];

      await presenceService.cleanupStalePresence();

      assert.strictEqual(emittedDomainEvents.length, 0);
    });
  });

  describe('Agent Connection & Disconnection Event Listeners', () => {
    it('should automatically set agent ONLINE in all available workspaces upon agent.connected event', async () => {
      await presenceService.handleAgentConnected({
        userId: userId1,
        availableWorkspaceIds: [workspaceId1, workspaceId2],
      });

      const ws1 = await presenceService.getUserPresence(workspaceId1, userId1);
      const ws2 = await presenceService.getUserPresence(workspaceId2, userId1);

      assert.strictEqual(ws1?.status, PresenceStatus.ONLINE);
      assert.strictEqual(ws2?.status, PresenceStatus.ONLINE);
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

      assert.strictEqual(ws1?.status, PresenceStatus.OFFLINE);
      assert.strictEqual(ws2?.status, PresenceStatus.OFFLINE);
    });
  });

  describe('Defensive Error Handling', () => {
    it('should not throw if Redis operations encounter errors', async () => {
      mockRedis.hset = async () => {
        throw new Error('Redis connection failure');
      };
      mockRedis.scan = async () => {
        throw new Error('Redis connection failure');
      };

      await assert.doesNotReject(async () => {
        await presenceService.setOnline(workspaceId1, userId1);
      });

      await assert.doesNotReject(async () => {
        await presenceService.setOffline(workspaceId1, userId1);
      });

      await assert.doesNotReject(async () => {
        await presenceService.setAway(workspaceId1, userId1);
      });

      await assert.doesNotReject(async () => {
        await presenceService.heartbeat(workspaceId1, userId1);
      });

      await assert.doesNotReject(async () => {
        await presenceService.cleanupStalePresence();
      });
    });
  });
});
