import { CommercePresenceService } from '../commerce-presence.service';

describe('CommercePresenceService (Redis 30s Sliding Collision Lock)', () => {
  let service: CommercePresenceService;
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

    service = new CommercePresenceService(mockRedisService);
  });

  it('should successfully acquire editing lock for conversation', async () => {
    const result = await service.startEditing(ws1, conv1, agent1);

    expect(result.success).toBe(true);
    expect(result.isLocked).toBe(false);
    expect(result.lockedBy).toBe(null);
    expect(result.remainingTtlSeconds).toBe(30);

    const status = await service.getEditingStatus(ws1, conv1);
    expect(status.isLocked).toBe(true);
    expect(status.lockedBy?.userId).toBe(agent1.userId);
  });

  it('should block collision when second agent attempts to acquire lock', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const collision = await service.startEditing(ws1, conv1, agent2);
    expect(collision.success).toBe(false);
    expect(collision.isLocked).toBe(true);
    expect(collision.lockedBy?.userId).toBe(agent1.userId);
    expect(collision.remainingTtlSeconds).toBe(30);
  });

  it('should allow same agent to re-acquire and refresh lock idempotently', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const reacquire = await service.startEditing(ws1, conv1, agent1);
    expect(reacquire.success).toBe(true);
    expect(reacquire.isLocked).toBe(false);
  });

  it('should refresh heartbeat for lock holder and reject non-holder', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const hbSuccess = await service.refreshHeartbeat(ws1, conv1, agent1.userId);
    expect(hbSuccess.success).toBe(true);
    expect(hbSuccess.remainingTtlSeconds).toBe(30);

    const hbFail = await service.refreshHeartbeat(ws1, conv1, agent2.userId);
    expect(hbFail.success).toBe(false);
  });

  it('should release lock when current agent stops editing', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const released = await service.stopEditing(ws1, conv1, agent1.userId);
    expect(released).toBe(true);

    const status = await service.getEditingStatus(ws1, conv1);
    expect(status.isLocked).toBe(false);
    expect(status.lockedBy).toBe(null);
  });

  it('should allow takeover by second agent', async () => {
    await service.startEditing(ws1, conv1, agent1);

    const takeover = await service.takeoverEditing(ws1, conv1, agent2);
    expect(takeover.success).toBe(true);
    expect(takeover.previousLockedBy?.userId).toBe(agent1.userId);

    const status = await service.getEditingStatus(ws1, conv1);
    expect(status.isLocked).toBe(true);
    expect(status.lockedBy?.userId).toBe(agent2.userId);
  });

  it('should cleanup user locks on disconnect', async () => {
    await service.startEditing(ws1, 'conv-1', agent1);
    await service.startEditing(ws1, 'conv-2', agent1);
    await service.startEditing(ws1, 'conv-3', agent2);

    await service.cleanupUserLocks(agent1.userId);

    const status1 = await service.getEditingStatus(ws1, 'conv-1');
    const status2 = await service.getEditingStatus(ws1, 'conv-2');
    const status3 = await service.getEditingStatus(ws1, 'conv-3');

    expect(status1.isLocked).toBe(false);
    expect(status2.isLocked).toBe(false);
    expect(status3.isLocked).toBe(true);
  });
});
