import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ConversationIntent,
  ConversationPriority,
  ConversationIntelligenceResultDto,
  conversationIntelligenceResultSchema,
  DomainEvent,
  LlmProvider,
  UrgencyLevel,
} from '@sales-copilot/shared-contracts';
import { MessagesService } from '../../messages/messages.service';
import { ConversationsService } from '../../conversations/conversations.service';
import { PromptRegistryService } from '../../prompt-registry/prompt-registry.service';
import { LlmGatewayService } from '../../llm-gateway/llm-gateway.service';

export interface AnalyzeIntentSentimentParams {
  workspaceId: string;
  conversationId: string;
  messageId: string;
  latestMessageContent: string;
  customerName?: string;
  contactId?: string | null;
}

@Injectable()
export class IntentSentimentAnalyzer {
  private readonly logger = new Logger(IntentSentimentAnalyzer.name);

  constructor(
    private readonly messagesService: MessagesService,
    private readonly conversationsService: ConversationsService,
    private readonly promptRegistryService: PromptRegistryService,
    private readonly llmGatewayService: LlmGatewayService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Executes intent classification, sentiment analysis, and buying signal extraction
   * using LLM Gateway and Prompt Registry.
   * Auto-escalates conversation priority and triggers urgent alert if CRITICAL urgency or CHURN_RISK is detected.
   */
  async analyze(params: AnalyzeIntentSentimentParams): Promise<ConversationIntelligenceResultDto> {
    const {
      workspaceId,
      conversationId,
      messageId,
      latestMessageContent,
      customerName = 'Customer',
      contactId,
    } = params;

    // 1. Sliding window context: retrieve last 10 messages
    let recentMessages: any[] = [];
    try {
      recentMessages = await this.messagesService.getRecentMessages(
        workspaceId,
        conversationId,
        10,
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to retrieve recent messages for context in conversation ${conversationId}: ${err.message}`,
      );
    }

    // Format previous messages history (truncate older messages to 300 chars to conserve tokens)
    const previousMessages = recentMessages.filter(m => m.id !== messageId);
    const conversationHistory =
      previousMessages.length > 0
        ? previousMessages
            .map(m => `[${m.senderType}]: ${m.content ? m.content.slice(0, 300) : ''}`)
            .join('\n')
        : 'No prior messages in conversation.';

    // Budget latest message up to 2000 chars
    const truncatedLatestMessage = latestMessageContent.slice(0, 2000);

    // 2. Render CONV_INTELLIGENCE_V1 prompt
    const rendered = await this.promptRegistryService.renderPrompt(
      workspaceId,
      'CONV_INTELLIGENCE_V1',
      {
        customerName,
        conversationHistory,
        latestMessage: truncatedLatestMessage,
      },
    );

    // 3. Invoke LLM Gateway with Structured Output validation
    const structured =
      await this.llmGatewayService.generateStructured<ConversationIntelligenceResultDto>({
        workspaceId,
        messages: [
          { role: 'system', content: rendered.systemPrompt },
          { role: 'user', content: rendered.userPrompt },
        ],
        schema: conversationIntelligenceResultSchema,
        preferredProvider: LlmProvider.GEMINI,
        options: {
          temperature: 0.1,
        },
      });

    const result = structured.data;

    // 4. Critical Urgency or Churn Risk Auto-escalation
    const isCritical = result.sentiment.urgency === UrgencyLevel.CRITICAL;
    const isChurnRisk = result.intent === ConversationIntent.CHURN_RISK;

    if (isCritical || isChurnRisk) {
      this.logger.warn(
        `Urgent condition detected for conversation ${conversationId} (Urgency: ${result.sentiment.urgency}, Intent: ${result.intent}). Auto-escalating priority to URGENT.`,
      );

      try {
        await this.conversationsService.updatePriority(workspaceId, conversationId, {
          priority: ConversationPriority.URGENT,
        });
      } catch (err: any) {
        this.logger.error(`Failed to escalate conversation priority to URGENT: ${err.message}`);
      }

      // Emit high-priority urgent alert domain event
      this.eventEmitter.emit(DomainEvent.CONVERSATION_URGENT_ALERT, {
        workspaceId,
        conversationId,
        messageId,
        contactId: contactId || null,
        urgency: result.sentiment.urgency,
        intent: result.intent,
        sentimentScore: result.sentiment.score,
        snippet: latestMessageContent.slice(0, 200),
        reasoning:
          result.sentiment.reasoning ||
          (isChurnRisk
            ? 'Customer exhibits churn risk behaviors or threats to cancel'
            : 'Critical urgency detected requiring immediate response'),
      });
    }

    return result;
  }
}
