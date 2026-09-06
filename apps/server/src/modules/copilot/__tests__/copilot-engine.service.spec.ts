import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { CopilotSuggestionType } from '@sales-copilot/shared-contracts';
import { CopilotEngineService } from '../copilot-engine.service';
import type { CopilotContext } from '../copilot-context.service';

describe('CopilotEngineService (Structured Output, Threshold Filter & Streaming)', () => {
  let service: CopilotEngineService;
  let mockLlmGateway: any;
  let mockPromptRegistry: any;
  let mockRealtimeGateway: any;
  let emittedSocketEvents: any[];

  const dummyContext: CopilotContext = {
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    contactId: 'ct-1',
    contactName: 'Chị Mai',
    contactEmail: 'mai@company.vn',
    contactPhone: '0912345678',
    leadId: 'lead-1',
    dealStage: 'PROPOSAL',
    dealScore: 80,
    dealGrade: 'HOT',
    estimatedValue: 150000000,
    currency: 'VND',
    activeSignals: [
      {
        signalType: 'COMPETITOR_MENTION',
        snippet: 'Đang cân nhắc Competitor X',
        confidence: 0.9,
      },
    ],
    recentMessages: [
      {
        senderType: 'CONTACT',
        content: 'Gói Pro có những tính năng gì em?',
        createdAt: new Date().toISOString(),
      },
    ],
    latestCustomerMessage: 'Gói Pro có những tính năng gì em?',
    competitorOrObjections: [
      {
        signalType: 'COMPETITOR_MENTION',
        snippet: 'Đang cân nhắc Competitor X',
      },
    ],
    rawContextSummary: 'Summary of conversation',
  };

  beforeEach(() => {
    emittedSocketEvents = [];

    mockPromptRegistry = {
      findTemplate: async () => ({
        systemPrompt: 'System prompt',
        userPromptTemplate: 'User prompt template',
      }),
      interpolate: (template: string) => template,
    };

    mockRealtimeGateway = {
      server: {
        to: (room: string) => ({
          emit: (event: string, payload: any) => {
            emittedSocketEvents.push({ room, event, payload });
          },
        }),
      },
    };
  });

  it('should generate structured suggestions and filter out those below 0.70 confidence', async () => {
    mockLlmGateway = {
      generateStructured: async ({ schema }: any) => {
        // If it's the reply draft schema
        if (schema.shape?.replyContent) {
          return {
            data: {
              title: 'Bản thảo trả lời',
              replyContent: 'Dạ gói Pro bao gồm đầy đủ tính năng CRM và AI Copilot ạ.',
              confidence: 0.92, // >= 0.70 -> accepted
            },
          };
        }
        // If it's the NBA schema
        if (schema.shape?.action) {
          return {
            data: {
              title: 'Lên lịch demo chi tiết',
              action: 'SCHEDULE_DEMO',
              description: 'Đề xuất đặt lịch hẹn demo trực tiếp với khách hàng.',
              confidence: 0.65, // < 0.70 -> should be filtered out!
            },
          };
        }
        // If it's the Battlecard schema
        if (schema.shape?.competitorOrTopic) {
          return {
            data: {
              title: 'Battlecard: Competitor X',
              competitorOrTopic: 'Competitor X',
              keyAdvantages: ['Tích hợp đa kênh', 'Hỗ trợ 24/7', 'AI tự động hóa'],
              pivotQuestions: ['Anh/chị ưu tiên tính năng nào nhất?'],
              recommendedResponse: 'Giải pháp bên em nổi bật ở khả năng hợp nhất đa kênh.',
              confidence: 0.88, // >= 0.70 -> accepted
            },
          };
        }
        throw new Error('Unexpected schema');
      },
    };

    service = new CopilotEngineService(mockLlmGateway, mockPromptRegistry, mockRealtimeGateway);

    const suggestions = await service.generateStructuredSuggestions(dummyContext);

    // Should contain REPLY_DRAFT (0.92) and BATTLECARD (0.88)
    // NBA (0.65) must be discarded!
    assert.strictEqual(suggestions.length, 2);

    const reply = suggestions.find(s => s.suggestionType === CopilotSuggestionType.REPLY_DRAFT);
    assert.ok(reply);
    assert.strictEqual(reply.confidence, 0.92);

    const battlecard = suggestions.find(s => s.suggestionType === CopilotSuggestionType.BATTLECARD);
    assert.ok(battlecard);
    assert.strictEqual(battlecard.confidence, 0.88);

    const nba = suggestions.find(s => s.suggestionType === CopilotSuggestionType.NEXT_BEST_ACTION);
    assert.strictEqual(nba, undefined);
  });

  it('should include Next Best Action when confidence meets threshold and set valid OpportunityStage', async () => {
    mockLlmGateway = {
      generateStructured: async ({ schema }: any) => {
        if (schema.shape?.action) {
          return {
            data: {
              title: 'Chuyển đổi thành Opportunity',
              action: 'CONVERT_TO_OPPORTUNITY',
              description: 'Khách hàng có ngân sách và nhu cầu rõ ràng',
              confidence: 0.88,
              params: {},
            },
          };
        }
        return { data: { confidence: 0.5 } };
      },
    };

    service = new CopilotEngineService(mockLlmGateway, mockPromptRegistry, mockRealtimeGateway);

    const suggestions = await service.generateStructuredSuggestions(dummyContext);
    const nba = suggestions.find(s => s.suggestionType === CopilotSuggestionType.NEXT_BEST_ACTION);

    assert.ok(nba);
    assert.strictEqual(nba.confidence, 0.88);
    assert.strictEqual(nba.actionPayload.recommendedStage, 'QUALIFICATION');
    assert.strictEqual(nba.actionPayload.defaultAmount, 150000000);
  });

  it('should stream reply draft and emit socket chunks with isFinished signal', async () => {
    mockLlmGateway = {
      generateStream: async function* () {
        yield { content: 'Dạ ' };
        yield { content: 'chào ' };
        yield { content: 'chị Mai ạ!' };
      },
    };

    service = new CopilotEngineService(mockLlmGateway, mockPromptRegistry, mockRealtimeGateway);

    const fullText = await service.streamReplyDraft(dummyContext);

    assert.strictEqual(fullText, 'Dạ chào chị Mai ạ!');

    // Verify socket chunks
    assert.strictEqual(emittedSocketEvents.length, 4); // 3 chunks + 1 finished signal
    assert.strictEqual(emittedSocketEvents[0].room, 'conversation_conv-1');
    assert.strictEqual(emittedSocketEvents[0].payload.data.chunk, 'Dạ ');
    assert.strictEqual(emittedSocketEvents[3].payload.data.isFinished, true);
    assert.strictEqual(emittedSocketEvents[3].payload.data.fullContent, 'Dạ chào chị Mai ạ!');
  });
});
