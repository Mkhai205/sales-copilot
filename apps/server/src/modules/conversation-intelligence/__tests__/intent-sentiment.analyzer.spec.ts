import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ConversationIntent,
  ConversationPriority,
  DomainEvent,
  SentimentPolarity,
  UrgencyLevel,
} from '@sales-copilot/shared-contracts';
import { IntentSentimentAnalyzer } from '../analyzers/intent-sentiment.analyzer';

describe('IntentSentimentAnalyzer (Classification & Urgency Escalation)', () => {
  let analyzer: IntentSentimentAnalyzer;
  let mockMessagesService: any;
  let mockConversationsService: any;
  let mockPromptRegistryService: any;
  let mockLlmGatewayService: any;
  let mockEventEmitter: any;

  let priorityUpdatedTo: any = null;
  let emittedEvents: Array<{ event: string; payload: any }> = [];

  const wsId = 'ws-test-01';
  const convId = 'conv-test-01';
  const msgId = 'msg-test-01';

  beforeEach(() => {
    priorityUpdatedTo = null;
    emittedEvents = [];

    mockMessagesService = {
      getRecentMessages: async () => [
        {
          id: 'msg-old-1',
          senderType: 'USER',
          content: 'Xin chào, em có thể hỗ trợ gì cho anh ạ?',
        },
        {
          id: msgId,
          senderType: 'CONTACT',
          content: 'Sản phẩm lỗi nhiều quá, bên anh đang xem xét hủy hợp đồng!',
        },
      ],
    };

    mockConversationsService = {
      updatePriority: async (workspaceId: string, conversationId: string, dto: any) => {
        priorityUpdatedTo = dto.priority;
        return { id: conversationId, priority: dto.priority };
      },
    };

    mockPromptRegistryService = {
      renderPrompt: async () => ({
        systemPrompt: 'System instruction with JSON schema',
        userPrompt: 'Rendered prompt content',
      }),
    };

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };
  });

  it('should classify intent, sentiment and NOT escalate for normal purchase inquiry', async () => {
    mockLlmGatewayService = {
      generateStructured: async () => ({
        data: {
          intent: ConversationIntent.PURCHASE_INTENT,
          sentiment: {
            polarity: SentimentPolarity.POSITIVE,
            score: 0.85,
            urgency: UrgencyLevel.HIGH,
            reasoning: 'Customer expresses strong readiness to buy',
          },
          signals: [
            {
              signalType: 'BUDGET_CONFIRMED',
              confidence: 0.95,
              snippet: 'ngân sách 200 triệu',
              reasoning: 'Budget verified',
            },
          ],
          summary: 'Customer wants enterprise tier',
        },
      }),
    };

    analyzer = new IntentSentimentAnalyzer(
      mockMessagesService,
      mockConversationsService,
      mockPromptRegistryService,
      mockLlmGatewayService,
      mockEventEmitter,
    );

    const result = await analyzer.analyze({
      workspaceId: wsId,
      conversationId: convId,
      messageId: msgId,
      latestMessageContent: 'Bên mình có gói 200 triệu không?',
    });

    assert.strictEqual(result.intent, ConversationIntent.PURCHASE_INTENT);
    assert.strictEqual(result.sentiment.polarity, SentimentPolarity.POSITIVE);
    assert.strictEqual(result.sentiment.urgency, UrgencyLevel.HIGH);
    // Not CRITICAL and not CHURN_RISK -> no priority escalation
    assert.strictEqual(priorityUpdatedTo, null);
    assert.strictEqual(emittedEvents.length, 0);
  });

  it('should auto-escalate priority to URGENT and emit urgent alert when sentiment is CRITICAL', async () => {
    mockLlmGatewayService = {
      generateStructured: async () => ({
        data: {
          intent: ConversationIntent.TECHNICAL_SUPPORT,
          sentiment: {
            polarity: SentimentPolarity.NEGATIVE,
            score: -0.9,
            urgency: UrgencyLevel.CRITICAL,
            reasoning: 'Severe system blockage impacting business operations',
          },
          signals: [],
          summary: 'Critical production bug reported',
        },
      }),
    };

    analyzer = new IntentSentimentAnalyzer(
      mockMessagesService,
      mockConversationsService,
      mockPromptRegistryService,
      mockLlmGatewayService,
      mockEventEmitter,
    );

    const result = await analyzer.analyze({
      workspaceId: wsId,
      conversationId: convId,
      messageId: msgId,
      latestMessageContent: 'Hệ thống chết hoàn toàn cả buổi sáng, sửa ngay!',
    });

    assert.strictEqual(result.sentiment.urgency, UrgencyLevel.CRITICAL);
    assert.strictEqual(priorityUpdatedTo, ConversationPriority.URGENT);

    const alertEvent = emittedEvents.find(e => e.event === DomainEvent.CONVERSATION_URGENT_ALERT);
    assert.ok(alertEvent, 'Should emit CONVERSATION_URGENT_ALERT');
    assert.strictEqual(alertEvent.payload.urgency, UrgencyLevel.CRITICAL);
    assert.strictEqual(alertEvent.payload.conversationId, convId);
  });

  it('should auto-escalate priority and alert when intent is CHURN_RISK', async () => {
    mockLlmGatewayService = {
      generateStructured: async () => ({
        data: {
          intent: ConversationIntent.CHURN_RISK,
          sentiment: {
            polarity: SentimentPolarity.NEGATIVE,
            score: -0.8,
            urgency: UrgencyLevel.HIGH,
            reasoning: 'Customer threatened to cancel enterprise contract',
          },
          signals: [],
          summary: 'Churn threat due to recurring downtime',
        },
      }),
    };

    analyzer = new IntentSentimentAnalyzer(
      mockMessagesService,
      mockConversationsService,
      mockPromptRegistryService,
      mockLlmGatewayService,
      mockEventEmitter,
    );

    const result = await analyzer.analyze({
      workspaceId: wsId,
      conversationId: convId,
      messageId: msgId,
      latestMessageContent: 'Tôi yêu cầu hoàn tiền và hủy hợp đồng ngay hôm nay!',
    });

    assert.strictEqual(result.intent, ConversationIntent.CHURN_RISK);
    assert.strictEqual(priorityUpdatedTo, ConversationPriority.URGENT);

    const alertEvent = emittedEvents.find(e => e.event === DomainEvent.CONVERSATION_URGENT_ALERT);
    assert.ok(alertEvent);
    assert.strictEqual(alertEvent.payload.intent, ConversationIntent.CHURN_RISK);
  });
});
