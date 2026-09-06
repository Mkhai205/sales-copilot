import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  LeadGrade,
  LeadScoreFactors,
  LeadScoreHistoryItemDto,
  LeadScoreResponseDto,
  LeadScoreUpdatedEventPayload,
  ListLeadScoreHistoryQueryDto,
  PaginationMeta,
  ScoreTriggerEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { LeadScoringCalculator, LeadScoringCalculatorInput } from './lead-scoring.calculator';

export function formatLeadScoreResponse(record: any): LeadScoreResponseDto {
  const factors =
    typeof record.scoreFactors === 'object' && record.scoreFactors !== null
      ? (record.scoreFactors as LeadScoreFactors)
      : {
          fitScore: 0,
          velocityScore: 0,
          signalScore: 0,
          decayPenalty: 0,
          totalScore: record.score ?? 0,
          breakdown: [],
        };

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    leadId: record.leadId,
    score: record.score,
    grade: record.grade as LeadGrade,
    scoreFactors: factors,
    calculatedAt: new Date(record.calculatedAt || record.createdAt).toISOString(),
    updatedAt: new Date(record.updatedAt || record.calculatedAt || record.createdAt).toISOString(),
  };
}

export function formatLeadScoreHistoryItem(record: any): LeadScoreHistoryItemDto {
  const factors =
    typeof record.scoreFactors === 'object' && record.scoreFactors !== null
      ? (record.scoreFactors as LeadScoreFactors)
      : {
          fitScore: 0,
          velocityScore: 0,
          signalScore: 0,
          decayPenalty: 0,
          totalScore: record.newScore ?? 0,
          breakdown: [],
        };

  return {
    id: record.id,
    workspaceId: record.workspaceId,
    leadId: record.leadId,
    previousScore: record.previousScore,
    newScore: record.newScore,
    delta: record.delta,
    previousGrade: (record.previousGrade as LeadGrade) || null,
    newGrade: (record.newGrade as LeadGrade) || null,
    reason: record.reason,
    eventTrigger: record.eventTrigger as ScoreTriggerEvent,
    scoreFactors: factors,
    createdAt: new Date(record.createdAt).toISOString(),
  };
}

@Injectable()
export class LeadScoringService {
  private readonly logger = new Logger(LeadScoringService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Retrieves the current lead score snapshot for a lead.
   * If no score record exists yet, runs an initial calculation.
   */
  async getScore(workspaceId: string, leadId: string): Promise<LeadScoreResponseDto> {
    const client = this.prisma.getClient();

    // 1. Verify lead exists in the tenant's workspace
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

    // 2. Fetch existing score
    const scoreRecord = await client.leadScore.findFirst({
      where: { workspaceId, leadId },
    });

    if (scoreRecord) {
      return formatLeadScoreResponse(scoreRecord);
    }

    // 3. Fallback: calculate initial score if missing
    return this.recalculateScore(
      workspaceId,
      leadId,
      ScoreTriggerEvent.INITIAL_CALCULATION,
      'Initial calculation on retrieval',
    );
  }

  /**
   * Retrieves paginated audit history of score changes for a lead.
   */
  async getHistory(
    workspaceId: string,
    leadId: string,
    query: ListLeadScoreHistoryQueryDto,
  ): Promise<{ items: LeadScoreHistoryItemDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();

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

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where = { workspaceId, leadId };

    const [total, histories] = await Promise.all([
      client.leadScoreHistory.count({ where }),
      client.leadScoreHistory.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const items = histories.map(formatLeadScoreHistoryItem);

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
   * Recalculates the composite score for a lead, updates database state,
   * creates immutable history (if score/grade changed or trigger requires it),
   * and emits realtime domain events.
   */
  async recalculateScore(
    workspaceId: string,
    leadId: string,
    trigger: ScoreTriggerEvent,
    reason?: string,
    tx?: any,
  ): Promise<LeadScoreResponseDto> {
    const client = tx || this.prisma.getClient();

    // 1. Fetch Lead with Contact
    const lead = await client.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: { contact: true },
    });
    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found in workspace',
        details: { leadId, workspaceId },
      });
    }

    // 2. Fetch active Sales Evidence for this lead
    const evidences = await client.salesEvidence.findMany({
      where: {
        workspaceId,
        leadId,
        isInvalidated: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch latest Conversation & recent messages for velocity computation
    let customerResponseTimeMs: number | null = null;
    let customerMessageCount = 0;

    const conversation = await client.conversation.findFirst({
      where: { workspaceId, contactId: lead.contactId },
      orderBy: { lastActivityAt: 'desc' },
      include: {
        messages: {
          take: 30,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (conversation?.messages && conversation.messages.length > 0) {
      const messages = conversation.messages;
      const contactMsgs = messages.filter((m: any) => m.senderType === SenderType.CONTACT);
      customerMessageCount = contactMsgs.length;

      // Find the latest contact message and any preceding agent message to compute response time
      const latestContactMsg = contactMsgs[0];
      if (latestContactMsg) {
        const contactTime = new Date(latestContactMsg.createdAt).getTime();
        const precedingAgentMsg = messages.find(
          (m: any) =>
            m.senderType === SenderType.USER && new Date(m.createdAt).getTime() < contactTime,
        );
        if (precedingAgentMsg) {
          customerResponseTimeMs = Math.max(
            0,
            contactTime - new Date(precedingAgentMsg.createdAt).getTime(),
          );
        }
      }
    }

    // 4. Check Organization / Title in metadata
    const leadMeta = (lead.metadata as Record<string, unknown>) || {};
    const contactCustomAttr = (lead.contact?.customAttributes as Record<string, unknown>) || {};
    const hasOrgOrTitle = Boolean(
      leadMeta.company ||
      leadMeta.title ||
      leadMeta.organization ||
      leadMeta.role ||
      contactCustomAttr.company ||
      contactCustomAttr.title ||
      contactCustomAttr.organization ||
      contactCustomAttr.role,
    );

    // 5. Build calculator inputs
    const calcInput: LeadScoringCalculatorInput = {
      email: lead.contact?.email || null,
      phoneNumber: lead.contact?.phoneNumber || null,
      hasOrganizationOrTitle: hasOrgOrTitle,
      customerResponseTimeMs,
      customerMessageCount,
      signals: evidences.map((e: any) => ({
        signalType: e.signalType,
        snippet: e.snippet,
        reason: e.reason,
      })),
      lastActivityAt: lead.lastActivityAt,
      createdAt: lead.createdAt,
      now: new Date(),
    };

    const calcResult = LeadScoringCalculator.calculate(calcInput);

    // 6. Fetch previous score for delta calculation
    const existingScoreRecord = await client.leadScore.findFirst({
      where: { workspaceId, leadId },
    });

    const previousScore = existingScoreRecord ? existingScoreRecord.score : 0;
    const previousGrade = existingScoreRecord ? (existingScoreRecord.grade as LeadGrade) : null;

    // Pruning: Write history only when score/grade changed, initial run, or manual recalculation
    const scoreChanged = calcResult.totalScore !== previousScore;
    const gradeChanged = calcResult.grade !== previousGrade;
    const shouldRecordHistory =
      !existingScoreRecord ||
      scoreChanged ||
      gradeChanged ||
      trigger === ScoreTriggerEvent.MANUAL_RECALCULATION;

    // 7. Persist updates
    let updatedScoreRecord: any;

    const executePersistence = async (c: any) => {
      // 7a. Upsert leadScore
      if (existingScoreRecord) {
        updatedScoreRecord = await c.leadScore.update({
          where: { id: existingScoreRecord.id },
          data: {
            score: calcResult.totalScore,
            grade: calcResult.grade,
            scoreFactors: calcResult,
            calculatedAt: new Date(),
          },
        });
      } else {
        updatedScoreRecord = await c.leadScore.create({
          data: {
            workspaceId,
            leadId,
            score: calcResult.totalScore,
            grade: calcResult.grade,
            scoreFactors: calcResult,
            calculatedAt: new Date(),
          },
        });
      }

      // 7b. Update Lead score field & lastActivityAt if message trigger
      const leadUpdateData: any = {
        score: calcResult.totalScore,
      };
      if (trigger === ScoreTriggerEvent.MESSAGE_RECEIVED) {
        leadUpdateData.lastActivityAt = new Date();
      }
      await c.lead.update({
        where: { id: leadId },
        data: leadUpdateData,
      });

      // 7c. Record history entry if applicable
      if (shouldRecordHistory) {
        await c.leadScoreHistory.create({
          data: {
            workspaceId,
            leadId,
            previousScore,
            newScore: calcResult.totalScore,
            delta: calcResult.totalScore - previousScore,
            previousGrade,
            newGrade: calcResult.grade,
            reason: reason || `Recalculation triggered by ${trigger}`,
            eventTrigger: trigger,
            scoreFactors: calcResult,
          },
        });
      }
    };

    if (tx) {
      await executePersistence(tx);
    } else {
      await this.prisma.runInTransaction(async () => {
        await executePersistence(client);
      });
    }

    const response = formatLeadScoreResponse(updatedScoreRecord);

    // 8. Emit DomainEvent.LEAD_SCORE_UPDATED
    const eventPayload: LeadScoreUpdatedEventPayload = {
      workspaceId,
      leadId,
      score: response.score,
      grade: response.grade,
      previousScore: existingScoreRecord ? previousScore : undefined,
      previousGrade: previousGrade ?? undefined,
      scoreFactors: response.scoreFactors,
      triggerReason: trigger,
    };

    this.eventEmitter.emit(DomainEvent.LEAD_SCORE_UPDATED, eventPayload);
    this.eventEmitter.emit('lead_score.updated', eventPayload);

    this.logger.debug(
      `Lead score recalculated for lead '${leadId}' in workspace '${workspaceId}': ` +
        `score=${response.score} (${response.grade}), delta=${response.score - previousScore}, trigger=${trigger}`,
    );

    return response;
  }
}
