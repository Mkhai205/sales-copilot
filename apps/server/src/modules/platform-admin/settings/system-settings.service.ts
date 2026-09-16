import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  PlatformAuditAction,
  PlatformAuditTargetType,
  SystemSettingCategory,
  SystemSettingItemDto,
  UpdateSystemSettingDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { RedisService } from '../../../infrastructure/redis';

export interface ActorContext {
  userId: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export const DEFAULT_SYSTEM_SETTINGS = [
  {
    key: 'feature.pos_vietqr_enabled',
    value: true,
    category: SystemSettingCategory.FEATURE_FLAGS,
    description: 'Bật/tắt thanh toán VietQR & Webhook tự động',
  },
  {
    key: 'feature.ai_autopilot_enabled',
    value: true,
    category: SystemSettingCategory.FEATURE_FLAGS,
    description: 'Bật/tắt AI Auto-pilot chốt đơn 24/7',
  },
  {
    key: 'feature.comment_masking_enabled',
    value: true,
    category: SystemSettingCategory.FEATURE_FLAGS,
    description: 'Bật/tắt ẩn bình luận chứa SĐT tự động',
  },
  {
    key: 'feature.thermal_print_enabled',
    value: true,
    category: SystemSettingCategory.FEATURE_FLAGS,
    description: 'Bật/tắt in phiếu gửi nhiệt K80/K58',
  },
  {
    key: 'llm.default_provider',
    value: 'GEMINI',
    category: SystemSettingCategory.AI,
    description: 'Nhà cung cấp LLM mặc định',
  },
  {
    key: 'llm.default_model',
    value: 'gemini-2.5-flash',
    category: SystemSettingCategory.AI,
    description: 'Model mặc định cho tác vụ bán hàng',
  },
  {
    key: 'llm.temperature_default',
    value: 0.3,
    category: SystemSettingCategory.AI,
    description: 'Nhiệt độ ngẫu nhiên đàm phán bán hàng',
  },
  {
    key: 'llm.max_tokens_limit',
    value: 2048,
    category: SystemSettingCategory.AI,
    description: 'Giới hạn tokens tối đa cho phản hồi AI',
  },
  {
    key: 'quotas.free.max_agents',
    value: 2,
    category: SystemSettingCategory.BILLING,
    description: 'Số nhân sự tối đa cho gói FREE',
  },
  {
    key: 'quotas.free.max_channels',
    value: 2,
    category: SystemSettingCategory.BILLING,
    description: 'Số kênh tối đa cho gói FREE',
  },
  {
    key: 'quotas.free.storage_mb',
    value: 500,
    category: SystemSettingCategory.BILLING,
    description: 'Dung lượng lưu trữ tối đa gói FREE',
  },
  {
    key: 'quotas.free.ai_monthly_tokens',
    value: 50000,
    category: SystemSettingCategory.BILLING,
    description: 'Số token AI tối đa mỗi tháng gói FREE',
  },
  {
    key: 'system.maintenance_mode',
    value: false,
    category: SystemSettingCategory.SYSTEM,
    description: 'Chế độ bảo trì hệ thống',
  },
  {
    key: 'system.banner_message',
    value: '',
    category: SystemSettingCategory.SYSTEM,
    description: 'Thông báo nổi trên toàn hệ thống',
  },
  {
    key: 'system.banner_level',
    value: 'INFO',
    category: SystemSettingCategory.SYSTEM,
    description: 'Mức độ cảnh báo của banner thông báo',
  },
];

@Injectable()
export class SystemSettingsService implements OnModuleInit {
  private readonly logger = new Logger(SystemSettingsService.name);
  private readonly memCache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly MEM_TTL_MS = 30_000; // 30 seconds L1 process RAM cache
  private readonly REDIS_TTL_SEC = 3600; // 1 hour L2 Redis cache
  private readonly REDIS_KEY_PREFIX = 'system:settings:';
  private readonly REDIS_ALL_KEY = 'system:settings:all';

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.prisma.client.systemSetting.createMany({
        data: DEFAULT_SYSTEM_SETTINGS,
        skipDuplicates: true,
      });
      this.logger.log(`Initialized dynamic system settings bootstrap successfully.`);
    } catch (err) {
      this.logger.warn(`Failed to bootstrap default system settings: ${(err as Error)?.message}`);
    }
  }

  /**
   * Fast 2-tier cached reading of a dynamic setting.
   * Pipeline: L1 Process RAM (<0.01ms) -> L2 Redis (<2ms) -> L3 PostgreSQL -> fallback defaultValue.
   */
  async getSetting<T>(key: string, defaultValue?: T): Promise<T> {
    // 1. Check L1 Memory Cache
    const memItem = this.memCache.get(key);
    if (memItem) {
      if (Date.now() < memItem.expiresAt) {
        return memItem.value as T;
      }
      this.memCache.delete(key);
    }

    // 2. Check L2 Redis Cache
    try {
      const redisValue = await this.redis.get(`${this.REDIS_KEY_PREFIX}${key}`);
      if (redisValue !== null && redisValue !== undefined) {
        const parsed = JSON.parse(redisValue) as T;
        this.memCache.set(key, {
          value: parsed,
          expiresAt: Date.now() + this.MEM_TTL_MS,
        });
        return parsed;
      }
    } catch (err) {
      this.logger.warn(`Redis L2 cache error for getSetting('${key}'):`, err);
    }

    // 3. Fallback to L3 Database
    try {
      const record = await this.prisma.client.systemSetting.findUnique({
        where: { key },
      });

      if (record) {
        const val = record.value as T;
        // Populate L1 Memory
        this.memCache.set(key, {
          value: val,
          expiresAt: Date.now() + this.MEM_TTL_MS,
        });
        // Populate L2 Redis
        try {
          await this.redis.set(
            `${this.REDIS_KEY_PREFIX}${key}`,
            JSON.stringify(val),
            this.REDIS_TTL_SEC,
          );
        } catch (redisErr) {
          this.logger.warn(`Failed to set Redis cache for '${key}':`, redisErr);
        }
        return val;
      }
    } catch (dbErr) {
      this.logger.error(`Database error reading setting '${key}':`, dbErr);
    }

    return defaultValue as T;
  }

  /**
   * Retrieves all dynamic system settings, optionally filtered by category.
   * Cached in L1 process RAM and L2 Redis under 'system:settings:all'.
   */
  async getAllSettings(category?: string): Promise<SystemSettingItemDto[]> {
    // 1. Check L1 Memory Cache
    const memAll = this.memCache.get(this.REDIS_ALL_KEY);
    if (memAll && Date.now() < memAll.expiresAt) {
      const list = memAll.value as SystemSettingItemDto[];
      return category ? list.filter(item => item.category === category) : list;
    }

    // 2. Check L2 Redis Cache
    try {
      const redisAll = await this.redis.get(this.REDIS_ALL_KEY);
      if (redisAll) {
        const list = JSON.parse(redisAll) as SystemSettingItemDto[];
        this.memCache.set(this.REDIS_ALL_KEY, {
          value: list,
          expiresAt: Date.now() + this.MEM_TTL_MS,
        });
        return category ? list.filter(item => item.category === category) : list;
      }
    } catch (err) {
      this.logger.warn(`Redis error in getAllSettings:`, err);
    }

    // 3. Query L3 Database
    const records = await this.prisma.client.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    const items: SystemSettingItemDto[] = records.map((record: any) => ({
      key: record.key,
      value: record.value,
      category: record.category,
      description: record.description,
      isEncrypted: record.isEncrypted,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));

    // Cache all in L1 and L2
    this.memCache.set(this.REDIS_ALL_KEY, {
      value: items,
      expiresAt: Date.now() + this.MEM_TTL_MS,
    });
    try {
      await this.redis.set(this.REDIS_ALL_KEY, JSON.stringify(items), this.REDIS_TTL_SEC);
    } catch (err) {
      this.logger.warn(`Failed to set Redis cache for all settings:`, err);
    }

    return category ? items.filter(item => item.category === category) : items;
  }

  /**
   * Atomically mutates a setting in PostgreSQL and generates an immutable PlatformAuditLog entry.
   * Post-commit hook ensures L1 process RAM and L2 Redis are updated without race conditions.
   */
  async updateSetting(
    key: string,
    dto: UpdateSystemSettingDto,
    actor: ActorContext,
  ): Promise<SystemSettingItemDto> {
    if (!key || typeof key !== 'string' || !key.trim()) {
      throw new BadRequestException({
        code: 'INVALID_SETTING_KEY',
        message: 'Setting key must be a non-empty string',
      });
    }

    const cleanKey = key.trim();

    return this.prisma.runInTransaction(async ctx => {
      // 1. Fetch current setting for audit diff and fallback
      const existing = await ctx.tx.systemSetting.findUnique({
        where: { key: cleanKey },
      });
      const oldValue = existing ? existing.value : null;
      const category = existing?.category ?? this.inferCategory(cleanKey);

      // Resolve final newValue: prefer dto.value, fallback to existing.value
      const resolvedValue =
        dto.value !== undefined ? dto.value : existing ? existing.value : undefined;

      if (resolvedValue === undefined) {
        throw new BadRequestException({
          code: 'SETTING_VALUE_REQUIRED',
          message: `Setting value is required when configuring '${cleanKey}'`,
        });
      }

      // 2. Upsert the setting atomically
      const updated = await ctx.tx.systemSetting.upsert({
        where: { key: cleanKey },
        create: {
          key: cleanKey,
          value: resolvedValue as any,
          category,
          description: dto.description ?? null,
          isEncrypted: false,
          updatedBy: actor.email,
        },
        update: {
          value: resolvedValue as any,
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          updatedBy: actor.email,
        },
      });

      // 3. Create platform audit log record
      await ctx.tx.platformAuditLog.create({
        data: {
          actorId: actor.userId,
          actorEmail: actor.email,
          action: PlatformAuditAction.SYSTEM_SETTING_UPDATED,
          targetType: PlatformAuditTargetType.SYSTEM_SETTING,
          targetId: cleanKey,
          metadata: {
            key: cleanKey,
            oldValue,
            newValue: resolvedValue,
          },
          ipAddress: actor.ipAddress ?? null,
          userAgent: actor.userAgent ?? null,
        },
      });

      // 4. Register post-commit cache synchronization
      ctx.addPostCommitHook(async () => {
        // Update L1 Memory Cache with resolved value
        this.memCache.set(cleanKey, {
          value: resolvedValue,
          expiresAt: Date.now() + this.MEM_TTL_MS,
        });
        this.memCache.delete(this.REDIS_ALL_KEY);

        // Update L2 Redis Cache with resolved value
        try {
          await this.redis.set(
            `${this.REDIS_KEY_PREFIX}${cleanKey}`,
            JSON.stringify(resolvedValue),
            this.REDIS_TTL_SEC,
          );
          await this.redis.del(this.REDIS_ALL_KEY);
        } catch (err) {
          this.logger.warn(`Post-commit Redis update failed for key '${cleanKey}':`, err);
        }
      });

      return {
        key: updated.key,
        value: updated.value,
        category: updated.category,
        description: updated.description,
        isEncrypted: updated.isEncrypted,
        updatedBy: updated.updatedBy,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  /**
   * Infers the setting category based on the setting key prefix.
   */
  inferCategory(key: string): SystemSettingCategory {
    if (key.startsWith('feature.')) return SystemSettingCategory.FEATURE_FLAGS;
    if (key.startsWith('llm.') || key.startsWith('ai.')) return SystemSettingCategory.AI;
    if (key.startsWith('quotas.') || key.startsWith('billing.'))
      return SystemSettingCategory.BILLING;
    if (key.startsWith('system.')) return SystemSettingCategory.SYSTEM;
    return SystemSettingCategory.GENERAL;
  }

  /**
   * Clears internal L1 process RAM cache (useful for testing and deterministic cache invalidation).
   */
  clearMemoryCache(): void {
    this.memCache.clear();
  }
}
