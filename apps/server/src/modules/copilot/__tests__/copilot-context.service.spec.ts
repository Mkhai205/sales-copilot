import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { SenderType } from '@sales-copilot/shared-contracts';
import { CopilotContextService } from '../copilot-context.service';

describe('CopilotContextService (Context Synthesizer & Token Budget)', () => {
  let service: CopilotContextService;
  let mockPrismaService: any;
  let mockContactsService: any;
  let mockLeadsService: any;
  let mockLeadScoringService: any;
  let mockSalesEvidenceService: any;

  const wsId = 'ws-test-1';
  const convId = 'conv-test-1';
  const contactId = 'contact-test-1';

  beforeEach(() => {
    // Generate 15 dummy messages to test 10-message sliding window
    const messages = Array.from({ length: 15 }, (_, i) => ({
      id: `msg-${i + 1}`,
      conversationId: convId,
      workspaceId: wsId,
      senderType: i % 2 === 0 ? SenderType.CONTACT : SenderType.USER,
      content: `Message ${i + 1}`,
      isPrivate: false,
      createdAt: new Date(Date.now() - (15 - i) * 60000),
    }));

    mockPrismaService = {
      getClient: () => ({
        conversation: {
          findFirst: async ({ where }: any) => {
            if (where.id === convId && where.workspaceId === wsId) {
              return {
                id: convId,
                workspaceId: wsId,
                contactId,
                contact: {
                  id: contactId,
                  name: 'Anh Nam',
                  email: 'nam@techcorp.vn',
                  phoneNumber: '0901234567',
                },
              };
            }
            return null;
          },
        },
        message: {
          findMany: async ({ take }: any) => {
            // Returns latest messages ordered by createdAt desc
            return [...messages].reverse().slice(0, take);
          },
        },
      }),
    };

    mockContactsService = {
      findById: async () => ({ id: contactId, name: 'Anh Nam' }),
    };

    mockLeadsService = {
      findByContactId: async () => ({
        id: 'lead-test-1',
        stage: 'EVALUATION',
        score: 85,
        grade: 'HOT',
        estimatedValue: 200000000,
        currency: 'VND',
      }),
    };

    mockLeadScoringService = {
      getScore: async () => ({
        score: 88,
        grade: 'HOT',
      }),
    };

    mockSalesEvidenceService = {
      listByConversation: async () => [
        {
          signalType: 'BUDGET_CONFIRMED',
          snippet: 'Ngân sách bên anh tầm 200tr',
          confidence: 0.95,
          reason: 'Customer explicitly stated budget',
        },
        {
          signalType: 'COMPETITOR_MENTION',
          snippet: 'Bên Competitor X giá thấp hơn 20%',
          confidence: 0.9,
          reason: 'Competitor price comparison',
        },
      ],
    };

    service = new CopilotContextService(
      mockPrismaService,
      mockContactsService,
      mockLeadsService,
      mockLeadScoringService,
      mockSalesEvidenceService,
    );
  });

  it('should synthesize full context with sliding window of 10 messages', async () => {
    const context = await service.buildContext(wsId, convId);

    assert.strictEqual(context.workspaceId, wsId);
    assert.strictEqual(context.conversationId, convId);
    assert.strictEqual(context.contactName, 'Anh Nam');
    assert.strictEqual(context.dealStage, 'EVALUATION');
    assert.strictEqual(context.dealScore, 88);
    assert.strictEqual(context.dealGrade, 'HOT');

    // Should include exactly 10 recent messages
    assert.strictEqual(context.recentMessages.length, 10);

    // Signals should be extracted
    assert.strictEqual(context.activeSignals.length, 2);
    assert.strictEqual(context.competitorOrObjections.length, 1);
    assert.strictEqual(context.competitorOrObjections[0].signalType, 'COMPETITOR_MENTION');

    // Budget check: raw context summary should not exceed MAX_CONTEXT_CHARS
    assert.ok(context.rawContextSummary.length <= 12000);
    assert.ok(context.rawContextSummary.includes('Anh Nam'));
    assert.ok(context.rawContextSummary.includes('COMPETITOR_MENTION'));
  });

  it('should throw NotFoundException if conversation does not exist in workspace', async () => {
    await assert.rejects(
      () => service.buildContext(wsId, 'non-existent-conv'),
      (err: any) => err.status === 404,
    );
  });
});
