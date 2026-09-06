import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  BuyingSignalType,
  ConversationIntent,
  DomainEvent,
  SentimentPolarity,
  UrgencyLevel,
} from '@sales-copilot/shared-contracts';
import { ConversationIntelligenceProcessor } from '../conversation-intelligence.processor';
import { BantSignalAnalyzer } from '../analyzers/bant-signal.analyzer';

describe('ConversationIntelligenceProcessor (BullMQ Worker Host & Evidence Persistence)', () => {
  let processor: ConversationIntelligenceProcessor;
  let mockContactsService: any;
  let mockConversationsService: any;
  let mockLeadsService: any;
  let mockSalesEvidenceService: any;
  let mockIntentSentimentAnalyzer: any;
  let bantSignalAnalyzer: BantSignalAnalyzer;
  let mockEventEmitter: any;

  let recordedEvidences: any[] = [];
  let emittedEvents: Array<{ event: string; payload: any }> = [];
  let existingEvidencesInDb: any[] = [];

  const wsId = '123e4567-e89b-12d3-a456-426614174000';
  const convId = '123e4567-e89b-12d3-a456-426614174001';
  const msgId = 'msg-worker-1';
  const contactId = 'contact-worker-1';
  const leadId = 'lead-worker-1';

  beforeEach(() => {
    recordedEvidences = [];
    emittedEvents = [];
    existingEvidencesInDb = [];

    mockContactsService = {
      findById: async (workspaceId: string, ctId: string) => {
        if (ctId === contactId) {
          return { id: contactId, name: 'Nguyễn Văn A', workspaceId };
        }
        return { id: ctId, name: 'Other Customer', workspaceId };
      },
    };

    mockConversationsService = {
      getById: async (workspaceId: string, id: string) => ({
        id,
        workspaceId,
        contactId,
      }),
    };

    mockLeadsService = {
      findByContactId: async (workspaceId: string, ctId: string) => {
        if (ctId === contactId) {
          return { id: leadId, contactId, workspaceId };
        }
        return null;
      },
    };

    mockSalesEvidenceService = {
      findByMessage: async () => existingEvidencesInDb,
      recordEvidence: async (workspaceId: string, dto: any) => {
        const record = { id: `evi-${recordedEvidences.length + 1}`, workspaceId, ...dto };
        recordedEvidences.push(record);
        return record;
      },
    };

    bantSignalAnalyzer = new BantSignalAnalyzer();

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };
  });

  it('should process job, verify BANT signals, record SalesEvidence and emit analyzed event', async () => {
    const messageContent =
      'Bên anh đã duyệt ngân sách 150 triệu, dự kiến triển khai trước ngày 30/11';

    mockIntentSentimentAnalyzer = {
      analyze: async () => ({
        intent: ConversationIntent.PURCHASE_INTENT,
        sentiment: {
          polarity: SentimentPolarity.POSITIVE,
          score: 0.9,
          urgency: UrgencyLevel.HIGH,
          reasoning: 'Strong buying intention',
        },
        signals: [
          {
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.95,
            snippet: 'ngân sách 150 triệu',
            reasoning: 'Budget stated',
          },
          {
            signalType: 'TIMELINE_STATED',
            confidence: 0.92,
            snippet: 'dự kiến triển khai trước ngày 30/11',
            reasoning: 'Timeline defined',
          },
        ],
        summary: 'Customer ready to deploy',
      }),
    };

    processor = new ConversationIntelligenceProcessor(
      mockContactsService,
      mockConversationsService,
      mockLeadsService,
      mockSalesEvidenceService,
      mockIntentSentimentAnalyzer,
      bantSignalAnalyzer,
      mockEventEmitter,
    );

    const job: any = {
      data: {
        workspaceId: wsId,
        conversationId: convId,
        messageId: msgId,
        contactId,
        messageContent,
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.intent, ConversationIntent.PURCHASE_INTENT);
    assert.strictEqual(result.signalsVerified, 2);
    assert.strictEqual(result.signalsRecorded, 2);
    assert.strictEqual(recordedEvidences.length, 2);

    // First evidence: BUDGET_CONFIRMED
    assert.strictEqual(recordedEvidences[0].leadId, leadId);
    assert.strictEqual(recordedEvidences[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);
    assert.strictEqual(recordedEvidences[0].snippet, 'ngân sách 150 triệu');
    assert.strictEqual(recordedEvidences[0].confidence, 0.95);

    // Second evidence: TIMELINE_DEFINED (mapped from TIMELINE_STATED)
    assert.strictEqual(recordedEvidences[1].signalType, BuyingSignalType.TIMELINE_DEFINED);
    assert.strictEqual(recordedEvidences[1].snippet, 'dự kiến triển khai trước ngày 30/11');

    // Check CONVERSATION_INTELLIGENCE_ANALYZED event
    const analyzedEvent = emittedEvents.find(
      e => e.event === DomainEvent.CONVERSATION_INTELLIGENCE_ANALYZED,
    );
    assert.ok(analyzedEvent);
    assert.strictEqual(analyzedEvent.payload.workspaceId, wsId);
    assert.strictEqual(analyzedEvent.payload.leadId, leadId);
    assert.strictEqual(analyzedEvent.payload.signalsCount, 2);
  });

  it('should fallback to resolving contactId from conversation when job has no contactId', async () => {
    const messageContent = 'Ngân sách 100 triệu';

    mockIntentSentimentAnalyzer = {
      analyze: async (params: any) => {
        assert.strictEqual(params.contactId, contactId);
        assert.strictEqual(params.customerName, 'Nguyễn Văn A');
        return {
          intent: ConversationIntent.PRICING_INQUIRY,
          sentiment: {
            polarity: SentimentPolarity.NEUTRAL,
            score: 0.0,
            urgency: UrgencyLevel.LOW,
          },
          signals: [
            {
              signalType: BuyingSignalType.BUDGET_CONFIRMED,
              confidence: 0.9,
              snippet: 'Ngân sách 100 triệu',
            },
          ],
        };
      },
    };

    processor = new ConversationIntelligenceProcessor(
      mockContactsService,
      mockConversationsService,
      mockLeadsService,
      mockSalesEvidenceService,
      mockIntentSentimentAnalyzer,
      bantSignalAnalyzer,
      mockEventEmitter,
    );

    const job: any = {
      data: {
        workspaceId: wsId,
        conversationId: convId,
        messageId: msgId,
        contactId: null, // contactId omitted
        messageContent,
      },
    };

    const result = await processor.process(job);
    assert.strictEqual(result.signalsRecorded, 1);
  });

  it('should deduplicate and skip signals already recorded for the same message', async () => {
    const messageContent = 'Ngân sách 200 triệu';
    existingEvidencesInDb = [{ signalType: BuyingSignalType.BUDGET_CONFIRMED }];

    mockIntentSentimentAnalyzer = {
      analyze: async () => ({
        intent: ConversationIntent.PRICING_INQUIRY,
        sentiment: {
          polarity: SentimentPolarity.NEUTRAL,
          score: 0.0,
          urgency: UrgencyLevel.MEDIUM,
        },
        signals: [
          {
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.9,
            snippet: 'Ngân sách 200 triệu',
          },
        ],
      }),
    };

    processor = new ConversationIntelligenceProcessor(
      mockContactsService,
      mockConversationsService,
      mockLeadsService,
      mockSalesEvidenceService,
      mockIntentSentimentAnalyzer,
      bantSignalAnalyzer,
      mockEventEmitter,
    );

    const job: any = {
      data: {
        workspaceId: wsId,
        conversationId: convId,
        messageId: msgId,
        contactId,
        messageContent,
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.signalsVerified, 1);
    assert.strictEqual(result.signalsRecorded, 0); // Duplicate skipped
    assert.strictEqual(recordedEvidences.length, 0);
  });

  it('should handle contact with no associated lead (stores leadId: null)', async () => {
    const messageContent = 'Tôi là Trưởng phòng IT bên công ty ABC';

    mockIntentSentimentAnalyzer = {
      analyze: async () => ({
        intent: ConversationIntent.GENERAL_INQUIRY,
        sentiment: {
          polarity: SentimentPolarity.NEUTRAL,
          score: 0.1,
          urgency: UrgencyLevel.LOW,
        },
        signals: [
          {
            signalType: BuyingSignalType.AUTHORITY_IDENTIFIED,
            confidence: 0.95,
            snippet: 'Trưởng phòng IT',
            reasoning: 'Decision maker role',
          },
        ],
      }),
    };

    processor = new ConversationIntelligenceProcessor(
      mockContactsService,
      mockConversationsService,
      mockLeadsService,
      mockSalesEvidenceService,
      mockIntentSentimentAnalyzer,
      bantSignalAnalyzer,
      mockEventEmitter,
    );

    const job: any = {
      data: {
        workspaceId: wsId,
        conversationId: convId,
        messageId: msgId,
        contactId: 'contact-without-lead',
        messageContent,
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.signalsRecorded, 1);
    assert.strictEqual(recordedEvidences[0].leadId, null);
    assert.strictEqual(recordedEvidences[0].signalType, BuyingSignalType.AUTHORITY_IDENTIFIED);
  });
});
