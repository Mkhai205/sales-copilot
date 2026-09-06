import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  ConversationIntent,
  SentimentPolarity,
  UrgencyLevel,
  CONVERSATION_INTELLIGENCE_QUEUE,
  ANALYZE_INBOUND_MESSAGE_JOB,
  conversationIntentSchema,
  sentimentPolaritySchema,
  urgencyLevelSchema,
  sentimentResultSchema,
  detectedSignalSchema,
  conversationIntelligenceResultSchema,
  analyzeInboundMessageJobSchema,
  conversationIntelligenceAnalyzedEventSchema,
  conversationUrgentAlertEventSchema,
  BuyingSignalType,
  DomainEvent,
  WsServerEvent,
} from '../index';

describe('Conversation Intelligence Shared Contracts (Epic 2.4)', () => {
  describe('Enums & Constants', () => {
    it('should have correct queue and job name constants', () => {
      assert.strictEqual(CONVERSATION_INTELLIGENCE_QUEUE, 'conversation-intelligence');
      assert.strictEqual(ANALYZE_INBOUND_MESSAGE_JOB, 'analyze-inbound-message');
    });

    it('should validate ConversationIntent enum values', () => {
      assert.strictEqual(
        conversationIntentSchema.parse('PRICING_INQUIRY'),
        ConversationIntent.PRICING_INQUIRY,
      );
      assert.strictEqual(
        conversationIntentSchema.parse('CHURN_RISK'),
        ConversationIntent.CHURN_RISK,
      );
      assert.strictEqual(
        conversationIntentSchema.parse('PURCHASE_INTENT'),
        ConversationIntent.PURCHASE_INTENT,
      );
      assert.throws(() => conversationIntentSchema.parse('UNKNOWN_INTENT'));
    });

    it('should validate SentimentPolarity enum values', () => {
      assert.strictEqual(sentimentPolaritySchema.parse('POSITIVE'), SentimentPolarity.POSITIVE);
      assert.strictEqual(sentimentPolaritySchema.parse('NEUTRAL'), SentimentPolarity.NEUTRAL);
      assert.strictEqual(sentimentPolaritySchema.parse('NEGATIVE'), SentimentPolarity.NEGATIVE);
      assert.throws(() => sentimentPolaritySchema.parse('VERY_POSITIVE'));
    });

    it('should validate UrgencyLevel enum values', () => {
      assert.strictEqual(urgencyLevelSchema.parse('LOW'), UrgencyLevel.LOW);
      assert.strictEqual(urgencyLevelSchema.parse('CRITICAL'), UrgencyLevel.CRITICAL);
      assert.throws(() => urgencyLevelSchema.parse('MAXIMUM'));
    });

    it('should verify DomainEvent and WsServerEvent include conversation intelligence events', () => {
      assert.strictEqual(
        DomainEvent.CONVERSATION_INTELLIGENCE_ANALYZED,
        'conversation.intelligence_analyzed',
      );
      assert.strictEqual(DomainEvent.CONVERSATION_URGENT_ALERT, 'conversation.urgent_alert');
      assert.strictEqual(
        WsServerEvent.CONVERSATION_INTELLIGENCE_ANALYZED,
        'conversation.intelligence_analyzed',
      );
      assert.strictEqual(WsServerEvent.CONVERSATION_URGENT_ALERT, 'conversation.urgent_alert');
    });
  });

  describe('sentimentResultSchema', () => {
    it('should validate valid sentiment payload', () => {
      const valid = {
        polarity: SentimentPolarity.POSITIVE,
        score: 0.85,
        urgency: UrgencyLevel.HIGH,
        reasoning: 'Customer expressed clear excitement',
      };
      const parsed = sentimentResultSchema.parse(valid);
      assert.strictEqual(parsed.polarity, SentimentPolarity.POSITIVE);
      assert.strictEqual(parsed.score, 0.85);
      assert.strictEqual(parsed.urgency, UrgencyLevel.HIGH);
      assert.strictEqual(parsed.reasoning, 'Customer expressed clear excitement');
    });

    it('should accept default empty reasoning', () => {
      const valid = {
        polarity: SentimentPolarity.NEUTRAL,
        score: 0.0,
        urgency: UrgencyLevel.LOW,
      };
      const parsed = sentimentResultSchema.parse(valid);
      assert.strictEqual(parsed.reasoning, '');
    });

    it('should reject score out of range [-1.0, 1.0]', () => {
      assert.throws(() => {
        sentimentResultSchema.parse({
          polarity: SentimentPolarity.POSITIVE,
          score: 1.5,
          urgency: UrgencyLevel.MEDIUM,
        });
      });
      assert.throws(() => {
        sentimentResultSchema.parse({
          polarity: SentimentPolarity.NEGATIVE,
          score: -1.2,
          urgency: UrgencyLevel.CRITICAL,
        });
      });
    });
  });

  describe('detectedSignalSchema', () => {
    it('should validate valid detected signal and coerce TIMELINE_STATED', () => {
      const input = {
        signalType: 'TIMELINE_STATED',
        confidence: 0.92,
        snippet: 'triển khai trong tháng 11',
        reasoning: 'Customer provided explicit deadline',
      };
      const parsed = detectedSignalSchema.parse(input);
      assert.strictEqual(parsed.signalType, BuyingSignalType.TIMELINE_DEFINED);
      assert.strictEqual(parsed.confidence, 0.92);
      assert.strictEqual(parsed.snippet, 'triển khai trong tháng 11');
      assert.deepStrictEqual(parsed.metadata, {});
    });

    it('should reject confidence outside [0.0, 1.0]', () => {
      assert.throws(() => {
        detectedSignalSchema.parse({
          signalType: BuyingSignalType.BUDGET_CONFIRMED,
          confidence: -0.1,
          snippet: 'ngân sách 200tr',
        });
      });
      assert.throws(() => {
        detectedSignalSchema.parse({
          signalType: BuyingSignalType.BUDGET_CONFIRMED,
          confidence: 1.2,
          snippet: 'ngân sách 200tr',
        });
      });
    });
  });

  describe('conversationIntelligenceResultSchema', () => {
    it('should validate complete LLM structured output', () => {
      const raw = {
        intent: 'PURCHASE_INTENT',
        sentiment: {
          polarity: 'POSITIVE',
          score: 0.9,
          urgency: 'HIGH',
          reasoning: 'High intent to buy enterprise plan',
        },
        signals: [
          {
            signalType: 'BUDGET_CONFIRMED',
            confidence: 0.95,
            snippet: 'Ngân sách 200 triệu',
            reasoning: 'Explicit budget stated',
          },
        ],
        summary: 'Customer ready to buy',
      };
      const parsed = conversationIntelligenceResultSchema.parse(raw);
      assert.strictEqual(parsed.intent, ConversationIntent.PURCHASE_INTENT);
      assert.strictEqual(parsed.signals.length, 1);
      assert.strictEqual(parsed.signals[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);
    });
  });

  describe('analyzeInboundMessageJobSchema', () => {
    it('should validate valid job payload', () => {
      const payload = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        conversationId: '123e4567-e89b-12d3-a456-426614174001',
        messageId: 'msg_123',
        contactId: 'contact_456',
        messageContent: 'Báo giá cho tôi gói enterprise',
      };
      const parsed = analyzeInboundMessageJobSchema.parse(payload);
      assert.strictEqual(parsed.messageId, 'msg_123');
      assert.strictEqual(parsed.contactId, 'contact_456');
    });

    it('should reject invalid UUIDs for workspace or conversation', () => {
      assert.throws(() => {
        analyzeInboundMessageJobSchema.parse({
          workspaceId: 'not-a-uuid',
          conversationId: '123e4567-e89b-12d3-a456-426614174001',
          messageId: 'msg_123',
          messageContent: 'test',
        });
      });
    });
  });
});
