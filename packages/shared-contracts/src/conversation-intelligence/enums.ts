import { z } from 'zod';

export enum ConversationIntent {
  PRICING_INQUIRY = 'PRICING_INQUIRY',
  PRODUCT_DEMO = 'PRODUCT_DEMO',
  FEATURE_COMPARISON = 'FEATURE_COMPARISON',
  TECHNICAL_SUPPORT = 'TECHNICAL_SUPPORT',
  PURCHASE_INTENT = 'PURCHASE_INTENT',
  CHURN_RISK = 'CHURN_RISK',
  GENERAL_INQUIRY = 'GENERAL_INQUIRY',
}

export const conversationIntentSchema = z.nativeEnum(ConversationIntent);

export enum SentimentPolarity {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

export const sentimentPolaritySchema = z.nativeEnum(SentimentPolarity);

export enum UrgencyLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export const urgencyLevelSchema = z.nativeEnum(UrgencyLevel);

export const CONVERSATION_INTELLIGENCE_QUEUE = 'conversation-intelligence';
export const ANALYZE_INBOUND_MESSAGE_JOB = 'analyze-inbound-message';
