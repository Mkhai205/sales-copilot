import { expectReject } from '../../../../../test/test-assertions';
import {
  PlatformAuditAction,
  PlatformAuditTargetType,
  SystemSettingCategory,
} from '@sales-copilot/shared-contracts';
import { SystemSettingsService, DEFAULT_SYSTEM_SETTINGS } from '../system-settings.service';

describe('SystemSettingsService (Dynamic System Settings & 2-Tier Caching Engine)', () => {
  let service: SystemSettingsService;
  let mockPrisma: any;
  let mockRedis: any;

  let dbSettings: Map<string, any>;
  let dbAuditLogs: any[];
  let redisStore: Map<string, string>;
  let redisCalls: { get: string[]; set: string[]; del: string[] };
  let dbCalls: { findUnique: string[]; findMany: number };

  beforeEach(() => {
    dbSettings = new Map();
    dbAuditLogs = [];
    redisStore = new Map();
    redisCalls = { get: [], set: [], del: [] };
    dbCalls = { findUnique: [], findMany: 0 };

    mockRedis = {
      get: async (key: string) => {
        redisCalls.get.push(key);
        return redisStore.has(key) ? redisStore.get(key)! : null;
      },
      set: async (key: string, value: string, _ttlSeconds?: number) => {
        redisCalls.set.push(key);
        redisStore.set(key, value);
      },
      del: async (keyOrKeys: string | string[]) => {
        const keys = Array.isArray(keyOrKeys) ? keyOrKeys : [keyOrKeys];
        for (const k of keys) {
          redisCalls.del.push(k);
          redisStore.delete(k);
        }
        return keys.length;
      },
    };

    const prismaClientMock = {
      systemSetting: {
        createMany: async ({ data, skipDuplicates }: any) => {
          for (const item of data) {
            if (!dbSettings.has(item.key) || !skipDuplicates) {
              dbSettings.set(item.key, {
                ...item,
                isEncrypted: false,
                updatedBy: null,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }
          return { count: data.length };
        },
        findUnique: async ({ where }: any) => {
          dbCalls.findUnique.push(where.key);
          const found = dbSettings.get(where.key);
          return found ? { ...found } : null;
        },
        findMany: async () => {
          dbCalls.findMany++;
          return Array.from(dbSettings.values());
        },
        upsert: async ({ where, create, update }: any) => {
          const existing = dbSettings.get(where.key);
          if (existing) {
            const updated = {
              ...existing,
              ...update,
              updatedAt: new Date(),
            };
            dbSettings.set(where.key, updated);
            return { ...updated };
          } else {
            const created = {
              ...create,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            dbSettings.set(where.key, created);
            return { ...created };
          }
        },
      },
      platformAuditLog: {
        create: async ({ data }: any) => {
          const record = {
            id: `audit_${Date.now()}_${Math.random()}`,
            ...data,
            createdAt: new Date(),
          };
          dbAuditLogs.push(record);
          return record;
        },
      },
    };

    mockPrisma = {
      client: prismaClientMock,
      runInTransaction: async (operation: any) => {
        const postCommitHooks: Array<() => Promise<void> | void> = [];
        const rollbackHooks: Array<(err: unknown) => Promise<void> | void> = [];

        const ctx = {
          tx: prismaClientMock,
          addPostCommitHook: (hook: any) => postCommitHooks.push(hook),
          addRollbackHook: (hook: any) => rollbackHooks.push(hook),
        };

        try {
          const result = await operation(ctx);
          for (const hook of postCommitHooks) {
            await hook();
          }
          return result;
        } catch (error) {
          for (const hook of rollbackHooks) {
            await hook(error);
          }
          throw error;
        }
      },
    };

    service = new SystemSettingsService(mockPrisma, mockRedis);
  });

  it('1. L1 Cache Hit: reads from process RAM without querying Redis or DB', async () => {
    // Seed DB and fetch once to populate L1 cache
    dbSettings.set('feature.pos_vietqr_enabled', {
      key: 'feature.pos_vietqr_enabled',
      value: true,
      category: 'FEATURE_FLAGS',
    });

    const first = await service.getSetting('feature.pos_vietqr_enabled');
    expect(first).toBe(true);
    expect(dbCalls.findUnique.length).toBe(1);
    expect(redisCalls.get.length).toBe(1);

    // Reset call counters
    dbCalls.findUnique = [];
    redisCalls.get = [];

    // Second read: must be L1 hit!
    const second = await service.getSetting('feature.pos_vietqr_enabled');
    expect(second).toBe(true);
    expect(dbCalls.findUnique.length).toBe(0);
    expect(redisCalls.get.length).toBe(0);
  });

  it('2. L2 Cache Hit: L1 miss, Redis hit -> returns from Redis and populates L1 RAM', async () => {
    // Populate Redis
    redisStore.set('system:settings:llm.default_provider', JSON.stringify('OPENAI'));

    // Clear L1 memory
    service.clearMemoryCache();

    const val = await service.getSetting('llm.default_provider');
    expect(val).toBe('OPENAI');
    expect(redisCalls.get.length).toBe(1);
    expect(dbCalls.findUnique.length).toBe(0);

    // Subsequent read must now hit L1 RAM
    redisCalls.get = [];
    const val2 = await service.getSetting('llm.default_provider');
    expect(val2).toBe('OPENAI');
    expect(redisCalls.get.length).toBe(0);
  });

  it('3. L3 Database Query: L1 & L2 miss -> queries DB, populates L2 Redis and L1 RAM', async () => {
    dbSettings.set('quotas.free.max_agents', {
      key: 'quotas.free.max_agents',
      value: 5,
      category: 'BILLING',
    });

    service.clearMemoryCache();

    const val = await service.getSetting('quotas.free.max_agents');
    expect(val).toBe(5);
    expect(dbCalls.findUnique.length).toBe(1);
    expect(redisCalls.set.length).toBe(1);
    expect(redisStore.get('system:settings:quotas.free.max_agents')).toBe(JSON.stringify(5));

    // Subsequent read hits L1
    dbCalls.findUnique = [];
    redisCalls.get = [];
    const val2 = await service.getSetting('quotas.free.max_agents');
    expect(val2).toBe(5);
    expect(dbCalls.findUnique.length).toBe(0);
    expect(redisCalls.get.length).toBe(0);
  });

  it('4. Default Value Fallback: returns default value when key does not exist in any tier', async () => {
    const val = await service.getSetting('unknown.key', 'fallback-val');
    expect(val).toBe('fallback-val');
    expect(dbCalls.findUnique.length).toBe(1);
  });

  it('5. Redis Degradation Resilience: soft catch on Redis error, falls back to DB safely', async () => {
    mockRedis.get = async () => {
      throw new Error('ECONNREFUSED');
    };
    mockRedis.set = async () => {
      throw new Error('ECONNREFUSED');
    };

    dbSettings.set('feature.comment_masking_enabled', {
      key: 'feature.comment_masking_enabled',
      value: false,
      category: 'FEATURE_FLAGS',
    });

    service.clearMemoryCache();

    // Should not throw!
    const val = await service.getSetting('feature.comment_masking_enabled', true);
    expect(val).toBe(false);
    expect(dbCalls.findUnique.length).toBe(1);
  });

  it('6. Atomic Transaction & Audit Logging: updateSetting records oldValue, newValue into platform_audit_logs', async () => {
    dbSettings.set('feature.ai_autopilot_enabled', {
      key: 'feature.ai_autopilot_enabled',
      value: true,
      category: 'FEATURE_FLAGS',
      description: 'Auto-pilot',
    });

    const result = await service.updateSetting(
      'feature.ai_autopilot_enabled',
      { value: false, description: 'Updated auto-pilot' },
      {
        userId: 'admin_123',
        email: 'superadmin@salescopilot.io',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
    );

    expect(result.key).toBe('feature.ai_autopilot_enabled');
    expect(result.value).toBe(false);
    expect(result.description).toBe('Updated auto-pilot');

    // Check DB updated
    const inDb = dbSettings.get('feature.ai_autopilot_enabled');
    expect(inDb.value).toBe(false);

    // Check Audit Log created
    expect(dbAuditLogs.length).toBe(1);
    const log = dbAuditLogs[0];
    expect(log.actorId).toBe('admin_123');
    expect(log.actorEmail).toBe('superadmin@salescopilot.io');
    expect(log.action).toBe(PlatformAuditAction.SYSTEM_SETTING_UPDATED);
    expect(log.targetType).toBe(PlatformAuditTargetType.SYSTEM_SETTING);
    expect(log.targetId).toBe('feature.ai_autopilot_enabled');
    expect(log.metadata).toEqual({
      key: 'feature.ai_autopilot_enabled',
      oldValue: true,
      newValue: false,
    });
    expect(log.ipAddress).toBe('127.0.0.1');
    expect(log.userAgent).toBe('Mozilla/5.0');
  });

  it('7. Cache Invalidation Post-Commit: synchronizes key in L1/L2 and invalidates system:settings:all', async () => {
    // Populate caches
    redisStore.set('system:settings:all', JSON.stringify([]));

    await service.updateSetting(
      'system.maintenance_mode',
      { value: true },
      {
        userId: 'admin_123',
        email: 'superadmin@salescopilot.io',
      },
    );

    // Redis key for specific setting must be updated
    expect(redisStore.get('system:settings:system.maintenance_mode')).toBe(JSON.stringify(true));

    // Redis key for 'all' must be deleted
    expect(redisStore.has('system:settings:all')).toBe(false);
    expect(redisCalls.del.includes('system:settings:all')).toBeTruthy();

    // L1 cache for the key must return true immediately
    const l1Val = await service.getSetting('system.maintenance_mode');
    expect(l1Val).toBe(true);
  });

  it('8. Transaction Rollback Safety: when DB transaction fails, post-commit hooks do not fire', async () => {
    mockPrisma.runInTransaction = async (operation: any) => {
      const postCommitHooks: Array<() => Promise<void> | void> = [];
      const ctx = {
        tx: {
          systemSetting: {
            findUnique: async () => null,
            upsert: async () => {
              throw new Error('DB_DEADLOCK');
            },
          },
          platformAuditLog: {
            create: async () => {},
          },
        },
        addPostCommitHook: (hook: any) => postCommitHooks.push(hook),
      };

      await operation(ctx);
      for (const hook of postCommitHooks) {
        await hook();
      }
    };

    let caughtError: any = null;
    try {
      await service.updateSetting(
        'system.banner_message',
        { value: 'Explosion' },
        { userId: 'admin_123', email: 'admin@salescopilot.io' },
      );
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeTruthy();
    expect(caughtError.message).toBe('DB_DEADLOCK');
    expect(redisStore.has('system:settings:system.banner_message')).toBe(false);
  });

  it('9. Single-Query Bootstrap: onModuleInit calls createMany with skipDuplicates: true', async () => {
    let calledWith: any = null;
    mockPrisma.client.systemSetting.createMany = async (args: any) => {
      calledWith = args;
      return { count: args.data.length };
    };

    await service.onModuleInit();

    expect(calledWith).toBeTruthy();
    expect(calledWith.skipDuplicates).toBe(true);
    expect(calledWith.data.length).toBe(DEFAULT_SYSTEM_SETTINGS.length);
    expect(calledWith.data.length >= 14).toBeTruthy();
  });

  it('10. Category Inference: correctly maps key prefixes to SystemSettingCategory', () => {
    expect(service.inferCategory('feature.pos_vietqr_enabled')).toBe(
      SystemSettingCategory.FEATURE_FLAGS,
    );
    expect(service.inferCategory('llm.default_provider')).toBe(SystemSettingCategory.AI);
    expect(service.inferCategory('ai.temperature')).toBe(SystemSettingCategory.AI);
    expect(service.inferCategory('quotas.free.max_agents')).toBe(SystemSettingCategory.BILLING);
    expect(service.inferCategory('billing.currency')).toBe(SystemSettingCategory.BILLING);
    expect(service.inferCategory('system.maintenance_mode')).toBe(SystemSettingCategory.SYSTEM);
    expect(service.inferCategory('custom.unknown_setting')).toBe(SystemSettingCategory.GENERAL);
  });

  it('11. getAllSettings: retrieves from cache or DB and supports category filtering', async () => {
    dbSettings.set('feature.one', {
      key: 'feature.one',
      value: 1,
      category: SystemSettingCategory.FEATURE_FLAGS,
      isEncrypted: false,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    dbSettings.set('ai.one', {
      key: 'ai.one',
      value: 'model',
      category: SystemSettingCategory.AI,
      isEncrypted: false,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 1st call: queries DB
    const all = await service.getAllSettings();
    expect(all.length).toBe(2);
    expect(dbCalls.findMany).toBe(1);

    // 2nd call: L1 cache hit, filter by category
    const aiOnly = await service.getAllSettings(SystemSettingCategory.AI);
    expect(aiOnly.length).toBe(1);
    expect(aiOnly[0].key).toBe('ai.one');
    expect(dbCalls.findMany).toBe(1);
  });

  it('12. Key Validation: throws BadRequestException when key is empty, blank, or non-string', async () => {
    await expectReject(
      async () => {
        await service.updateSetting(
          '   ',
          { value: true },
          { userId: 'u1', email: 'admin@salescopilot.io' },
        );
      },
      (err: any) => err.status === 400 && err.response?.code === 'INVALID_SETTING_KEY',
    );
  });

  it('13. Preserve existing value when updating description only: does not corrupt L1/L2 cache and logs accurately', async () => {
    dbSettings.set('system.banner_message', {
      key: 'system.banner_message',
      value: 'Original message',
      category: SystemSettingCategory.SYSTEM,
      description: 'Old desc',
    });

    const result = await service.updateSetting(
      'system.banner_message',
      { description: 'New desc' }, // value is undefined
      { userId: 'u1', email: 'admin@salescopilot.io' },
    );

    expect(result.value).toBe('Original message');
    expect(result.description).toBe('New desc');

    // Verify L1 Memory Cache has the original value (not undefined!)
    const l1Val = await service.getSetting('system.banner_message');
    expect(l1Val).toBe('Original message');

    // Verify L2 Redis Cache has the original value (not undefined!)
    expect(redisStore.get('system:settings:system.banner_message')).toBe(
      JSON.stringify('Original message'),
    );

    // Verify Audit Log records original value as newValue
    expect(dbAuditLogs.length).toBe(1);
    expect(dbAuditLogs[0].metadata.oldValue).toBe('Original message');
    expect(dbAuditLogs[0].metadata.newValue).toBe('Original message');
  });

  it('14. Require value for nonexistent key: throws BadRequestException when creating new setting without value', async () => {
    await expectReject(
      async () => {
        await service.updateSetting(
          'brand.new.setting',
          { description: 'Some desc' }, // value is undefined and key does not exist
          { userId: 'u1', email: 'admin@salescopilot.io' },
        );
      },
      (err: any) => err.status === 400 && err.response?.code === 'SETTING_VALUE_REQUIRED',
    );
  });

  it('15. Concurrent writes to the same key: processes simultaneous updates and records all audit logs', async () => {
    dbSettings.set('feature.pos_vietqr_enabled', {
      key: 'feature.pos_vietqr_enabled',
      value: true,
      category: SystemSettingCategory.FEATURE_FLAGS,
    });

    // Fire 2 concurrent updates
    const [res1, res2] = await Promise.all([
      service.updateSetting(
        'feature.pos_vietqr_enabled',
        { value: false },
        { userId: 'admin_1', email: 'admin1@salescopilot.io' },
      ),
      service.updateSetting(
        'feature.pos_vietqr_enabled',
        { value: true },
        { userId: 'admin_2', email: 'admin2@salescopilot.io' },
      ),
    ]);

    expect(res1).toBeTruthy();
    expect(res2).toBeTruthy();
    // Both audit logs must be recorded
    expect(dbAuditLogs.length).toBe(2);
    // Redis cache key exists and is non-empty
    expect(redisStore.has('system:settings:feature.pos_vietqr_enabled')).toBeTruthy();
  });
});
