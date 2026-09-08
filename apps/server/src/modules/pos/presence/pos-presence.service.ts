import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../infrastructure/redis/redis.service';

export interface PosLockData {
  userId: string;
  userName?: string;
  userEmail?: string;
  avatarUrl?: string;
  startedAt: string;
  lastHeartbeatAt: string;
}

export interface PosEditingStatusResult {
  isLocked: boolean;
  lockedBy?: PosLockData | null;
  remainingTtlSeconds?: number;
}

export interface PosStartEditingResult extends PosEditingStatusResult {
  success: boolean;
}

@Injectable()
export class PosPresenceService {
  private readonly logger = new Logger(PosPresenceService.name);
  private static readonly LOCK_TTL_SECONDS = 30;

  constructor(private readonly redis: RedisService) {}

  private getLockKey(workspaceId: string, conversationId: string): string {
    return `lock:pos:editing:${workspaceId}:${conversationId}`;
  }

  /**
   * Attempts to acquire editing lock for the given conversation.
   * If already locked by another agent, returns failure and current lock holder info.
   */
  async startEditing(
    workspaceId: string,
    conversationId: string,
    user: { userId: string; userName?: string; userEmail?: string; avatarUrl?: string },
  ): Promise<PosStartEditingResult> {
    const key = this.getLockKey(workspaceId, conversationId);
    const existingStr = await this.redis.get(key);

    if (existingStr) {
      try {
        const existing = JSON.parse(existingStr) as PosLockData;
        if (existing.userId !== user.userId) {
          const ttl = await this.redis.ttl(key);
          return {
            success: false,
            isLocked: true,
            lockedBy: existing,
            remainingTtlSeconds: Math.max(0, ttl),
          };
        }
      } catch (err) {
        this.logger.warn(`Corrupted lock data at ${key}, overriding: ${(err as Error).message}`);
      }
    }

    const now = new Date().toISOString();
    let startedAt = now;
    if (existingStr) {
      try {
        const parsed = JSON.parse(existingStr);
        if (parsed.startedAt) startedAt = parsed.startedAt;
      } catch {
        // use now
      }
    }

    const lockData: PosLockData = {
      userId: user.userId,
      userName: user.userName,
      userEmail: user.userEmail,
      avatarUrl: user.avatarUrl,
      startedAt,
      lastHeartbeatAt: now,
    };

    await this.redis.set(key, JSON.stringify(lockData), PosPresenceService.LOCK_TTL_SECONDS);

    return {
      success: true,
      isLocked: false,
      lockedBy: null,
      remainingTtlSeconds: PosPresenceService.LOCK_TTL_SECONDS,
    };
  }

  /**
   * Refreshes the sliding 30s TTL for an agent currently holding the lock.
   */
  async refreshHeartbeat(
    workspaceId: string,
    conversationId: string,
    userId: string,
  ): Promise<{ success: boolean; remainingTtlSeconds: number }> {
    const key = this.getLockKey(workspaceId, conversationId);
    const existingStr = await this.redis.get(key);

    if (!existingStr) {
      return { success: false, remainingTtlSeconds: 0 };
    }

    try {
      const existing = JSON.parse(existingStr) as PosLockData;
      if (existing.userId !== userId) {
        return { success: false, remainingTtlSeconds: 0 };
      }

      existing.lastHeartbeatAt = new Date().toISOString();
      await this.redis.set(key, JSON.stringify(existing), PosPresenceService.LOCK_TTL_SECONDS);

      return { success: true, remainingTtlSeconds: PosPresenceService.LOCK_TTL_SECONDS };
    } catch {
      return { success: false, remainingTtlSeconds: 0 };
    }
  }

  /**
   * Releases editing lock if held by the given agent.
   */
  async stopEditing(workspaceId: string, conversationId: string, userId: string): Promise<boolean> {
    const key = this.getLockKey(workspaceId, conversationId);
    const existingStr = await this.redis.get(key);

    if (!existingStr) {
      return true;
    }

    try {
      const existing = JSON.parse(existingStr) as PosLockData;
      if (existing.userId === userId) {
        await this.redis.del(key);
        return true;
      }
      return false;
    } catch {
      await this.redis.del(key);
      return true;
    }
  }

  /**
   * Forcefully takes over editing lock for another agent.
   */
  async takeoverEditing(
    workspaceId: string,
    conversationId: string,
    user: { userId: string; userName?: string; userEmail?: string; avatarUrl?: string },
  ): Promise<{
    success: boolean;
    previousLockedBy?: PosLockData | null;
    remainingTtlSeconds: number;
  }> {
    const key = this.getLockKey(workspaceId, conversationId);
    const existingStr = await this.redis.get(key);
    let previousLockedBy: PosLockData | null = null;

    if (existingStr) {
      try {
        previousLockedBy = JSON.parse(existingStr) as PosLockData;
      } catch {
        // ignore
      }
    }

    const now = new Date().toISOString();
    const lockData: PosLockData = {
      userId: user.userId,
      userName: user.userName,
      userEmail: user.userEmail,
      avatarUrl: user.avatarUrl,
      startedAt: now,
      lastHeartbeatAt: now,
    };

    await this.redis.set(key, JSON.stringify(lockData), PosPresenceService.LOCK_TTL_SECONDS);

    return {
      success: true,
      previousLockedBy,
      remainingTtlSeconds: PosPresenceService.LOCK_TTL_SECONDS,
    };
  }

  /**
   * Gets current lock status for a conversation.
   */
  async getEditingStatus(
    workspaceId: string,
    conversationId: string,
  ): Promise<PosEditingStatusResult> {
    const key = this.getLockKey(workspaceId, conversationId);
    const existingStr = await this.redis.get(key);

    if (!existingStr) {
      return { isLocked: false, lockedBy: null, remainingTtlSeconds: 0 };
    }

    try {
      const existing = JSON.parse(existingStr) as PosLockData;
      const ttl = await this.redis.ttl(key);
      return {
        isLocked: true,
        lockedBy: existing,
        remainingTtlSeconds: Math.max(0, ttl),
      };
    } catch {
      return { isLocked: false, lockedBy: null, remainingTtlSeconds: 0 };
    }
  }

  /**
   * Cleans up all locks held by a user on disconnect.
   * Returns list of unlocked conversations so gateway can broadcast status updates.
   */
  async cleanupUserLocks(
    userId: string,
  ): Promise<Array<{ workspaceId: string; conversationId: string }>> {
    const cleaned: Array<{ workspaceId: string; conversationId: string }> = [];
    try {
      const keys = await this.redis.scan('lock:pos:editing:*');
      for (const key of keys) {
        const val = await this.redis.get(key);
        if (val) {
          try {
            const data = JSON.parse(val) as PosLockData;
            if (data.userId === userId) {
              await this.redis.del(key);
              this.logger.debug(`Cleaned up POS lock at ${key} for disconnected user ${userId}`);
              const parts = key.split(':');
              if (parts.length >= 5) {
                cleaned.push({ workspaceId: parts[3], conversationId: parts[4] });
              }
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error during cleanupUserLocks for ${userId}: ${(err as Error).message}`);
    }
    return cleaned;
  }
}
