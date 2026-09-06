import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  LlmProvider,
  PromptTemplateCreateDto,
  PromptTemplateFilterDto,
  PromptTemplateUpdateDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { PromptSanitizer } from './prompt-sanitizer';

export interface BuiltInPromptPreset {
  name: string;
  version: number;
  provider: LlmProvider;
  model: string;
  systemPrompt: string;
  userPromptTemplate: string;
  inputVariables: string[];
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
  isActive: boolean;
}

export const BUILT_IN_PROMPTS: Record<string, BuiltInPromptPreset> = {
  CONV_INTELLIGENCE_V1: {
    name: 'CONV_INTELLIGENCE_V1',
    version: 1,
    provider: LlmProvider.GEMINI,
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are an expert conversation intelligence engine for an enterprise sales platform. Extract customer buying intent, sentiment, and BANT sales evidence signals from incoming messages with verbatim quotes and confidence scores. Output strictly valid JSON.',
    userPromptTemplate:
      'Analyze the conversation for customer {{customerName}}.\n\nConversation Context:\n{{conversationHistory}}\n\nLatest Inbound Message:\n<user_input>\n{{latestMessage}}\n</user_input>\n\nOutput MUST be a single valid JSON object strictly matching this schema:\n{\n  "intent": "PRICING_INQUIRY" | "PRODUCT_DEMO" | "FEATURE_COMPARISON" | "TECHNICAL_SUPPORT" | "PURCHASE_INTENT" | "CHURN_RISK" | "GENERAL_INQUIRY",\n  "sentiment": {\n    "polarity": "POSITIVE" | "NEUTRAL" | "NEGATIVE",\n    "score": <float -1.0 to 1.0>,\n    "urgency": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",\n    "reasoning": "<string>"\n  },\n  "signals": [\n    {\n      "signalType": "BUDGET_CONFIRMED" | "AUTHORITY_IDENTIFIED" | "NEED_EXPRESSED" | "TIMELINE_DEFINED" | "COMPETITOR_MENTION" | "OBJECTION_RAISED" | "PURCHASE_INTENT" | "CHURN_RISK" | "ENGAGEMENT_SPIKE" | "PAIN_POINT" | "POSITIVE_SENTIMENT",\n      "confidence": <float 0.0 to 1.0>,\n      "snippet": "<exact verbatim quote from user input>",\n      "reasoning": "<string>",\n      "metadata": {}\n    }\n  ],\n  "summary": "<string>"\n}\n\nCRITICAL RULES:\n1. Every signal\'s snippet MUST be an EXACT verbatim substring found directly in the latest inbound message or conversation context. Never paraphrase or hallucinate quotes.\n2. Do NOT wrap output in markdown fences; respond with JSON only.',
    inputVariables: ['customerName', 'conversationHistory', 'latestMessage'],
    temperature: 0.1,
    maxTokens: 1024,
    isDefault: true,
    isActive: true,
  },
  COPILOT_NBA_V1: {
    name: 'COPILOT_NBA_V1',
    version: 1,
    provider: LlmProvider.GEMINI,
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are an elite Sales Copilot assistant. Evaluate the conversation timeline, deal stage, and identified objections to formulate concrete Next Best Actions (NBA) for the sales agent.',
    userPromptTemplate:
      'Customer: {{customerName}}\nDeal Stage: {{dealStage}}\nActive Signals & Objections:\n{{signals}}\n\nLatest Message:\n<user_input>\n{{latestMessage}}\n</user_input>',
    inputVariables: ['customerName', 'dealStage', 'signals', 'latestMessage'],
    temperature: 0.3,
    maxTokens: 1024,
    isDefault: true,
    isActive: true,
  },
  COPILOT_DRAFT_REPLY_V1: {
    name: 'COPILOT_DRAFT_REPLY_V1',
    version: 1,
    provider: LlmProvider.GEMINI,
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are an empathetic, consultative B2B sales assistant. Compose a concise, persuasive draft reply directly addressing the customer questions or objections in professional Vietnamese.',
    userPromptTemplate:
      'Customer Name: {{customerName}}\nContext:\n{{context}}\n\nCustomer Inbound Message:\n<user_input>\n{{latestMessage}}\n</user_input>',
    inputVariables: ['customerName', 'context', 'latestMessage'],
    temperature: 0.7,
    maxTokens: 1024,
    isDefault: true,
    isActive: true,
  },
  COPILOT_BATTLECARD_V1: {
    name: 'COPILOT_BATTLECARD_V1',
    version: 1,
    provider: LlmProvider.GEMINI,
    model: 'gemini-2.5-flash',
    systemPrompt:
      'You are a competitive sales battlecard advisor. When a prospect mentions a competitor or raises objections, generate 3 clear differentiation points and strategic pivot questions to steer the conversation positively. Output strictly valid JSON.',
    userPromptTemplate:
      'Customer: {{customerName}}\nContext:\n{{context}}\nObjection/Competitor details:\n{{objectionDetails}}\n\nLatest Inbound Message:\n<user_input>\n{{latestMessage}}\n</user_input>\n\nOutput JSON with structure:\n{\n  "title": "<short battlecard title>",\n  "competitorOrTopic": "<name of competitor or objection topic>",\n  "keyAdvantages": ["<point 1>", "<point 2>", "<point 3>"],\n  "pivotQuestions": ["<question 1>", "<question 2>"],\n  "recommendedResponse": "<suggested phrase or summary>",\n  "confidence": <float 0.0 to 1.0>\n}',
    inputVariables: ['customerName', 'context', 'objectionDetails', 'latestMessage'],
    temperature: 0.3,
    maxTokens: 1024,
    isDefault: true,
    isActive: true,
  },
};

@Injectable()
export class PromptRegistryService {
  private readonly logger = new Logger(PromptRegistryService.name);

  constructor(@Optional() private readonly prismaService?: PrismaService) {}

  private get client(): any {
    return this.prismaService?.client;
  }

  /**
   * Interpolates dynamic variables into a template string with prompt injection sanitization.
   */
  interpolate(
    template: string,
    variables: Record<string, any>,
    requiredVariables: string[] = [],
  ): string {
    const missingKeys: string[] = [];

    for (const reqVar of requiredVariables) {
      if (
        variables[reqVar] === undefined ||
        variables[reqVar] === null ||
        (typeof variables[reqVar] === 'string' && variables[reqVar].trim() === '')
      ) {
        missingKeys.push(reqVar);
      }
    }

    if (missingKeys.length > 0) {
      throw new BadRequestException({
        code: 'MISSING_PROMPT_VARIABLES',
        message: `Missing required prompt variables: ${missingKeys.join(', ')}`,
        details: { missing: missingKeys },
      });
    }

    const sanitizedVars = PromptSanitizer.sanitizeVariables(variables);

    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      if (sanitizedVars[key] !== undefined) {
        return sanitizedVars[key];
      }
      return match;
    });
  }

  /**
   * Finds a prompt template by name and optional version, falling back to built-in presets.
   */
  async findTemplate(workspaceId: string, name: string, version?: number): Promise<any> {
    if (this.client) {
      // Look for workspace specific version
      if (version !== undefined) {
        const found = await this.client.promptTemplate.findFirst({
          where: { workspaceId, name, version },
        });
        if (found) return found;
      } else {
        // Look for workspace default or highest active version
        const found = await this.client.promptTemplate.findFirst({
          where: { workspaceId, name, isActive: true },
          orderBy: [{ isDefault: 'desc' }, { version: 'desc' }],
        });
        if (found) return found;
      }
    }

    // Fallback to built-in presets
    const preset = BUILT_IN_PROMPTS[name];
    if (preset) {
      return {
        id: `preset_${preset.name}`,
        workspaceId,
        ...preset,
        isSystemDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    throw new NotFoundException({
      code: 'PROMPT_TEMPLATE_NOT_FOUND',
      message: `Prompt template '${name}' not found for workspace '${workspaceId}'`,
    });
  }

  /**
   * Lists templates for a workspace.
   */
  async listTemplates(workspaceId: string, filter?: PromptTemplateFilterDto): Promise<any[]> {
    let dbTemplates: any[] = [];
    if (this.client) {
      dbTemplates = await this.client.promptTemplate.findMany({
        where: {
          workspaceId,
          ...(filter?.name ? { name: { contains: filter.name } } : {}),
          ...(filter?.provider ? { provider: filter.provider } : {}),
          ...(filter?.isActive !== undefined ? { isActive: filter.isActive } : {}),
        },
        orderBy: [{ name: 'asc' }, { version: 'desc' }],
      });
    }

    // Merge built-in presets if not customized by workspace
    const customNames = new Set(dbTemplates.map(t => t.name));
    const presetsToAdd = Object.values(BUILT_IN_PROMPTS)
      .filter(p => !customNames.has(p.name))
      .map(p => ({
        id: `preset_${p.name}`,
        workspaceId,
        ...p,
        isSystemDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

    return [...dbTemplates, ...presetsToAdd];
  }

  /**
   * Creates or registers a new prompt template version for a workspace.
   */
  async createTemplate(
    workspaceId: string,
    dto: PromptTemplateCreateDto,
    userId?: string,
  ): Promise<any> {
    if (!this.client) {
      throw new BadRequestException('Database service is unavailable');
    }

    // Check version collision
    const existing = await this.client.promptTemplate.findFirst({
      where: { workspaceId, name: dto.name, version: dto.version },
    });

    if (existing) {
      throw new BadRequestException({
        code: 'PROMPT_VERSION_EXISTS',
        message: `Version ${dto.version} of template '${dto.name}' already exists in this workspace`,
      });
    }

    // If marked as default, unset other defaults with same name
    if (dto.isDefault) {
      await this.client.promptTemplate.updateMany({
        where: { workspaceId, name: dto.name },
        data: { isDefault: false },
      });
    }

    return this.client.promptTemplate.create({
      data: {
        workspaceId,
        name: dto.name,
        version: dto.version ?? 1,
        provider: dto.provider,
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        userPromptTemplate: dto.userPromptTemplate,
        inputVariables: dto.inputVariables ?? [],
        temperature: dto.temperature ?? 0.2,
        maxTokens: dto.maxTokens ?? 1024,
        isDefault: dto.isDefault ?? false,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
    });
  }

  /**
   * Updates an existing template configuration.
   */
  async updateTemplate(
    workspaceId: string,
    id: string,
    dto: PromptTemplateUpdateDto,
  ): Promise<any> {
    if (!this.client) {
      throw new BadRequestException('Database service is unavailable');
    }

    const template = await this.client.promptTemplate.findFirst({
      where: { id, workspaceId },
    });

    if (!template) {
      throw new NotFoundException({
        code: 'PROMPT_TEMPLATE_NOT_FOUND',
        message: `Prompt template with ID '${id}' was not found in workspace '${workspaceId}'`,
      });
    }

    if (dto.isDefault) {
      await this.client.promptTemplate.updateMany({
        where: { workspaceId, name: template.name, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return this.client.promptTemplate.update({
      where: { id },
      data: {
        ...(dto.systemPrompt ? { systemPrompt: dto.systemPrompt } : {}),
        ...(dto.userPromptTemplate ? { userPromptTemplate: dto.userPromptTemplate } : {}),
        ...(dto.inputVariables ? { inputVariables: dto.inputVariables } : {}),
        ...(dto.provider ? { provider: dto.provider } : {}),
        ...(dto.model ? { model: dto.model } : {}),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
  }

  /**
   * Compiles and renders a prompt template with variables.
   */
  async renderPrompt(
    workspaceId: string,
    name: string,
    variables: Record<string, any>,
    version?: number,
  ): Promise<{
    systemPrompt: string;
    userPrompt: string;
    template: any;
  }> {
    const template = await this.findTemplate(workspaceId, name, version);
    const requiredVars = (template.inputVariables as string[]) || [];

    const compiledUserPrompt = this.interpolate(
      template.userPromptTemplate,
      variables,
      requiredVars,
    );

    const compiledSystemPrompt = this.interpolate(
      template.systemPrompt,
      variables,
      [], // System prompt variables optional
    );

    return {
      systemPrompt: compiledSystemPrompt,
      userPrompt: compiledUserPrompt,
      template,
    };
  }
}
