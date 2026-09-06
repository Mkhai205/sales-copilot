import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  TimelineEventType,
  type TimelineEventDto,
  type TimelineQueryDto,
  type TimelineResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  compareTimelineEvents,
  decodeCursor,
  encodeCursor,
  isEventOlderThanCursor,
} from './timeline-cursor.helper';

@Injectable()
export class ActivityTimelineService {
  private readonly logger = new Logger(ActivityTimelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates a unified chronological activity timeline for a Lead across
   * messages, internal notes, AI sales evidence, and status changes.
   */
  async getLeadTimeline(
    workspaceId: string,
    leadId: string,
    query: TimelineQueryDto,
  ): Promise<TimelineResponseDto> {
    const client = this.prisma.getClient();

    // 1. Verify Lead exists within workspace and retrieve associated contact
    const lead = await client.lead.findFirst({
      where: { id: leadId, workspaceId },
      include: {
        contact: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (!lead) {
      throw new NotFoundException({
        code: 'LEAD_NOT_FOUND',
        message: 'Lead not found in workspace',
        details: { leadId, workspaceId },
      });
    }

    // 2. Fetch conversations associated with this contact in the workspace
    const conversations = await client.conversation.findMany({
      where: { workspaceId, contactId: lead.contactId },
      select: { id: true },
    });
    const conversationIds = conversations.map(c => c.id);

    const limit = Math.min(100, Math.max(1, query.limit || 20));
    // Overfetch buffer to ensure accurate sorting across multiple data streams
    const fetchTake = limit * 5;

    // 3. Execute parallel queries across heterogeneous data sources
    const [messages, salesEvidences, auditLogs] = await Promise.all([
      // Source 1: Messages & Notes from all conversations of the Contact
      conversationIds.length > 0
        ? client.message.findMany({
            where: {
              workspaceId,
              conversationId: { in: conversationIds },
            },
            take: fetchTake,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([]),

      // Source 2: Active Sales Evidence linked to the Lead
      client.salesEvidence.findMany({
        where: {
          workspaceId,
          leadId,
          isInvalidated: false,
        },
        take: fetchTake,
        orderBy: { createdAt: 'desc' },
      }),

      // Source 3: Lead Status Changes, Conversions, and Assignments
      client.auditLog.findMany({
        where: {
          workspaceId,
          resourceType: 'lead',
          resourceId: leadId,
        },
        include: {
          user: {
            select: { id: true, name: true, avatarUrl: true },
          },
        },
        take: fetchTake,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // 4. Normalize all heterogeneous data models into TimelineEventDto
    const allEvents: TimelineEventDto[] = [];

    // 4a. Process Messages & Notes
    for (const msg of messages) {
      const isNote = Boolean(msg.isPrivate);
      const eventType = isNote ? TimelineEventType.NOTE : TimelineEventType.MESSAGE;

      let actorName: string;
      let actorType: 'CONTACT' | 'USER' | 'SYSTEM' = 'CONTACT';
      let actorId = lead.contactId;
      let avatarUrl: string | null = lead.contact?.avatarUrl || null;

      if (msg.senderType === 'USER') {
        actorType = 'USER';
        actorId = msg.senderId || 'agent';
        actorName = 'Sales Agent';
        avatarUrl = null;
      } else if (msg.senderType === 'SYSTEM') {
        actorType = 'SYSTEM';
        actorId = 'system';
        actorName = 'System';
        avatarUrl = null;
      } else {
        actorName = lead.contact?.name || 'Customer';
      }

      const summary = msg.content
        ? msg.content.length > 120
          ? `${msg.content.substring(0, 117)}...`
          : msg.content
        : isNote
          ? 'Internal note added'
          : 'Customer message';

      allEvents.push({
        id: msg.id,
        type: eventType,
        timestamp: new Date(msg.createdAt).toISOString(),
        actor: {
          id: actorId,
          name: actorName,
          type: actorType,
          avatarUrl,
        },
        summary,
        payload: {
          messageId: msg.id,
          conversationId: msg.conversationId,
          contentType: msg.contentType,
          isPrivate: msg.isPrivate,
          content: msg.content,
        },
      });
    }

    // 4b. Process Sales Evidence
    for (const evi of salesEvidences) {
      allEvents.push({
        id: evi.id,
        type: TimelineEventType.SALES_EVIDENCE,
        timestamp: new Date(evi.createdAt).toISOString(),
        actor: {
          id: 'ai_copilot',
          name: 'AI Conversation Intelligence',
          type: 'SYSTEM',
        },
        summary: `[${evi.signalType}] ${evi.snippet}`,
        payload: {
          evidenceId: evi.id,
          conversationId: evi.conversationId,
          signalType: evi.signalType,
          signalCategory: evi.signalCategory,
          confidence: Number(evi.confidence),
          snippet: evi.snippet,
          reason: evi.reason,
        },
      });
    }

    // 4c. Process Audit Logs (Status Changes & Assignments)
    for (const log of auditLogs) {
      const isAssignment = log.action?.toUpperCase().includes('ASSIGN');
      const eventType = isAssignment
        ? TimelineEventType.ASSIGNMENT
        : TimelineEventType.STATUS_CHANGE;

      const actor = log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            type: 'USER' as const,
            avatarUrl: log.user.avatarUrl || null,
          }
        : {
            id: 'system',
            name: 'System',
            type: 'SYSTEM' as const,
          };

      allEvents.push({
        id: log.id,
        type: eventType,
        timestamp: new Date(log.createdAt).toISOString(),
        actor,
        summary: log.action || 'Lead status updated',
        payload: (log.payload as Record<string, unknown>) || {},
      });
    }

    // 5. Apply event type filtering if requested
    let filteredEvents = allEvents;
    const requestedTypes: TimelineEventType[] = Array.isArray(query.types)
      ? (query.types as TimelineEventType[])
      : typeof query.types === 'string'
        ? (query.types as string).split(',').map(s => s.trim().toUpperCase() as TimelineEventType)
        : [];

    if (requestedTypes.length > 0) {
      const allowedTypes = new Set(requestedTypes);
      filteredEvents = filteredEvents.filter(e => allowedTypes.has(e.type));
    }

    // 6. Apply date range filters if specified
    if (query.dateFrom) {
      const fromTime = new Date(query.dateFrom).getTime();
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp).getTime() >= fromTime);
    }
    if (query.dateTo) {
      const toTime = new Date(query.dateTo).getTime();
      filteredEvents = filteredEvents.filter(e => new Date(e.timestamp).getTime() <= toTime);
    }

    // 7. Sort all combined events in reverse chronological order (newest first)
    filteredEvents.sort(compareTimelineEvents);

    // 8. Apply cursor-based pagination
    if (query.cursor) {
      const decodedCursor = decodeCursor(query.cursor);
      if (decodedCursor) {
        filteredEvents = filteredEvents.filter(e => isEventOlderThanCursor(e, decodedCursor));
      }
    }

    // 9. Slice to limit + 1 to determine if there are older records
    const hasMore = filteredEvents.length > limit;
    const paginatedItems = filteredEvents.slice(0, limit);

    const nextCursor =
      hasMore && paginatedItems.length > 0
        ? encodeCursor(
            paginatedItems[paginatedItems.length - 1].timestamp,
            paginatedItems[paginatedItems.length - 1].id,
          )
        : null;

    return {
      items: paginatedItems,
      meta: {
        limit,
        hasMore,
        nextCursor,
      },
    };
  }
}
