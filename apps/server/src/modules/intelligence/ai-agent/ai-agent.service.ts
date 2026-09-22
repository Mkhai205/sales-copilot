import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, stepCountIs, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import type {
  AiAgentResult,
  AiDebugMetadata,
  AiToolCallDebug,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';
import {
  AI_AGENT_CONSTANTS,
  calculateEstimatedCostUsd,
  HumanTakeoverAbortError,
} from './ai-agent.constants';
import { AiContextBuilder } from './ai-context.builder';
import { buildAgentTools } from './tools';
import { CommerceToolRegistry } from './tools/commerce-tool.registry';
import { summarizeToolOutput } from './utils/ai-tool-summarizer';

@Injectable()
export class AiAgentService {
  private readonly logger = new Logger(AiAgentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly contextBuilder: AiContextBuilder,
    @Optional() private readonly toolRegistry?: CommerceToolRegistry,
  ) {}

  /**
   * Resolves LanguageModel instance:
   * 1. Per-workspace BYOK (workspace.settings.llmCredentials.geminiApiKey) -> @ai-sdk/google
   * 2. Google Cloud Vertex AI (GOOGLE_APPLICATION_CREDENTIALS) -> @ai-sdk/google-vertex
   * 3. Platform default from GEMINI_API_KEY env -> @ai-sdk/google
   */
  async resolveLanguageModel(workspaceId: string): Promise<LanguageModel> {
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const llmCreds = (settings.llmCredentials as Record<string, unknown>) || {};
    const byokKey = llmCreds.geminiApiKey as string | undefined;

    // 1. Per-workspace BYOK key takes highest precedence for multi-tenant customization
    if (byokKey && byokKey.trim()) {
      this.logger.debug(`Using Workspace BYOK AI Studio key for workspace '${workspaceId}'`);
      const google = createGoogleGenerativeAI({ apiKey: byokKey.trim() });
      return google(AI_AGENT_CONSTANTS.DEFAULT_MODEL);
    }

    // 2. Google Cloud Vertex AI (uses organization GCP credits)
    const vertexCredentials =
      this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const vertexProject =
      this.configService.get<string>('GOOGLE_VERTEX_PROJECT') || process.env.GOOGLE_VERTEX_PROJECT;
    const vertexLocation =
      this.configService.get<string>('GOOGLE_VERTEX_LOCATION') ||
      process.env.GOOGLE_VERTEX_LOCATION ||
      'us-central1';

    if (vertexCredentials && vertexProject) {
      this.logger.debug(
        `Using Google Cloud Vertex AI provider for workspace '${workspaceId}' (project: ${vertexProject}, region: ${vertexLocation})`,
      );
      const vertex = createVertex({
        project: vertexProject,
        location: vertexLocation,
      });
      return vertex(AI_AGENT_CONSTANTS.DEFAULT_MODEL);
    }

    // 3. Platform default Google AI Studio API key
    const envKey = this.configService.get<string>('GEMINI_API_KEY');
    if (envKey && envKey.trim()) {
      this.logger.debug(`Using Google AI Studio default provider for workspace '${workspaceId}'`);
      const google = createGoogleGenerativeAI({ apiKey: envKey.trim() });
      return google(AI_AGENT_CONSTANTS.DEFAULT_MODEL);
    }

    throw new Error(
      `No AI provider available for workspace '${workspaceId}'. Please configure Google Cloud Vertex AI or GEMINI_API_KEY.`,
    );
  }

  /**
   * Resolves Gemini API key (kept for backward-compatibility & unit tests):
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
    const startTime = Date.now();

    // 1. Resolve LanguageModel instance (Workspace BYOK -> GCP Vertex AI -> AI Studio)
    const model = await this.resolveLanguageModel(workspaceId);

    // 2. Build contextual prompt and conversation history
    const { systemPrompt, messages, aiPolicy } = await this.contextBuilder.build(
      workspaceId,
      conversationId,
      inboxId,
    );

    // 4. Build tools scoped by workspaceId closure (never expose workspaceId to LLM params)
    const tools = this.toolRegistry
      ? this.toolRegistry.buildTools(
          {
            workspaceId,
            conversationId,
            policy: aiPolicy,
          },
          model,
        )
      : buildAgentTools({
          workspaceId,
          conversationId,
          policy: aiPolicy,
        });

    this.logger.debug(
      `Executing AI agent loop for conversation '${conversationId}' in workspace '${workspaceId}'`,
    );

    const recordedToolCalls: AiToolCallDebug[] = [];
    let stepCounter = 0;

    // 5. Execute agent loop via Vercel AI SDK generateText
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS),
      temperature: AI_AGENT_CONSTANTS.DEFAULT_TEMPERATURE,

      onStepFinish: async step => {
        stepCounter += 1;

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

        const toolCalls = step.toolCalls || [];
        const toolResults = step.toolResults || [];
        const perf = (step as any).performance;
        const toolExecTimes = perf?.toolExecutionMs || {};
        const stepTimeMs = perf?.stepTimeMs ?? 0;
        const stepTokens = step.usage?.totalTokens ?? 0;
        const tokensStr = stepTokens > 0 ? `+${stepTokens}` : '+0';

        if (toolCalls.length > 0) {
          for (const tc of toolCalls) {
            const toolCallId = tc.toolCallId;
            const toolName = tc.toolName;
            const inputArgs = (tc as any).args ?? (tc as any).input ?? {};
            const matchingResult = toolResults.find(r => r.toolCallId === toolCallId);
            const rawOutput = matchingResult
              ? ((matchingResult as any).output ?? (matchingResult as any).result)
              : undefined;

            const durationMs =
              typeof toolExecTimes[toolCallId] === 'number'
                ? toolExecTimes[toolCallId]
                : Math.round(stepTimeMs / (toolCalls.length || 1));

            const outputSummary = summarizeToolOutput(toolName, rawOutput);

            recordedToolCalls.push({
              name: toolName,
              input: inputArgs,
              outputSummary,
              durationMs,
            });

            // Terminal logging format per Epic 4.2.1
            const inputSummary = JSON.stringify(inputArgs);
            this.logger.log(
              `[AiAgent] Conv ${conversationId} | Step ${stepCounter}/${AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS} | Tool: ${toolName} | Input: ${inputSummary} | Duration: ${durationMs}ms | Tokens: ${tokensStr}`,
            );
          }
        } else {
          this.logger.log(
            `[AiAgent] Conv ${conversationId} | Step ${stepCounter}/${AI_AGENT_CONSTANTS.DEFAULT_MAX_STEPS} | Direct Generation | Duration: ${stepTimeMs}ms | Tokens: ${tokensStr}`,
          );
        }
      },
    });

    const totalDurationMs = Date.now() - startTime;
    const rawUsage = result.usage as any;
    const inputTokens = rawUsage?.inputTokens ?? rawUsage?.promptTokens ?? 0;
    const outputTokens = rawUsage?.outputTokens ?? rawUsage?.completionTokens ?? 0;
    const totalTokens = rawUsage?.totalTokens ?? inputTokens + outputTokens;

    const modelId = (model as any).modelId || AI_AGENT_CONSTANTS.DEFAULT_MODEL;
    const provider = (model as any).provider || 'vertex-ai';
    const estimatedCostUsd = calculateEstimatedCostUsd(modelId, inputTokens, outputTokens);

    const aiDebug: AiDebugMetadata = {
      provider,
      model: modelId,
      stepsCount: result.steps.length,
      totalDurationMs,
      usage: {
        input: inputTokens,
        output: outputTokens,
        total: totalTokens,
      },
      estimatedCostUsd,
      toolCalls: recordedToolCalls,
    };

    return {
      text: result.text,
      stepsCount: result.steps.length,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens,
      },
      aiDebug,
    };
  }
}
