import { Injectable, Logger } from '@nestjs/common';
import {
  ConversationResponseDto,
  ConversationStatus,
  PresenceStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { RedisService } from '../../infrastructure/redis';
import { PresenceService } from '../realtime/presence.service';
import { ConversationsService } from './conversations.service';

/**
 * Service managing automated round-robin and least-loaded conversation assignment (Feature F-1.8.1).
 *
 * Algorithm Steps:
 * 1. Verify Inbox.isAutoAssignmentEnabled and conversation eligibility (OPEN, unassigned).
 * 2. Acquire per-inbox distributed Redis lock (prevents race conditions across parallel webhooks).
 * 3. Filter candidate agents: Inbox members ∩ (optional) Team members.
 * 4. Filter online agents: PresenceService (status === ONLINE).
 * 5. Calculate workload: workspace-wide OPEN conversation count per online candidate.
 * 6. Tiebreaker: Redis circular queue ('round_robin:inbox:{inboxId}') for candidates with minimum load.
 * 7. Assign conversation via ConversationsService and rotate candidate in Redis circular queue.
 */
@Injectable()
export class AutoAssignmentService {
  private readonly logger = new Logger(AutoAssignmentService.name);
  readonly LOCK_PREFIX = 'lock:auto_assign:inbox';
  readonly ROUND_ROBIN_PREFIX = 'round_robin:inbox';
  readonly LOCK_TTL_MS = 3000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly presenceService: PresenceService,
    private readonly conversationsService: ConversationsService,
  ) {}

  /**
   * Automatically assigns an eligible conversation to the best available online agent.
   *
   * @param workspaceId Workspace tenant identifier
   * @param conversationId Conversation identifier
   * @returns Assigned conversation DTO or null if not assignable / no agent available
   */
  async assignConversation(
    workspaceId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto | null> {
    const client = this.prisma.getClient();

    // 1. Initial eligibility check
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: { inbox: true },
    });

    if (!conversation) {
      this.logger.debug(`Conversation '${conversationId}' not found in workspace '${workspaceId}'`);
      return null;
    }

    if (!conversation.inbox?.isAutoAssignmentEnabled) {
      this.logger.debug(
        `Auto-assignment disabled for inbox '${conversation.inboxId}' in conversation '${conversationId}'`,
      );
      return null;
    }

    if (conversation.assigneeId !== null) {
      this.logger.debug(
        `Conversation '${conversationId}' already assigned to '${conversation.assigneeId}', skipping auto-assignment`,
      );
      return null;
    }

    if (conversation.status !== ConversationStatus.OPEN) {
      this.logger.debug(
        `Conversation '${conversationId}' status is '${conversation.status}' (not OPEN), skipping auto-assignment`,
      );
      return null;
    }

    // 2. Acquire Redis distributed lock per inbox with retry to prevent starvation
    const lockKey = `${this.LOCK_PREFIX}:${conversation.inboxId}`;
    let lockToken: string | null = null;
    const maxLockRetries = 3;
    const retryDelays = [50, 100, 150];

    for (let attempt = 0; attempt <= maxLockRetries; attempt++) {
      lockToken = await this.redis.acquireLock(lockKey, this.LOCK_TTL_MS);
      if (lockToken) break;

      if (attempt < maxLockRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
      }
    }

    if (!lockToken) {
      this.logger.warn(
        `Could not acquire auto-assignment lock for inbox '${conversation.inboxId}' after ${maxLockRetries + 1} attempts (in-flight assignment in progress)`,
      );
      return null;
    }

    try {
      // 3. Re-verify conversation state under lock (guard against concurrent assign)
      const freshConv = await client.conversation.findFirst({
        where: { id: conversationId, workspaceId },
      });

      if (
        !freshConv ||
        freshConv.assigneeId !== null ||
        freshConv.status !== ConversationStatus.OPEN
      ) {
        return null;
      }

      // 4. Select candidate agent
      const candidateAgentId = await this.findAvailableAgent(
        workspaceId,
        conversation.inboxId,
        conversation.teamId,
      );

      if (!candidateAgentId) {
        this.logger.debug(
          `No available online agent found for conversation '${conversationId}' in inbox '${conversation.inboxId}'`,
        );
        return null;
      }

      // 5. Perform assignment through ConversationsService (updates DB & emits conversation.assigned)
      const assigned = await this.conversationsService.assign(
        workspaceId,
        conversationId,
        { assigneeId: candidateAgentId },
        null,
      );

      // 6. Rotate agent in round-robin circular queue
      await this.rotateRoundRobinQueue(conversation.inboxId, candidateAgentId);

      this.logger.log(
        `Auto-assigned conversation #${assigned.displayId} (${conversationId}) to agent '${candidateAgentId}' in inbox '${conversation.inboxId}'`,
      );

      return assigned;
    } finally {
      await this.redis.releaseLock(lockKey, lockToken);
    }
  }

  /**
   * Finds the best available online agent based on membership, online presence, least load, and round-robin.
   */
  async findAvailableAgent(
    workspaceId: string,
    inboxId: string,
    teamId?: string | null,
  ): Promise<string | null> {
    const client = this.prisma.getClient();

    // 1. Fetch inbox members
    const inboxMembers = await client.inboxMember.findMany({
      where: { inboxId },
      select: { userId: true },
    });

    if (!inboxMembers || inboxMembers.length === 0) {
      return null;
    }

    let candidateUserIds = inboxMembers.map(m => m.userId);

    // 2. Intersect with Team members if teamId specified
    if (teamId) {
      const teamMembers = await client.teamMember.findMany({
        where: { teamId },
        select: { userId: true },
      });
      const teamUserSet = new Set(teamMembers.map(tm => tm.userId));
      candidateUserIds = candidateUserIds.filter(userId => teamUserSet.has(userId));

      if (candidateUserIds.length === 0) {
        return null;
      }
    }

    // 3. Filter candidate agents who are currently ONLINE
    const presenceRecords = await this.presenceService.getWorkspacePresence(workspaceId, false);
    const onlineUserSet = new Set(
      presenceRecords.filter(p => p.status === PresenceStatus.ONLINE).map(p => p.userId),
    );

    const onlineCandidates = candidateUserIds.filter(userId => onlineUserSet.has(userId));

    if (onlineCandidates.length === 0) {
      return null;
    }

    if (onlineCandidates.length === 1) {
      return onlineCandidates[0];
    }

    // 4. Calculate OPEN conversation count for online candidates (least-loaded heuristic)
    const openCounts = await client.conversation.groupBy({
      by: ['assigneeId'],
      where: {
        workspaceId,
        assigneeId: { in: onlineCandidates },
        status: ConversationStatus.OPEN,
      },
      _count: { id: true },
    });

    const countMap = new Map<string, number>();
    for (const userId of onlineCandidates) {
      countMap.set(userId, 0);
    }
    for (const row of openCounts) {
      if (row.assigneeId) {
        countMap.set(row.assigneeId, row._count.id);
      }
    }

    let minCount = Infinity;
    for (const count of countMap.values()) {
      if (count < minCount) {
        minCount = count;
      }
    }

    const tiedCandidates = onlineCandidates.filter(userId => countMap.get(userId) === minCount);

    if (tiedCandidates.length === 1) {
      return tiedCandidates[0];
    }

    // 5. Tiebreaker via Redis circular queue
    return this.getRoundRobinTiebreaker(inboxId, tiedCandidates);
  }

  /**
   * Resolves round-robin tiebreaker among candidates with identical workload.
   * Selects candidate appearing earliest in the Redis circular queue.
   */
  async getRoundRobinTiebreaker(inboxId: string, tiedCandidateIds: string[]): Promise<string> {
    if (tiedCandidateIds.length === 0) {
      throw new Error('tiedCandidateIds cannot be empty');
    }
    if (tiedCandidateIds.length === 1) {
      return tiedCandidateIds[0];
    }

    const roundRobinKey = `${this.ROUND_ROBIN_PREFIX}:${inboxId}`;
    const queue = await this.redis.lrange(roundRobinKey);

    let selected = tiedCandidateIds[0];
    let bestIndex = Infinity;

    for (const candidateId of tiedCandidateIds) {
      const idx = queue.indexOf(candidateId);
      if (idx === -1) {
        // Candidate not yet in queue -> highest priority
        return candidateId;
      }
      if (idx < bestIndex) {
        bestIndex = idx;
        selected = candidateId;
      }
    }

    return selected;
  }

  /**
   * Rotates an agent in the Redis circular queue by removing and appending to the end.
   */
  async rotateRoundRobinQueue(inboxId: string, userId: string): Promise<void> {
    const roundRobinKey = `${this.ROUND_ROBIN_PREFIX}:${inboxId}`;
    await this.redis.lrem(roundRobinKey, 0, userId);
    await this.redis.rpush(roundRobinKey, userId);
  }
}
