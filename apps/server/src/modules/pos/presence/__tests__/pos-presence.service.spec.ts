import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { PosPresenceService } from '../pos-presence.service';

describe('PosPresenceService (Redis 30s Sliding Collision Lock)', () => {
  let service: PosPresenceService;
  let redisStorage: Map<string, { value: string; ttl: number }>;
  let mockRedisService: any;

  const ws1 = 'ws-test-1';
  const conv1 = 'conv-test-1';
  const agent1 = {
    userId: 'usr-agent-1',
    userName: 'Agent One',
    userEmail: 'agent1@example.com',
  };
  const agent2 = {
    userId: 'usr-agent-2',
    userName: 'Agent Two',
    userEmail: 'agent2@example.com',
  };

  beforeEach(() => {
    redisStorage = new Map();

    mockRedisService = {
      get: async (key: string) => {
        const item = redisStorage.get(key);
        return item ? item.value : null;
      },
      set: async (key: string, value: string, ttlSeconds?: number) => {
        redisStorage.set(key, { value, ttl: ttlSeconds || 30 });
      },
      del: async (key: string) => {
        const existed = redisStorage.delete(key);
        return existed ? 1 : 0;
      },
      ttl: async (key: string) => {
        const item = redisStorage.get(key);
        return item ? item.ttl : -2;
      },
      scan: async (pattern: string) => {
        const prefix = pattern.replace('*', '');
        return Array.from(redisStorage.keys()).filter(k => k.startsWith(prefix));
      },
    };

    service = new PosPresenceService(mockRedisService);
  });

  it('should successfully acquire editing lock for conversation', async () => {
    const result = await service.startEditing(ws1, conv1, agent1);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.isLocked, false);
    assert.strictEqual(result.lockedBy, null);
    assert.strictEqual(result.remainingTtlSeconds, 30);

    const status = await service.getEditingStatus(ws1, conv1);
    assert.strictEqual(status.isLocked, true);
    assert.strictEqual(status.lockedBy?.userId, agent1.userId);
  });

  it('should block collision when second agent attempts to acquire lock', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const collision = await service.startEditing(ws1, conv1, agent2);
    assert.strictEqual(collision.success, false);
    assert.strictEqual(collision.isLocked, true);
    assert.strictEqual(collision.lockedBy?.userId, agent1.userId);
    assert.strictEqual(collision.remainingTtlSeconds, 30);
  });

  it('should allow same agent to re-acquire and refresh lock idempotently', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const reacquire = await service.startEditing(ws1, conv1, agent1);
    assert.strictEqual(reacquire.success, true);
    assert.strictEqual(reacquire.isLocked, false);
  });

  it('should refresh heartbeat for lock holder and reject non-holder', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const hbSuccess = await service.refreshHeartbeat(ws1, conv1, agent1.userId);
    assert.strictEqual(hbSuccess.success, true);
    assert.strictEqual(hbSuccess.remainingTtlSeconds, 30);

    const hbFail = await service.refreshHeartbeat(ws1, conv1, agent2.userId);
    assert.strictEqual(hbFail.success, false);
  });

  it('should release lock when current agent stops editing', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const released = await service.stopEditing(ws1, conv1, agent1.userId);
    assert.strictEqual(released, true);

    const status = await service.getEditingStatus(ws1, conv1);
    assert.strictEqual(status.isLocked, false);
    assert.strictEqual(status.lockedBy, null);
  });

  it('should allow takeover by second agent', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const takeover = await service.takeoverEditing(ws1, conv1, agent2);
    assert.strictEqual(takeover.success, true);
    assert.strictEqual(takeover.previousLockedBy?.userId, agent1.userId);

    const status = await service.getEditingStatus(ws1, conv1);
    assert.strictEqual(status.isLocked, true);
    assert.strictEqual(status.lockedBy?.userId, agent2.userId);
  });

  it('should cleanup user locks on disconnect', async () => {
    await service.startEditing(ws1, 'conv-1', agent1);
    await service.startEditing(ws1, 'conv-2', agent1);
    await service.startEditing(ws1, 'conv-3', agent2);

    await service.cleanupUserLocks(agent1.userId);

    const status1 = await service.getEditingStatus(ws1, 'conv-1');
    const status2 = await service.getEditingStatus(ws1, 'conv-2');
    const status3 = await service.getEditingStatus(ws1, 'conv-3');

    assert.strictEqual(status1.isLocked, false);
    assert.strictEqual(status2.isLocked, false);
    assert.strictEqual(status3.isLocked, true);
  });
});
