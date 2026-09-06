import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Job } from 'bullmq';
import {
  AnalyzeInboundMessageJobDto,
  analyzeInboundMessageJobSchema,
  CONVERSATION_INTELLIGENCE_QUEUE,
  DomainEvent,
} from '@sales-copilot/shared-contracts';
import { ContactsService } from '../contacts/contacts.service';
import { ConversationsService } from '../conversations/conversations.service';
import { LeadsService } from '../leads/leads.service';
import { SalesEvidenceService } from '../sales-evidence/sales-evidence.service';
import { IntentSentimentAnalyzer } from './analyzers/intent-sentiment.analyzer';
import { BantSignalAnalyzer } from './analyzers/bant-signal.analyzer';

@Processor(CONVERSATION_INTELLIGENCE_QUEUE, { concurrency: 5 })
@Injectable()
export class ConversationIntelligenceProcessor extends WorkerHost {
  private readonly logger = new Logger(ConversationIntelligenceProcessor.name);

  constructor(
    private readonly contactsService: ContactsService,
    private readonly conversationsService: ConversationsService,
    private readonly leadsService: LeadsService,
    private readonly salesEvidenceService: SalesEvidenceService,
    private readonly intentSentimentAnalyzer: IntentSentimentAnalyzer,
    private readonly bantSignalAnalyzer: BantSignalAnalyzer,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  /**
   * BullMQ worker handler for analyzing inbound contact messages.
   * Extracts intent, sentiment urgency, and BANT signals, deduplicates evidence,
   * stores to SalesEvidence, and broadcasts completion events.
   */
  async process(job: Job<AnalyzeInboundMessageJobDto>): Promise<any> {
    const rawData = job.data;
    const validatedData = analyzeInboundMessageJobSchema.parse(rawData);

    const { workspaceId, conversationId, messageId, contactId, messageContent } = validatedData;

    this.logger.log(
      `[Worker] Processing conversation intelligence for message ${messageId} in conversation ${conversationId}`,
    );

    // 1. Resolve contactId from conversation if not supplied in job
    let resolvedContactId = contactId || null;
    if (!resolvedContactId) {
      try {
        const conversation = await this.conversationsService.getById(workspaceId, conversationId);
        if (conversation?.contactId) {
          resolvedContactId = conversation.contactId;
        }
      } catch (err: any) {
        this.logger.debug(`Could not resolve conversation ${conversationId}: ${err.message}`);
      }
    }

    // 2. Resolve Contact name if available via ContactsService
    let customerName = 'Customer';
    if (resolvedContactId) {
      try {
        const contact = await this.contactsService.findById(workspaceId, resolvedContactId);
        if (contact?.name) {
          customerName = contact.name;
        }
      } catch (err: any) {
        this.logger.debug(
          `Could not resolve contact name for ${resolvedContactId}: ${err.message}`,
        );
      }
    }

    // 3. Resolve associated Lead for Contact if one exists via LeadsService
    let lead: any = null;
    if (resolvedContactId) {
      try {
        lead = await this.leadsService.findByContactId(workspaceId, resolvedContactId);
      } catch (err: any) {
        this.logger.debug(`No active lead found for contact ${resolvedContactId}: ${err.message}`);
      }
    }

    // 4. Execute Intent & Sentiment analysis via LLM Gateway
    const analysisResult = await this.intentSentimentAnalyzer.analyze({
      workspaceId,
      conversationId,
      messageId,
      latestMessageContent: messageContent,
      customerName,
      contactId: resolvedContactId,
    });

    // 5. Verify BANT signals with verbatim substring matching and confidence threshold >= 0.70
    const verifiedSignals = this.bantSignalAnalyzer.verifySignals(
      analysisResult.signals,
      messageContent,
    );

    // 6. Deduplicate against existing recorded evidence for this message via SalesEvidenceService
    let existingEvidences: any[] = [];
    try {
      existingEvidences = await this.salesEvidenceService.findByMessage(
        workspaceId,
        conversationId,
        messageId,
      );
    } catch (err: any) {
      this.logger.warn(`Could not query existing evidence for deduplication: ${err.message}`);
    }

    const existingSignalTypes = new Set(existingEvidences.map(e => e.signalType));
    let recordedCount = 0;

    for (const signal of verifiedSignals) {
      if (existingSignalTypes.has(signal.signalType)) {
        this.logger.debug(
          `Skipping duplicate signal ${signal.signalType} already recorded for message ${messageId}`,
        );
        continue;
      }

      try {
        await this.salesEvidenceService.recordEvidence(workspaceId, {
          leadId: lead?.id || null,
          conversationId,
          messageId,
          signalType: signal.signalType,
          confidence: signal.confidence,
          snippet: signal.snippet,
          reason:
            signal.reasoning ||
            `Detected by Conversation Intelligence Engine (${analysisResult.intent})`,
          metadata: {
            ...signal.metadata,
            intent: analysisResult.intent,
            sentimentPolarity: analysisResult.sentiment.polarity,
            urgency: analysisResult.sentiment.urgency,
          },
        });
        recordedCount++;
      } catch (err: any) {
        this.logger.error(
          `Failed to record sales evidence for signal ${signal.signalType}: ${err.message}`,
          err.stack,
        );
      }
    }

    // 6. Broadcast completion domain event
    this.eventEmitter.emit(DomainEvent.CONVERSATION_INTELLIGENCE_ANALYZED, {
      workspaceId,
      conversationId,
      messageId,
      leadId: lead?.id || null,
      intent: analysisResult.intent,
      sentiment: analysisResult.sentiment,
      signalsCount: verifiedSignals.length,
      detectedSignals: verifiedSignals,
    });

    this.logger.log(
      `[Worker] Conversation intelligence finished for message ${messageId}: ${verifiedSignals.length} signals verified, ${recordedCount} new evidence records created.`,
    );

    return {
      messageId,
      intent: analysisResult.intent,
      urgency: analysisResult.sentiment.urgency,
      signalsVerified: verifiedSignals.length,
      signalsRecorded: recordedCount,
    };
  }
}
