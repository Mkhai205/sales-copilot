import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BuyingSignalType,
  CreateSalesEvidenceDto,
  DomainEvent,
  InvalidateSalesEvidenceDto,
  ListLeadEvidenceQueryDto,
  PaginationMeta,
  SalesEvidenceResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';

/**
 * Normalizes raw Prisma SalesEvidence model into SalesEvidenceResponseDto.
 */
export function formatSalesEvidenceResponse(evidence: any): SalesEvidenceResponseDto {
  return {
    id: evidence.id,
    workspaceId: evidence.workspaceId,
    leadId: evidence.leadId ?? null,
    conversationId: evidence.conversationId,
    messageId: evidence.messageId ?? null,
    signalType: evidence.signalType as BuyingSignalType,
    signalCategory: evidence.signalCategory ?? null,
    confidence: Number(evidence.confidence),
    snippet: evidence.snippet,
    reason: evidence.reason,
    metadata: (evidence.metadata as Record<string, unknown>) || {},
    isInvalidated: Boolean(evidence.isInvalidated),
    invalidationReason: evidence.invalidationReason ?? null,
    invalidatedByUserId: evidence.invalidatedByUserId ?? null,
    invalidatedAt: evidence.invalidatedAt ? new Date(evidence.invalidatedAt).toISOString() : null,
    createdAt: new Date(evidence.createdAt).toISOString(),
    updatedAt: new Date(evidence.updatedAt).toISOString(),
  };
}

@Injectable()
export class SalesEvidenceService {
  private readonly logger = new Logger(SalesEvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Ingests a new SalesEvidence record with confidence validation, tenant scoping,
   * verbatim snippet, and domain event emission.
   */
  async recordEvidence(
    workspaceId: string,
    dto: CreateSalesEvidenceDto,
  ): Promise<SalesEvidenceResponseDto> {
    // 1. Validate confidence bounds [0.0, 1.0]
    if (dto.confidence < 0.0 || dto.confidence > 1.0) {
      throw new BadRequestException({
        code: 'INVALID_CONFIDENCE',
        message: 'Confidence must be between 0.0 and 1.0',
        details: { confidence: dto.confidence },
      });
    }

    const client = this.prisma.getClient();

    // 2. Validate Conversation belongs to this workspace
    const conversation = await client.conversation.findFirst({
      where: { id: dto.conversationId, workspaceId },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found in workspace',
        details: { conversationId: dto.conversationId, workspaceId },
      });
    }

    // 3. Validate Message if provided
    if (dto.messageId) {
      const message = await client.message.findFirst({
        where: { id: dto.messageId, workspaceId },
      });
      if (!message) {
        throw new NotFoundException({
          code: 'MESSAGE_NOT_FOUND',
          message: 'Message not found in workspace',
          details: { messageId: dto.messageId, workspaceId },
        });
      }
      if (message.conversationId !== dto.conversationId) {
        throw new BadRequestException({
          code: 'MESSAGE_CONVERSATION_MISMATCH',
          message: 'Message does not belong to the specified conversation',
          details: {
            messageId: dto.messageId,
            messageConversationId: message.conversationId,
            expectedConversationId: dto.conversationId,
          },
        });
      }
    }

    // 4. Validate Lead if provided
    if (dto.leadId) {
      const lead = await client.lead.findFirst({
        where: { id: dto.leadId, workspaceId },
      });
      if (!lead) {
        throw new NotFoundException({
          code: 'LEAD_NOT_FOUND',
          message: 'Lead not found in workspace',
          details: { leadId: dto.leadId, workspaceId },
        });
      }
    }

    // 5. Persist evidence
    const evidence = await client.salesEvidence.create({
      data: {
        workspaceId,
        leadId: dto.leadId || null,
        conversationId: dto.conversationId,
        messageId: dto.messageId || null,
        signalType: dto.signalType as any,
        signalCategory: dto.signalCategory || null,
        confidence: dto.confidence,
        snippet: dto.snippet,
        reason: dto.reason,
        metadata: (dto.metadata || {}) as any,
      },
    });

    const response = formatSalesEvidenceResponse(evidence);

    // 6. Emit domain event
    this.eventEmitter.emit(DomainEvent.SALES_EVIDENCE_DETECTED, {
      workspaceId,
      leadId: evidence.leadId,
      conversationId: evidence.conversationId,
      messageId: evidence.messageId,
      evidence: response,
    });

    this.logger.debug(
      `Sales evidence recorded: ${evidence.id} (${evidence.signalType}) for workspace ${workspaceId}`,
    );

    return response;
  }

  /**
   * Retrieves paginated SalesEvidence for a specific Lead with multi-dimensional filtering.
   */
  async listByLead(
    workspaceId: string,
    leadId: string,
    query: ListLeadEvidenceQueryDto,
  ): Promise<{ items: SalesEvidenceResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();

    // Verify lead belongs to workspace
    const lead = await client.lead.findFirst({
      where: { id: leadId, workspaceId },
    });
    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found in workspace',
        details: { leadId, workspaceId },
      });
    }

    const where: any = {
      workspaceId,
      leadId,
    };

    if (!query.includeInvalidated) {
      where.isInvalidated = false;
    }

    if (query.signalType) {
      where.signalType = query.signalType;
    }

    if (query.minConfidence !== undefined) {
      where.confidence = { gte: query.minConfidence };
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const [total, evidences] = await Promise.all([
      client.salesEvidence.count({ where }),
      client.salesEvidence.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = evidences.map(formatSalesEvidenceResponse);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + items.length < total,
      },
    };
  }

  /**
   * Retrieves SalesEvidence for a specific Conversation thread.
   */
  async listByConversation(
    workspaceId: string,
    conversationId: string,
    query?: Partial<ListLeadEvidenceQueryDto>,
  ): Promise<SalesEvidenceResponseDto[]> {
    const client = this.prisma.getClient();

    // Verify conversation belongs to workspace
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found in workspace',
        details: { conversationId, workspaceId },
      });
    }

    const where: any = {
      workspaceId,
      conversationId,
    };

    if (!query?.includeInvalidated) {
      where.isInvalidated = false;
    }

    if (query?.signalType) {
      where.signalType = query.signalType;
    }

    if (query?.minConfidence !== undefined) {
      where.confidence = { gte: query.minConfidence };
    }

    const evidences = await client.salesEvidence.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return evidences.map(formatSalesEvidenceResponse);
  }

  /**
   * Retrieves active (non-invalidated) SalesEvidence for a specific Message within a Conversation.
   * Used for deduplication in Conversation Intelligence processing.
   */
  async findByMessage(
    workspaceId: string,
    conversationId: string,
    messageId: string,
  ): Promise<SalesEvidenceResponseDto[]> {
    const client = this.prisma.getClient();
    const evidences = await client.salesEvidence.findMany({
      where: {
        workspaceId,
        conversationId,
        messageId,
        isInvalidated: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return evidences.map(formatSalesEvidenceResponse);
  }

  /**
   * Marks a SalesEvidence record as invalidated (False Positive Invalidation).
   * Emits DomainEvent.SALES_EVIDENCE_INVALIDATED to trigger lead score recalculation.
   */
  async invalidateEvidence(
    workspaceId: string,
    id: string,
    userId?: string,
    dto?: InvalidateSalesEvidenceDto,
  ): Promise<SalesEvidenceResponseDto> {
    const client = this.prisma.getClient();

    const existing = await client.salesEvidence.findFirst({
      where: { id, workspaceId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'SALES_EVIDENCE_NOT_FOUND',
        message: 'Sales evidence not found in workspace',
        details: { id, workspaceId },
      });
    }

    const updated = await client.salesEvidence.update({
      where: { id },
      data: {
        isInvalidated: true,
        invalidationReason: dto?.invalidationReason || 'Invalidated by agent',
        invalidatedByUserId: userId || null,
        invalidatedAt: new Date(),
      },
    });

    const response = formatSalesEvidenceResponse(updated);

    // Emit domain event for downstream lead scoring recalculation
    this.eventEmitter.emit(DomainEvent.SALES_EVIDENCE_INVALIDATED, {
      workspaceId,
      leadId: updated.leadId,
      conversationId: updated.conversationId,
      evidenceId: updated.id,
      invalidatedByUserId: userId || null,
      invalidationReason: updated.invalidationReason,
      evidence: response,
    });

    this.logger.log(
      `Sales evidence invalidated: ${id} by user ${userId || 'SYSTEM'}. Reason: ${updated.invalidationReason}`,
    );

    return response;
  }
}
