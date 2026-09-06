import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database';
import { ContactsService } from '../contacts/contacts.service';
import { LeadsService } from '../leads/leads.service';
import { LeadScoringService } from '../lead-scoring/lead-scoring.service';
import { SalesEvidenceService } from '../sales-evidence/sales-evidence.service';
import { SenderType } from '@sales-copilot/shared-contracts';

export interface CopilotContext {
  workspaceId: string;
  conversationId: string;
  contactId: string;
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  leadId?: string | null;
  dealStage?: string | null;
  dealScore?: number | null;
  dealGrade?: string | null;
  estimatedValue?: number | null;
  currency?: string | null;
  activeSignals: Array<{
    signalType: string;
    snippet: string;
    confidence: number;
    reason?: string;
  }>;
  recentMessages: Array<{ senderType: string; content: string; createdAt: string }>;
  latestCustomerMessage?: string;
  competitorOrObjections: Array<{ snippet: string; signalType: string; reason?: string }>;
  rawContextSummary: string;
}

const MAX_CONTEXT_CHARS = 12000; // ~3000 tokens safe budget limit

@Injectable()
export class CopilotContextService {
  private readonly logger = new Logger(CopilotContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly contactsService: ContactsService,
    private readonly leadsService: LeadsService,
    private readonly leadScoringService: LeadScoringService,
    private readonly salesEvidenceService: SalesEvidenceService,
  ) {}

  /**
   * Synthesizes full sales intelligence context for a conversation thread.
   */
  async buildContext(
    workspaceId: string,
    conversationId: string,
    messageId?: string,
  ): Promise<CopilotContext> {
    const client = this.prisma.getClient();

    // 1. Fetch conversation with tenant scope
    const conversation = await client.conversation.findFirst({
      where: { id: conversationId, workspaceId },
      include: {
        contact: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: `Conversation with id '${conversationId}' not found in workspace`,
      });
    }

    const contactId = conversation.contactId;
    let contact = conversation.contact;
    if (!contact) {
      try {
        const contactDto = await this.contactsService.findById(workspaceId, contactId);
        contact = contactDto as any;
      } catch (err: any) {
        this.logger.warn(`Could not fetch contact ${contactId}: ${err.message}`);
      }
    }

    const contactName = contact?.name || 'Khách hàng';
    const contactEmail = contact?.email || null;
    const contactPhone = contact?.phoneNumber || null;

    // 2. Fetch recent 10 messages (chronological order)
    const rawMessages = await client.message.findMany({
      where: {
        conversationId,
        workspaceId,
        isPrivate: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Reverse to chronological order (oldest to newest)
    const messages = rawMessages.reverse();

    const formattedMessages = messages.map(m => ({
      senderType: m.senderType,
      content: m.content || '',
      createdAt: m.createdAt.toISOString(),
    }));

    // Find latest customer message
    let latestCustomerMessage: string | undefined;
    if (messageId) {
      const targetMsg = messages.find(m => m.id === messageId);
      if (targetMsg && targetMsg.content) {
        latestCustomerMessage = targetMsg.content;
      }
    }

    if (!latestCustomerMessage) {
      const lastInbound = [...messages].reverse().find(m => m.senderType === SenderType.CONTACT);
      latestCustomerMessage = lastInbound?.content || messages[messages.length - 1]?.content || '';
    }

    // 3. Deal & Lead stage
    let leadId: string | null = null;
    let dealStage: string | null = null;
    let dealScore: number | null = null;
    let dealGrade: string | null = null;
    let estimatedValue: number | null = null;
    let currency: string | null = 'USD';

    try {
      const lead = await this.leadsService.findByContactId(workspaceId, contactId);
      if (lead) {
        leadId = lead.id;
        dealStage = lead.stage;
        dealScore = lead.score;
        dealGrade = lead.grade;
        estimatedValue = lead.estimatedValue;
        currency = lead.currency;

        // Fetch up-to-date score from LeadScoringService
        try {
          const scoreDto = await this.leadScoringService.getScore(workspaceId, lead.id);
          if (scoreDto) {
            dealScore = scoreDto.score;
            dealGrade = scoreDto.grade;
          }
        } catch {
          // Fall back to lead's stored score
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not resolve lead for contact ${contactId}: ${err.message}`);
    }

    // 4. Sales Evidence signals
    let activeSignals: Array<{
      signalType: string;
      snippet: string;
      confidence: number;
      reason?: string;
    }> = [];
    try {
      const evidences = await this.salesEvidenceService.listByConversation(
        workspaceId,
        conversationId,
        {
          includeInvalidated: false,
        },
      );
      activeSignals = evidences.map(e => ({
        signalType: e.signalType,
        snippet: e.snippet,
        confidence: e.confidence,
        reason: e.reason,
      }));
    } catch (err: any) {
      this.logger.warn(`Could not list sales evidence: ${err.message}`);
    }

    const competitorOrObjections = activeSignals.filter(
      s => s.signalType === 'COMPETITOR_MENTION' || s.signalType === 'OBJECTION_RAISED',
    );

    // 5. Build raw context summary string with token/character budgeting
    const historyLines = formattedMessages.map(
      m => `[${m.senderType === SenderType.CONTACT ? 'Customer' : 'Agent'}]: ${m.content}`,
    );

    const signalsLines = activeSignals.map(
      s => `- ${s.signalType} (${Math.round(s.confidence * 100)}% confidence): "${s.snippet}"`,
    );

    let rawContextSummary = [
      `Customer: ${contactName} (${contactEmail || contactPhone || 'No contact info'})`,
      dealStage
        ? `Deal Stage: ${dealStage}, Score: ${dealScore ?? 0} (${dealGrade || 'COLD'})`
        : 'No active deal',
      signalsLines.length > 0
        ? `Active Signals:\n${signalsLines.join('\n')}`
        : 'No explicit signals detected yet',
      `Recent Conversation History:\n${historyLines.join('\n')}`,
    ].join('\n\n');

    // Bound context to prevent exceeding token window
    if (rawContextSummary.length > MAX_CONTEXT_CHARS) {
      rawContextSummary = rawContextSummary.slice(-MAX_CONTEXT_CHARS);
    }

    return {
      workspaceId,
      conversationId,
      contactId,
      contactName,
      contactEmail,
      contactPhone,
      leadId,
      dealStage,
      dealScore,
      dealGrade,
      estimatedValue,
      currency,
      activeSignals,
      recentMessages: formattedMessages,
      latestCustomerMessage,
      competitorOrObjections,
      rawContextSummary,
    };
  }
}
