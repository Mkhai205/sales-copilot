import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CopilotMetricsDto,
  CopilotSuggestionDto,
  DomainEvent,
  SuggestionStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { GeneratedSuggestionItem } from './copilot-engine.service';

const DEFAULT_TTL_MINUTES = 10;

@Injectable()
export class CopilotService {
  private readonly logger = new Logger(CopilotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Retrieves all active/pending suggestions for a conversation within a workspace.
   * Auto-expires outdated pending suggestions where expiresAt has passed.
   */
  async getPendingSuggestions(
    workspaceId: string,
    conversationId: string,
  ): Promise<CopilotSuggestionDto[]> {
    const client = this.prisma.getClient();

    // 1. Auto-expire past-due pending suggestions
    const now = new Date();
    await client.copilotSuggestion.updateMany({
      where: {
        workspaceId,
        conversationId,
        status: SuggestionStatus.PENDING,
        expiresAt: { lt: now },
      },
      data: {
        status: SuggestionStatus.EXPIRED,
        dismissedReason: 'EXPIRED_BY_TTL',
        resolvedAt: now,
      },
    });

    // 2. Fetch remaining active pending suggestions
    const suggestions = await client.copilotSuggestion.findMany({
      where: {
        workspaceId,
        conversationId,
        status: SuggestionStatus.PENDING,
      },
      orderBy: { confidence: 'desc' },
    });

    return suggestions.map(s => this.mapToDto(s));
  }

  /**
   * Persists new suggestions for a conversation.
   * Enforces BR-2.5.1 (Single Active Pending Suggestion) by expiring existing PENDING records.
   */
  async createSuggestions(
    workspaceId: string,
    conversationId: string,
    items: GeneratedSuggestionItem[],
    options?: { messageId?: string; leadId?: string; ttlMinutes?: number },
  ): Promise<CopilotSuggestionDto[]> {
    if (!items || items.length === 0) {
      return [];
    }

    const client = this.prisma.getClient();
    const ttl = options?.ttlMinutes ?? DEFAULT_TTL_MINUTES;
    const expiresAt = new Date(Date.now() + ttl * 60 * 1000);

    // 1. Invalidate/expire existing pending suggestions to prevent race conditions
    // and satisfy the partial unique index on (workspaceId, conversationId) WHERE status = 'PENDING'
    await this.expireSuggestionsForConversation(
      workspaceId,
      conversationId,
      'SUPERSEDED_BY_NEW_SUGGESTION',
    );

    // 2. Insert new suggestions for each distinct type (Reply Draft, NBA, Battlecard)
    // Enforcing at most 1 active PENDING suggestion per type per conversation
    // per the partial unique index on (workspaceId, conversationId, suggestionType) WHERE status = 'PENDING'.
    const itemsByType = new Map<string, GeneratedSuggestionItem>();
    for (const item of items) {
      const existing = itemsByType.get(item.suggestionType);
      if (!existing || item.confidence > existing.confidence) {
        itemsByType.set(item.suggestionType, item);
      }
    }

    // Sort by confidence descending so highest confidence item is created first
    const sortedItems = Array.from(itemsByType.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );

    for (const item of sortedItems) {
      const record = await client.copilotSuggestion.create({
        data: {
          workspaceId,
          conversationId,
          messageId: options?.messageId || null,
          leadId: options?.leadId || null,
          suggestionType: item.suggestionType,
          title: item.title,
          content: item.content,
          actionPayload: item.actionPayload as any,
          confidence: item.confidence,
          status: SuggestionStatus.PENDING,
          expiresAt,
        },
      });

      const dto = this.mapToDto(record);
      createdList.push(dto);

      // Emit domain event for each generated suggestion
      this.eventEmitter.emit(DomainEvent.COPILOT_SUGGESTION_GENERATED, {
        workspaceId,
        conversationId,
        suggestionId: record.id,
        suggestionType: record.suggestionType,
        title: record.title,
        content: record.content,
        confidence: record.confidence,
        actionPayload: item.actionPayload,
      });
    }

    return createdList;
  }

  /**
   * Resolves a suggestion with a terminal status: ACCEPTED, DISMISSED, or APPLIED.
   */
  async resolveSuggestion(
    workspaceId: string,
    id: string,
    status: SuggestionStatus,
    userId?: string,
    reason?: string,
  ): Promise<CopilotSuggestionDto> {
    const client = this.prisma.getClient();

    const existing = await client.copilotSuggestion.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'SUGGESTION_NOT_FOUND',
        message: `Copilot suggestion with id '${id}' not found in workspace`,
        details: { id, workspaceId },
      });
    }

    if (existing.status !== SuggestionStatus.PENDING) {
      throw new BadRequestException({
        code: 'SUGGESTION_ALREADY_RESOLVED',
        message: `Suggestion '${id}' is already resolved with status '${existing.status}'`,
        details: { currentStatus: existing.status },
      });
    }

    // Check if suggestion has expired past its TTL (10 minutes)
    if (new Date() > new Date(existing.expiresAt)) {
      await client.copilotSuggestion.update({
        where: { id },
        data: {
          status: SuggestionStatus.EXPIRED,
          dismissedReason: 'EXPIRED_BY_TTL',
          resolvedAt: new Date(),
        },
      });

      this.eventEmitter.emit(DomainEvent.COPILOT_SUGGESTION_ACTED, {
        workspaceId,
        conversationId: existing.conversationId,
        suggestionId: existing.id,
        action: SuggestionStatus.EXPIRED,
        reason: 'EXPIRED_BY_TTL',
      });

      throw new BadRequestException({
        code: 'SUGGESTION_EXPIRED',
        message: `Suggestion '${id}' has expired and can no longer be resolved`,
        details: { expiresAt: existing.expiresAt },
      });
    }

    const resolved = await client.copilotSuggestion.update({
      where: { id },
      data: {
        status,
        resolvedByUserId: userId || null,
        resolvedAt: new Date(),
        dismissedReason: reason || null,
      },
    });

    // Emit acted domain event
    this.eventEmitter.emit(DomainEvent.COPILOT_SUGGESTION_ACTED, {
      workspaceId,
      conversationId: resolved.conversationId,
      suggestionId: resolved.id,
      action: status,
      userId: userId || null,
      reason: reason || null,
    });

    return this.mapToDto(resolved);
  }

  /**
   * Auto-expires all pending suggestions for a conversation (BR-2.5.2).
   */
  async expireSuggestionsForConversation(
    workspaceId: string,
    conversationId: string,
    reason: string = 'NEW_CUSTOMER_MESSAGE',
  ): Promise<number> {
    const client = this.prisma.getClient();

    const result = await client.copilotSuggestion.updateMany({
      where: {
        workspaceId,
        conversationId,
        status: SuggestionStatus.PENDING,
      },
      data: {
        status: SuggestionStatus.EXPIRED,
        dismissedReason: reason,
        resolvedAt: new Date(),
      },
    });

    // Realtime notification: notify connected clients that stale suggestions are now expired
    if (result.count > 0) {
      this.eventEmitter.emit(DomainEvent.COPILOT_SUGGESTION_ACTED, {
        workspaceId,
        conversationId,
        action: SuggestionStatus.EXPIRED,
        reason,
      });
    }

    return result.count;
  }

  /**
   * Gathers workspace-wide usage & acceptance metrics (BR-2.5.4).
   */
  async getMetrics(workspaceId: string): Promise<CopilotMetricsDto> {
    const client = this.prisma.getClient();

    const [
      totalSuggestions,
      pendingCount,
      acceptedCount,
      appliedCount,
      dismissedCount,
      expiredCount,
    ] = await Promise.all([
      client.copilotSuggestion.count({ where: { workspaceId } }),
      client.copilotSuggestion.count({ where: { workspaceId, status: SuggestionStatus.PENDING } }),
      client.copilotSuggestion.count({ where: { workspaceId, status: SuggestionStatus.ACCEPTED } }),
      client.copilotSuggestion.count({ where: { workspaceId, status: SuggestionStatus.APPLIED } }),
      client.copilotSuggestion.count({
        where: { workspaceId, status: SuggestionStatus.DISMISSED },
      }),
      client.copilotSuggestion.count({ where: { workspaceId, status: SuggestionStatus.EXPIRED } }),
    ]);

    // Group dismissed reasons
    const dismissedRecords = await client.copilotSuggestion.findMany({
      where: { workspaceId, status: SuggestionStatus.DISMISSED },
      select: { dismissedReason: true },
    });

    const dismissalReasons: Record<string, number> = {};
    for (const item of dismissedRecords) {
      const r = item.dismissedReason || 'UNSPECIFIED';
      dismissalReasons[r] = (dismissalReasons[r] || 0) + 1;
    }

    const resolvedCount = acceptedCount + appliedCount + dismissedCount + expiredCount;
    const acceptedTotal = acceptedCount + appliedCount;
    const acceptanceRate =
      resolvedCount > 0 ? Math.round((acceptedTotal / resolvedCount) * 1000) / 10 : 0;

    return {
      totalSuggestions,
      pendingCount,
      acceptedCount,
      appliedCount,
      dismissedCount,
      expiredCount,
      acceptanceRate,
      dismissalReasons,
    };
  }

  private mapToDto(s: any): CopilotSuggestionDto {
    return {
      id: s.id,
      workspaceId: s.workspaceId,
      conversationId: s.conversationId,
      messageId: s.messageId || null,
      leadId: s.leadId || null,
      suggestionType: s.suggestionType,
      title: s.title,
      content: s.content,
      actionPayload: (s.actionPayload as Record<string, unknown>) || {},
      confidence: Number(s.confidence),
      status: s.status,
      dismissedReason: s.dismissedReason || null,
      resolvedByUserId: s.resolvedByUserId || null,
      expiresAt: s.expiresAt instanceof Date ? s.expiresAt.toISOString() : s.expiresAt,
      resolvedAt: s.resolvedAt
        ? s.resolvedAt instanceof Date
          ? s.resolvedAt.toISOString()
          : s.resolvedAt
        : null,
      createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
    };
  }
}
