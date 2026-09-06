import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ANALYZE_INBOUND_MESSAGE_JOB,
  BuyingSignalType,
  ConversationIntent,
  ConversationPriority,
  DomainEvent,
  MessageContentType,
  SenderType,
  SentimentPolarity,
  UrgencyLevel,
  WsServerEvent,
} from '@sales-copilot/shared-contracts';
import { ConversationIntelligenceListener } from '../conversation-intelligence.listener';
import { ConversationIntelligenceProcessor } from '../conversation-intelligence.processor';
import { IntentSentimentAnalyzer } from '../analyzers/intent-sentiment.analyzer';
import { BantSignalAnalyzer } from '../analyzers/bant-signal.analyzer';
import { RealtimeEventDispatcher } from '../../realtime/realtime-event.dispatcher';

describe('Conversation Intelligence Pipeline E2E Integration (T2.4.8)', () => {
  let eventEmitter: EventEmitter2;
  let listener: ConversationIntelligenceListener;
  let processor: ConversationIntelligenceProcessor;
  let intentSentimentAnalyzer: IntentSentimentAnalyzer;
  let bantSignalAnalyzer: BantSignalAnalyzer;
  let realtimeDispatcher: RealtimeEventDispatcher;

  let mockQueue: any;
  let enqueuedJobs: Array<{ name: string; data: any; opts: any }>;
  let recordedEvidences: any[];
  let wsBroadcasts: Array<{ room: string; event: string; payload: any }>;
  let conversationPriority: ConversationPriority;

  const workspaceId = '123e4567-e89b-12d3-a456-426614174000';
  const conversationId = '123e4567-e89b-12d3-a456-426614174001';
  const messageId = 'msg-pipeline-01';
  const contactId = 'contact-pipeline-01';
  const leadId = 'lead-pipeline-01';

  beforeEach(() => {
    eventEmitter = new EventEmitter2();
    enqueuedJobs = [];
    recordedEvidences = [];
    wsBroadcasts = [];
    conversationPriority = ConversationPriority.LOW;

    // 1. Mock BullMQ Queue
    mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        enqueuedJobs.push({ name, data, opts });
        return { id: opts?.jobId || 'job-id' };
      },
    };

    // 2. Wire Listener
    listener = new ConversationIntelligenceListener(mockQueue);
    eventEmitter.on(DomainEvent.MESSAGE_CREATED, p => listener.handleMessageCreated(p));

    // 3. Mock Upstream Services
    const mockMessagesService: any = {
      getRecentMessages: async () => [
        {
          id: messageId,
          senderType: SenderType.CONTACT,
          content:
            'Bên mình đã duyệt ngân sách 200 triệu, dự kiến triển khai trước 30/11 cho 50 nhân viên.',
        },
      ],
    };

    const mockConversationsService: any = {
      getById: async () => ({
        id: conversationId,
        workspaceId,
        contactId,
        priority: conversationPriority,
      }),
      updatePriority: async (_wsId: string, _cId: string, dto: any) => {
        conversationPriority = dto.priority;
        return { id: conversationId, priority: dto.priority };
      },
    };

    const mockContactsService: any = {
      findById: async () => ({
        id: contactId,
        name: 'Trần Văn Bảo',
        workspaceId,
      }),
    };

    const mockLeadsService: any = {
      findByContactId: async () => ({
        id: leadId,
        contactId,
        workspaceId,
        status: 'QUALIFIED',
      }),
    };

    const mockSalesEvidenceService: any = {
      findByMessage: async (_wsId: string, _cId: string, mId: string) => {
        return recordedEvidences.filter(e => e.messageId === mId);
      },
      recordEvidence: async (wsId: string, dto: any) => {
        const evidence = {
          id: `evi-${recordedEvidences.length + 1}`,
          workspaceId: wsId,
          ...dto,
          createdAt: new Date().toISOString(),
        };
        recordedEvidences.push(evidence);

        // Emit domain event as SalesEvidenceService does
        eventEmitter.emit(DomainEvent.SALES_EVIDENCE_DETECTED, {
          workspaceId: wsId,
          leadId: dto.leadId,
          conversationId: dto.conversationId,
          messageId: dto.messageId,
          evidence,
        });

        return evidence;
      },
    };

    const mockPromptRegistryService: any = {
      renderPrompt: async () => ({
        systemPrompt: 'System instructions with strict schema',
        userPrompt: 'Rendered user prompt',
      }),
    };

    // 4. Analyzers
    bantSignalAnalyzer = new BantSignalAnalyzer();

    const mockLlmResponse: any = {
      data: {
        intent: ConversationIntent.PURCHASE_INTENT,
        sentiment: {
          polarity: SentimentPolarity.POSITIVE,
          score: 0.92,
          urgency: UrgencyLevel.HIGH,
          reasoning: 'Strong commercial readiness with confirmed budget and timeline',
        },
        signals: [
          {
            signalType: BuyingSignalType.BUDGET_CONFIRMED,
            confidence: 0.95,
            snippet: 'duyệt ngân sách 200 triệu',
            reasoning: 'Explicit approved budget of 200 million VND',
          },
          {
            signalType: 'TIMELINE_STATED',
            confidence: 0.88,
            snippet: 'triển khai trước 30/11',
            reasoning: 'Target deployment deadline before Nov 30',
          },
          {
            signalType: BuyingSignalType.COMPETITOR_MENTION,
            confidence: 0.45, // Below 0.70 threshold -> must be filtered
            snippet: 'Zendesk',
            reasoning: 'Low confidence competitor mention',
          },
        ],
        summary: 'Lead expresses intent to sign enterprise contract',
      },
    };

    const mockLlmGatewayService: any = {
      generateStructured: async () => mockLlmResponse,
    };

    intentSentimentAnalyzer = new IntentSentimentAnalyzer(
      mockMessagesService,
      mockConversationsService,
      mockPromptRegistryService,
      mockLlmGatewayService,
      eventEmitter,
    );

    // 5. Wire Processor
    processor = new ConversationIntelligenceProcessor(
      mockContactsService,
      mockConversationsService,
      mockLeadsService,
      mockSalesEvidenceService,
      intentSentimentAnalyzer,
      bantSignalAnalyzer,
      eventEmitter,
    );

    // 6. Realtime Dispatcher
    const mockSocketServer: any = {
      server: {
        to: (room: string) => ({
          emit: (event: string, payload: any) => {
            wsBroadcasts.push({ room, event, payload });
          },
        }),
      },
    };

    realtimeDispatcher = new RealtimeEventDispatcher(mockSocketServer);

    eventEmitter.on(DomainEvent.CONVERSATION_INTELLIGENCE_ANALYZED, p =>
      realtimeDispatcher.handleConversationIntelligenceAnalyzed(p),
    );
    eventEmitter.on(DomainEvent.CONVERSATION_URGENT_ALERT, p =>
      realtimeDispatcher.handleConversationUrgentAlert(p),
    );
    eventEmitter.on(DomainEvent.SALES_EVIDENCE_DETECTED, p =>
      realtimeDispatcher.handleSalesEvidenceDetected(p),
    );
  });

  it('should execute complete pipeline from message.created to SalesEvidence persistence & realtime broadcast', async () => {
    const inboundMessage = {
      id: messageId,
      conversationId,
      senderType: SenderType.CONTACT,
      senderId: contactId,
      isPrivate: false,
      contentType: MessageContentType.TEXT,
      content:
        'Bên mình đã duyệt ngân sách 200 triệu, dự kiến triển khai trước 30/11 cho 50 nhân viên.',
    };

    // Step 1: Inbound message arrives -> message.created emitted
    eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
      workspaceId,
      conversationId,
      message: inboundMessage,
    });

    // Step 2: Listener enqueues job into BullMQ
    assert.strictEqual(enqueuedJobs.length, 1);
    const enqueuedJob = enqueuedJobs[0];
    assert.strictEqual(enqueuedJob.name, ANALYZE_INBOUND_MESSAGE_JOB);
    assert.strictEqual(enqueuedJob.data.messageId, messageId);
    assert.strictEqual(enqueuedJob.opts.jobId, `job:analyze:${messageId}`);

    // Step 3: BullMQ Worker processes the job
    const jobResult = await processor.process({
      data: enqueuedJob.data,
    } as any);

    assert.strictEqual(jobResult.intent, ConversationIntent.PURCHASE_INTENT);
    assert.strictEqual(jobResult.signalsVerified, 2); // 2 signals >= 0.70, 1 filtered out (< 0.70)
    assert.strictEqual(jobResult.signalsRecorded, 2);

    // Step 4: Verify SalesEvidence persistence
    assert.strictEqual(recordedEvidences.length, 2);

    const budgetEvidence = recordedEvidences.find(
      e => e.signalType === BuyingSignalType.BUDGET_CONFIRMED,
    );
    assert.ok(budgetEvidence);
    assert.strictEqual(budgetEvidence.snippet, 'duyệt ngân sách 200 triệu');
    assert.strictEqual(budgetEvidence.leadId, leadId);
    assert.strictEqual(budgetEvidence.confidence, 0.95);

    const timelineEvidence = recordedEvidences.find(
      e => e.signalType === BuyingSignalType.TIMELINE_DEFINED,
    );
    assert.ok(timelineEvidence, 'TIMELINE_STATED must be normalized to TIMELINE_DEFINED');
    assert.strictEqual(timelineEvidence.snippet, 'triển khai trước 30/11');

    // Step 5: Verify WebSocket Realtime Dispatch
    // Check sales_evidence.detected was dispatched to conversation room
    const convEvidenceBroadcast = wsBroadcasts.find(
      b =>
        b.room === `conversation_${conversationId}` &&
        b.event === WsServerEvent.SALES_EVIDENCE_DETECTED,
    );
    assert.ok(
      convEvidenceBroadcast,
      'Should broadcast sales_evidence.detected to conversation room',
    );

    // Check conversation.intelligence_analyzed dispatched to workspace and conversation rooms
    const convAnalyzedBroadcast = wsBroadcasts.find(
      b =>
        b.room === `conversation_${conversationId}` &&
        b.event === WsServerEvent.CONVERSATION_INTELLIGENCE_ANALYZED,
    );
    assert.ok(convAnalyzedBroadcast, 'Should broadcast intelligence_analyzed to conversation room');

    const wsAnalyzedBroadcast = wsBroadcasts.find(
      b =>
        b.room === `workspace_${workspaceId}` &&
        b.event === WsServerEvent.CONVERSATION_INTELLIGENCE_ANALYZED,
    );
    assert.ok(wsAnalyzedBroadcast, 'Should broadcast intelligence_analyzed to workspace room');
  });

  it('should auto-escalate priority to URGENT and broadcast urgent alert on CHURN_RISK', async () => {
    // Override analyzer with CHURN_RISK response
    const churnLlmResponse = {
      data: {
        intent: ConversationIntent.CHURN_RISK,
        sentiment: {
          polarity: SentimentPolarity.NEGATIVE,
          score: -0.85,
          urgency: UrgencyLevel.HIGH,
          reasoning: 'Customer threatens contract termination due to bugs',
        },
        signals: [],
        summary: 'Customer unhappy with recurring bugs',
      },
    };

    const mockLlmGateway: any = {
      generateStructured: async () => churnLlmResponse,
    };

    const churnAnalyzer = new IntentSentimentAnalyzer(
      { getRecentMessages: async () => [] } as any,
      {
        updatePriority: async (_w: string, _c: string, dto: any) => {
          conversationPriority = dto.priority;
          return { id: conversationId, priority: dto.priority };
        },
      } as any,
      { renderPrompt: async () => ({ systemPrompt: '', userPrompt: '' }) } as any,
      mockLlmGateway,
      eventEmitter,
    );

    const churnProcessor = new ConversationIntelligenceProcessor(
      { findById: async () => ({ id: contactId, name: 'Khách Hàng' }) } as any,
      { getById: async () => ({ id: conversationId, contactId }) } as any,
      { findByContactId: async () => null } as any,
      { findByMessage: async () => [], recordEvidence: async () => ({}) } as any,
      churnAnalyzer,
      bantSignalAnalyzer,
      eventEmitter,
    );

    await churnProcessor.process({
      data: {
        workspaceId,
        conversationId,
        messageId: 'msg-churn-01',
        contactId,
        messageContent: 'Phần mềm lỗi quá, bên tôi sẽ dừng hợp đồng ngay!',
      },
    } as any);

    // Priority must be auto-escalated
    assert.strictEqual(conversationPriority, ConversationPriority.URGENT);

    // WebSocket urgent alert broadcast must be sent
    const urgentBroadcast = wsBroadcasts.find(
      b =>
        b.room === `workspace_${workspaceId}` &&
        b.event === WsServerEvent.CONVERSATION_URGENT_ALERT,
    );
    assert.ok(urgentBroadcast, 'Should broadcast urgent alert to workspace room');
    assert.strictEqual(urgentBroadcast.payload.data.intent, ConversationIntent.CHURN_RISK);
  });

  it('should ignore non-contact messages and private notes from entering pipeline', async () => {
    // 1. Agent message
    eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
      workspaceId,
      conversationId,
      message: {
        id: 'msg-agent',
        conversationId,
        senderType: SenderType.USER,
        isPrivate: false,
        contentType: MessageContentType.TEXT,
        content: 'Chào anh, bên em có thể hỗ trợ gì ạ?',
      },
    });

    // 2. Private note
    eventEmitter.emit(DomainEvent.MESSAGE_CREATED, {
      workspaceId,
      conversationId,
      message: {
        id: 'msg-note',
        conversationId,
        senderType: SenderType.CONTACT,
        isPrivate: true,
        contentType: MessageContentType.TEXT,
        content: 'Ghi chú nội bộ bí mật',
      },
    });

    assert.strictEqual(
      enqueuedJobs.length,
      0,
      'No jobs should be enqueued for agent or private messages',
    );
  });
});
