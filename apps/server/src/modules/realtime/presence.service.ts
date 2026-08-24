import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  DomainEvent,
  PresenceEntry,
  PresenceStatus,
  PresenceUpdatedEvent,
} from '@sales-copilot/shared-contracts';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * Service managing real-time agent presence tracking across workspaces.
 *
 * Backed by Redis:
 * - Hash: `presence:workspace:{workspaceId}` stores per-user PresenceEntry records.
 * - String: `presence:user:{userId}:{workspaceId}` with a 90-second TTL (heartbeat timeout).
 * - Automatic idle detection (marks agents AWAY after 5 minutes of inactivity).
 * - Scheduled stale presence cleanup running every minute.
 */
@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  readonly PRESENCE_HASH_KEY = 'presence:workspace';
  readonly PRESENCE_USER_KEY = 'presence:user';
  readonly HEARTBEAT_TTL = 90; // seconds (2 missed 30s heartbeats = stale)
  readonly AWAY_TIMEOUT = 5 * 60; // 300 seconds (5 minutes)

  constructor(
    private readonly redis: RedisService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  /**
   * Sets agent status to ONLINE in a workspace, sets a 90s TTL key, and emits domain event.
   */
  async setOnline(workspaceId: string, userId: string): Promise<PresenceEntry> {
    try {
      const now = new Date().toISOString();
      const entry: PresenceEntry = {
        userId,
        status: PresenceStatus.ONLINE,
        lastSeenAt: now,
      };

      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;

      await this.redis.hset(hashKey, userId, JSON.stringify(entry));
      await this.redis.setex(userKey, this.HEARTBEAT_TTL, PresenceStatus.ONLINE);

      this.emitPresenceUpdated(workspaceId, entry);
      this.logger.debug(`Agent ${userId} marked ONLINE in workspace ${workspaceId}`);
      return entry;
    } catch (err) {
      this.logger.error(
        `Error setting agent ${userId} ONLINE in workspace ${workspaceId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        userId,
        status: PresenceStatus.ONLINE,
        lastSeenAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Sets agent status to OFFLINE in a workspace, removes TTL key, and emits domain event.
   */
  async setOffline(workspaceId: string, userId: string): Promise<PresenceEntry> {
    try {
      const now = new Date().toISOString();
      const entry: PresenceEntry = {
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeenAt: now,
      };

      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;

      await this.redis.hset(hashKey, userId, JSON.stringify(entry));
      await this.redis.del(userKey);

      this.emitPresenceUpdated(workspaceId, entry);
      this.logger.debug(`Agent ${userId} marked OFFLINE in workspace ${workspaceId}`);
      return entry;
    } catch (err) {
      this.logger.error(
        `Error setting agent ${userId} OFFLINE in workspace ${workspaceId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        userId,
        status: PresenceStatus.OFFLINE,
        lastSeenAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Sets agent status to AWAY in a workspace, preserves lastSeenAt if available, sets 90s TTL key, and emits domain event.
   */
  async setAway(workspaceId: string, userId: string): Promise<PresenceEntry> {
    try {
      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;

      const raw = await this.redis.hget(hashKey, userId);
      let lastSeenAt = new Date().toISOString();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as PresenceEntry;
          if (parsed.lastSeenAt) {
            lastSeenAt = parsed.lastSeenAt;
          }
        } catch {
          // Ignore parse error
        }
      }

      const entry: PresenceEntry = {
        userId,
        status: PresenceStatus.AWAY,
        lastSeenAt,
      };

      await this.redis.hset(hashKey, userId, JSON.stringify(entry));
      await this.redis.setex(userKey, this.HEARTBEAT_TTL, PresenceStatus.AWAY);

      this.emitPresenceUpdated(workspaceId, entry);
      this.logger.debug(`Agent ${userId} marked AWAY in workspace ${workspaceId}`);
      return entry;
    } catch (err) {
      this.logger.error(
        `Error setting agent ${userId} AWAY in workspace ${workspaceId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        userId,
        status: PresenceStatus.AWAY,
        lastSeenAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Processes a client heartbeat: refreshes the 90s TTL user key and updates lastSeenAt timestamp.
   */
  async heartbeat(workspaceId: string, userId: string): Promise<PresenceEntry> {
    try {
      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;

      const currentStatusStr = await this.redis.get(userKey);
      const currentStatus =
        currentStatusStr === PresenceStatus.AWAY ? PresenceStatus.AWAY : PresenceStatus.ONLINE;

      const now = new Date().toISOString();
      const entry: PresenceEntry = {
        userId,
        status: currentStatus,
        lastSeenAt: now,
      };

      await this.redis.hset(hashKey, userId, JSON.stringify(entry));
      await this.redis.setex(userKey, this.HEARTBEAT_TTL, currentStatus);

      this.logger.debug(`Heartbeat received from agent ${userId} in workspace ${workspaceId}`);
      return entry;
    } catch (err) {
      this.logger.error(
        `Error processing heartbeat for agent ${userId} in workspace ${workspaceId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      return {
        userId,
        status: PresenceStatus.ONLINE,
        lastSeenAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Retrieves current presence record for a specific user in a workspace.
   */
  async getUserPresence(workspaceId: string, userId: string): Promise<PresenceEntry | null> {
    try {
      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;

      const raw = await this.redis.hget(hashKey, userId);
      if (!raw) return null;

      const entry = JSON.parse(raw) as PresenceEntry;
      const ttl = await this.redis.ttl(userKey);

      // If user TTL key expired and record wasn't already marked OFFLINE, consider OFFLINE
      if (ttl <= 0 && entry.status !== PresenceStatus.OFFLINE) {
        entry.status = PresenceStatus.OFFLINE;
      }

      return entry;
    } catch (err) {
      this.logger.error(
        `Error getting presence for user ${userId} in workspace ${workspaceId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Retrieves presence records for all members in a workspace.
   * @param workspaceId Target workspace
   * @param includeOffline Whether to include OFFLINE members in the result
   */
  async getWorkspacePresence(
    workspaceId: string,
    includeOffline = false,
  ): Promise<PresenceEntry[]> {
    try {
      const hashKey = `${this.PRESENCE_HASH_KEY}:${workspaceId}`;
      const rawHash = await this.redis.hgetall(hashKey);
      if (!rawHash || Object.keys(rawHash).length === 0) {
        return [];
      }

      const results: PresenceEntry[] = [];

      for (const [userId, rawJson] of Object.entries(rawHash)) {
        try {
          const entry = JSON.parse(rawJson) as PresenceEntry;
          const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;
          const ttl = await this.redis.ttl(userKey);

          if (ttl <= 0 && entry.status !== PresenceStatus.OFFLINE) {
            entry.status = PresenceStatus.OFFLINE;
          }

          if (includeOffline || entry.status !== PresenceStatus.OFFLINE) {
            results.push(entry);
          }
        } catch {
          // Skip malformed record
        }
      }

      return results;
    } catch (err) {
      this.logger.error(
        `Error getting workspace presence for ${workspaceId}: ${(err as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Scheduled cron job running every minute to:
   * 1. Check expired TTL keys and mark them OFFLINE.
   * 2. Check idle agents (> 5 minutes inactive) and mark them AWAY.
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async cleanupStalePresence(): Promise<void> {
    try {
      const workspaceKeys = await this.redis.scan(`${this.PRESENCE_HASH_KEY}:*`);
      if (!workspaceKeys || workspaceKeys.length === 0) {
        return;
      }

      const nowMs = Date.now();

      for (const key of workspaceKeys) {
        const workspaceId = key.replace(`${this.PRESENCE_HASH_KEY}:`, '');
        const rawEntries = await this.redis.hgetall(key);

        for (const [userId, rawJson] of Object.entries(rawEntries)) {
          try {
            const entry = JSON.parse(rawJson) as PresenceEntry;
            if (entry.status === PresenceStatus.OFFLINE) {
              continue;
            }

            const userKey = `${this.PRESENCE_USER_KEY}:${userId}:${workspaceId}`;
            const ttl = await this.redis.ttl(userKey);
            const lastSeenMs = entry.lastSeenAt ? new Date(entry.lastSeenAt).getTime() : 0;
            const isIdleAway = nowMs - lastSeenMs > this.AWAY_TIMEOUT * 1000;

            if (ttl <= 0) {
              // Missed heartbeats -> TTL expired -> Mark OFFLINE
              await this.setOffline(workspaceId, userId);
              this.logger.debug(
                `Marked agent ${userId} OFFLINE in workspace ${workspaceId} due to missed heartbeats`,
              );
            } else if (isIdleAway && entry.status === PresenceStatus.ONLINE) {
              // Inactive > 5 mins -> Mark AWAY
              await this.setAway(workspaceId, userId);
              this.logger.debug(
                `Marked agent ${userId} AWAY in workspace ${workspaceId} due to inactivity`,
              );
            }
          } catch (itemErr) {
            this.logger.warn(
              `Error processing stale presence item for user ${userId}: ${(itemErr as Error).message}`,
            );
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Error in scheduled cleanupStalePresence: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // --- Internal Event Listeners for Automatic Connection Lifecycle ---

  @OnEvent('agent.connected')
  async handleAgentConnected(payload: {
    userId: string;
    availableWorkspaceIds?: string[];
  }): Promise<void> {
    if (!payload?.userId || !payload?.availableWorkspaceIds) return;
    for (const workspaceId of payload.availableWorkspaceIds) {
      await this.setOnline(workspaceId, payload.userId);
    }
  }

  @OnEvent('agent.disconnected')
  async handleAgentDisconnected(payload: {
    userId: string;
    joinedWorkspaceIds?: string[];
  }): Promise<void> {
    if (!payload?.userId || !payload?.joinedWorkspaceIds) return;
    for (const workspaceId of payload.joinedWorkspaceIds) {
      await this.setOffline(workspaceId, payload.userId);
    }
  }

  // --- Private Helpers ---

  private emitPresenceUpdated(workspaceId: string, entry: PresenceEntry): void {
    if (this.eventEmitter) {
      const payload: PresenceUpdatedEvent = {
        workspaceId,
        userId: entry.userId,
        status: entry.status,
        lastSeenAt: entry.lastSeenAt,
      };
      this.eventEmitter.emit(DomainEvent.PRESENCE_UPDATED, payload);
    }
  }
}
