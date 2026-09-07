import { Injectable, Logger, Optional } from '@nestjs/common';
import { z } from 'zod';
import { CopilotSuggestionType, WsServerEvent } from '@sales-copilot/shared-contracts';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { PromptRegistryService } from '../prompt-registry/prompt-registry.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CopilotContext } from './copilot-context.service';

export interface GeneratedSuggestionItem {
  suggestionType: CopilotSuggestionType;
  title: string;
  content: string;
  actionPayload: Record<string, unknown>;
  confidence: number;
}

const replyDraftLlmSchema = z.object({
  title: z.string(),
  replyContent: z.string(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});

const nextBestActionLlmSchema = z.object({
  title: z.string(),
  action: z.string(),
  description: z.string(),
  confidence: z.number().min(0).max(1),
  params: z.record(z.unknown()).optional().default({}),
});

const battlecardLlmSchema = z.object({
  title: z.string(),
  competitorOrTopic: z.string(),
  keyAdvantages: z.array(z.string()),
  pivotQuestions: z.array(z.string()),
  recommendedResponse: z.string(),
  confidence: z.number().min(0).max(1),
});

const MIN_CONFIDENCE_THRESHOLD = 0.7; // BR-2.5.3

@Injectable()
export class CopilotEngineService {
  private readonly logger = new Logger(CopilotEngineService.name);

  constructor(
    private readonly llmGateway: LlmGatewayService,
    private readonly promptRegistry: PromptRegistryService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  /**
   * Generates structured suggestions (Reply Draft, Next Best Action, Battlecard)
   * based on context. Enforces confidence threshold >= 0.70 (BR-2.5.3).
   */
  async generateStructuredSuggestions(context: CopilotContext): Promise<GeneratedSuggestionItem[]> {
    const {
      workspaceId,
      customerName,
      rawContextSummary,
      latestCustomerMessage,
      competitorOrObjections,
    } = {
      workspaceId: context.workspaceId,
      customerName: context.contactName,
      rawContextSummary: context.rawContextSummary,
      latestCustomerMessage: context.latestCustomerMessage || '',
      competitorOrObjections: context.competitorOrObjections,
    };

    const suggestions: GeneratedSuggestionItem[] = [];

    // 1. Generate Reply Draft
    try {
      const template = await this.promptRegistry.findTemplate(
        workspaceId,
        'COPILOT_DRAFT_REPLY_V1',
      );
      const systemPrompt =
        template?.systemPrompt ||
        'You are an empathetic, consultative B2B sales assistant. Compose a concise, persuasive draft reply directly addressing customer questions.';
      const userPrompt = this.promptRegistry.interpolate(
        template?.userPromptTemplate ||
          'Customer: {{customerName}}\nContext: {{context}}\n\nLatest Inbound:\n{{latestMessage}}',
        {
          customerName,
          context: rawContextSummary,
          latestMessage: latestCustomerMessage,
        },
      );

      const response = await this.llmGateway.generateStructured({
        workspaceId,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nOutput MUST be valid JSON matching schema: { "title": string, "replyContent": string, "confidence": float between 0 and 1, "reasoning": string }`,
          },
          { role: 'user', content: userPrompt },
        ],
        schema: replyDraftLlmSchema,
      });

      if (response.data.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        suggestions.push({
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: response.data.title || 'Bản thảo phản hồi đề xuất',
          content: response.data.replyContent,
          actionPayload: {
            action: 'REPLY_INSERT',
            reasoning: response.data.reasoning || '',
          },
          confidence: response.data.confidence,
        });
      } else {
        this.logger.debug(
          `Reply draft discarded: confidence ${response.data.confidence} < threshold ${MIN_CONFIDENCE_THRESHOLD}`,
        );
      }
    } catch (err: any) {
      this.logger.error(`Failed to generate Reply Draft: ${err.message}`);
    }

    // 2. Generate Next Best Action (NBA)
    try {
      const template = await this.promptRegistry.findTemplate(workspaceId, 'COPILOT_NBA_V1');
      const systemPrompt =
        template?.systemPrompt ||
        'You are an elite Sales Copilot assistant formulating concrete Next Best Actions.';
      const userPrompt = this.promptRegistry.interpolate(
        template?.userPromptTemplate ||
          'Customer: {{customerName}}\nDeal Stage: {{dealStage}}\nSignals:\n{{signals}}\n\nLatest Message:\n{{latestMessage}}',
        {
          customerName,
          dealStage: context.dealStage || 'DISCOVERY',
          signals:
            context.activeSignals.map(s => `${s.signalType}: ${s.snippet}`).join('\n') || 'None',
          latestMessage: latestCustomerMessage,
        },
      );

      const response = await this.llmGateway.generateStructured({
        workspaceId,
        messages: [
          {
            role: 'system',
            content: `${systemPrompt}\nOutput MUST be valid JSON matching schema: { "title": string, "action": "CONVERT_TO_OPPORTUNITY" | "SCHEDULE_DEMO" | "SEND_PRICING" | "UPDATE_STAGE", "description": string, "confidence": float, "params": object }`,
          },
          { role: 'user', content: userPrompt },
        ],
        schema: nextBestActionLlmSchema,
      });

      if (response.data.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        suggestions.push({
          suggestionType: CopilotSuggestionType.NEXT_BEST_ACTION,
          title: response.data.title,
          content: response.data.description,
          actionPayload: {
            action: response.data.action,
            ...(response.data.params || {}),
            defaultAmount: context.estimatedValue || 100000000,
            recommendedStage: 'QUALIFICATION',
          },
          confidence: response.data.confidence,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to generate Next Best Action: ${err.message}`);
    }

    // 3. Generate Battlecard if competitor mentions or objections were detected
    if (competitorOrObjections.length > 0) {
      try {
        const template = await this.promptRegistry.findTemplate(
          workspaceId,
          'COPILOT_BATTLECARD_V1',
        );
        const systemPrompt =
          template?.systemPrompt || 'You are a competitive sales battlecard advisor.';
        const userPrompt = this.promptRegistry.interpolate(
          template?.userPromptTemplate ||
            'Customer: {{customerName}}\nContext: {{context}}\nObjections:\n{{objectionDetails}}\n\nLatest Message:\n{{latestMessage}}',
          {
            customerName,
            context: rawContextSummary,
            objectionDetails: competitorOrObjections
              .map(c => `${c.signalType}: "${c.snippet}" - ${c.reason || ''}`)
              .join('\n'),
            latestMessage: latestCustomerMessage,
          },
        );

        const response = await this.llmGateway.generateStructured({
          workspaceId,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          schema: battlecardLlmSchema,
        });

        if (response.data.confidence >= MIN_CONFIDENCE_THRESHOLD) {
          const content = [
            `**Chủ đề/Đối thủ:** ${response.data.competitorOrTopic}`,
            '',
            '**Điểm khác biệt then chốt:**',
            ...response.data.keyAdvantages.map((adv, idx) => `${idx + 1}. ${adv}`),
            '',
            '**Câu hỏi điều hướng đề xuất:**',
            ...response.data.pivotQuestions.map((q, idx) => `- ${q}`),
            '',
            `**Gợi ý phản hồi:** ${response.data.recommendedResponse}`,
          ].join('\n');

          suggestions.push({
            suggestionType: CopilotSuggestionType.BATTLECARD,
            title: response.data.title || `Battlecard: ${response.data.competitorOrTopic}`,
            content,
            actionPayload: {
              competitorOrTopic: response.data.competitorOrTopic,
              keyAdvantages: response.data.keyAdvantages,
              pivotQuestions: response.data.pivotQuestions,
              recommendedResponse: response.data.recommendedResponse,
            },
            confidence: response.data.confidence,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to generate Battlecard: ${err.message}`);
      }
    }

    return suggestions;
  }

  /**
   * Streams a draft reply directly over WebSocket room `conversation_${conversationId}`
   * with event `copilot.suggestion_chunk` for real-time typewriter effect (< 400ms TTFT).
   */
  async streamReplyDraft(context: CopilotContext, customInstruction?: string): Promise<string> {
    const { workspaceId, conversationId, contactName, rawContextSummary, latestCustomerMessage } =
      context;

    const template = await this.promptRegistry.findTemplate(workspaceId, 'COPILOT_DRAFT_REPLY_V1');
    const systemPrompt =
      template?.systemPrompt ||
      'You are an empathetic, consultative B2B sales assistant. Compose a concise, persuasive draft reply directly addressing customer questions.';
    let userPrompt = this.promptRegistry.interpolate(
      template?.userPromptTemplate ||
        'Customer: {{customerName}}\nContext: {{context}}\n\nLatest Inbound:\n{{latestMessage}}',
      {
        customerName: contactName,
        context: rawContextSummary,
        latestMessage: latestCustomerMessage || '',
      },
    );

    if (customInstruction) {
      userPrompt += `\n\nSales Agent Custom Instruction: ${customInstruction}`;
    }

    const room = `conversation_${conversationId}`;
    let accumulatedContent = '';

    try {
      const stream = this.llmGateway.generateStream({
        workspaceId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      });

      for await (const chunk of stream) {
        if (chunk.chunk) {
          accumulatedContent += chunk.chunk;

          if (this.realtimeGateway?.server) {
            const payload = {
              event: WsServerEvent.COPILOT_SUGGESTION_CHUNK,
              workspaceId,
              data: {
                conversationId,
                chunk: chunk.chunk,
                isFinished: false,
              },
            };
            this.realtimeGateway.server
              .to(room)
              .emit(WsServerEvent.COPILOT_SUGGESTION_CHUNK, payload);
          }
        }
      }

      // Emit finish signal
      if (this.realtimeGateway?.server) {
        const finishedPayload = {
          event: WsServerEvent.COPILOT_SUGGESTION_CHUNK,
          workspaceId,
          data: {
            conversationId,
            chunk: '',
            isFinished: true,
            fullContent: accumulatedContent,
          },
        };
        this.realtimeGateway.server
          .to(room)
          .emit(WsServerEvent.COPILOT_SUGGESTION_CHUNK, finishedPayload);
      }
    } catch (err: any) {
      this.logger.error(`Error during streamReplyDraft: ${err.message}`, err.stack);
      throw err;
    }

    return accumulatedContent;
  }
}
