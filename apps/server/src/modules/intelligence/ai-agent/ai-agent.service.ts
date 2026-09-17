import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, stepCountIs } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import type { AiAgentResult } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import { AI_AGENT_CONSTANTS, HumanTakeoverAbortError } from './ai-agent.constants';
import { AiContextBuilder } from './ai-context.builder';
import { buildAgentTools } from './tools';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly contextBuilder: AiContextBuilder,
  ) {}

  /**
   * Resolves Gemini API key:
   * 1. Per-workspace BYOK (workspace.settings.llmCredentials.geminiApiKey)
   * 2. Platform default from GEMINI_API_KEY env
   */
  async resolveApiKey(workspaceId: string): Promise<string> {
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const llmCreds = (settings.llmCredentials as Record<string, unknown>) || {};
    const byokKey = llmCreds.geminiApiKey as string | undefined;

    if (byokKey && byokKey.trim()) {
      return byokKey.trim();
    }

    const envKey = this.configService.get<string>('GEMINI_API_KEY');
    if (envKey && envKey.trim()) {
      return envKey.trim();
    }

    throw new Error(
      `No Gemini API key available for workspace '${workspaceId}'. Please configure GEMINI_API_KEY in environment or workspace BYOK.`,
    );
  }

  /**
   * Runs the full reasoning & tool-calling loop using Vercel AI SDK.
   */
  async processConversation(
    workspaceId: string,
    conversationId: string,
    inboxId: string,
  ): Promise<AiAgentResult> {
    // 1. Resolve API key
    const apiKey = await this.resolveApiKey(workspaceId);

    // 2. Build contextual prompt and conversation history
    const { systemPrompt, messages, aiPolicy } = await this.contextBuilder.build(
      workspaceId,
      conversationId,
      inboxId,
    );

    // 3. Build tools scoped by workspaceId closure (never expose workspaceId to LLM params)
    const tools = buildAgentTools({
      workspaceId,
      conversationId,
      policy: aiPolicy as unknown as Record<string, unknown>,
    });

    // 4. Initialize Google provider with resolved key
    const google = createGoogleGenerativeAI({ apiKey });
    const model = google(AI_AGENT_CONSTANTS.DEFAULT_MODEL);

    this.logger.debug(
      `Executing AI agent loop for conversation '${conversationId}' in workspace '${workspaceId}'`,
    );

    // 5. Execute agent loop via Vercel AI SDK generateText
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS),
      temperature: AI_AGENT_CONSTANTS.DEFAULT_TEMPERATURE,

      onStepFinish: async step => {
        // Human Takeover check mid-loop: if paused, immediately abort
        const conv = await this.prisma.getClient().conversation.findFirst({
          where: { id: conversationId, workspaceId },
          select: { isAiPaused: true },
        });

        if (conv?.isAiPaused) {
          this.logger.warn(
            `Human takeover detected during agent step in conversation '${conversationId}'. Aborting loop.`,
          );
          throw new HumanTakeoverAbortError();
        }

        this.logger.debug(
          `Agent step completed for conv '${conversationId}': ${step.toolCalls?.length ?? 0} tool calls, text generated: ${Boolean(step.text)}`,
        );
      },
    });

    let textResponse = result.text?.trim();

    // 6. Handle edge case: Max steps reached without textual answer
    if (!textResponse && result.steps.length >= AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS) {
      this.logger.warn(
        `Agent loop reached maxSteps (${AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS}) for conversation '${conversationId}'. Auto-pausing AI and sending fallback.`,
      );

      // Auto-pause conversation so human staff can step in
      await this.prisma.getClient().conversation.updateMany({
        where: { id: conversationId, workspaceId },
        data: { isAiPaused: true },
      });

      textResponse = AI_AGENT_CONSTANTS.FALLBACK_MESSAGE;
    }

    const usage = {
      promptTokens: (result.usage as any)?.inputTokens ?? (result.usage as any)?.promptTokens ?? 0,
      completionTokens:
        (result.usage as any)?.outputTokens ?? (result.usage as any)?.completionTokens ?? 0,
      totalTokens: result.usage?.totalTokens ?? 0,
    };

    return {
      text: textResponse || AI_AGENT_CONSTANTS.FALLBACK_MESSAGE,
      stepsCount: result.steps.length,
      usage,
    };
  }
}
