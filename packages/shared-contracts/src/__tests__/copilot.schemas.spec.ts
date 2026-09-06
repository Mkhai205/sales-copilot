import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  CopilotSuggestionType,
  SuggestionStatus,
  CopilotActionType,
  DismissalReason,
  COPILOT_SUGGESTIONS_QUEUE,
  GENERATE_COPILOT_SUGGESTIONS_JOB,
  copilotSuggestionSchema,
  generateCopilotSuggestionsJobSchema,
  triggerCopilotGenerationSchema,
  streamReplyDraftSchema,
  resolveSuggestionSchema,
  copilotMetricsSchema,
  DomainEvent,
  WsServerEvent,
} from '../index';

describe('Copilot Shared Contracts & Schemas', () => {
  describe('Enums & Constants', () => {
    it('should define queue and job names', () => {
      assert.strictEqual(COPILOT_SUGGESTIONS_QUEUE, 'copilot-suggestions');
      assert.strictEqual(GENERATE_COPILOT_SUGGESTIONS_JOB, 'generate-copilot-suggestions');
    });

    it('should define domain and websocket events', () => {
      assert.strictEqual(DomainEvent.COPILOT_SUGGESTION_GENERATED, 'copilot.suggestion_generated');
      assert.strictEqual(DomainEvent.COPILOT_SUGGESTION_CHUNK, 'copilot.suggestion_chunk');
      assert.strictEqual(DomainEvent.COPILOT_SUGGESTION_ACTED, 'copilot.suggestion_acted');

      assert.strictEqual(
        WsServerEvent.COPILOT_SUGGESTION_GENERATED,
        'copilot.suggestion_generated',
      );
      assert.strictEqual(WsServerEvent.COPILOT_SUGGESTION_CHUNK, 'copilot.suggestion_chunk');
      assert.strictEqual(WsServerEvent.COPILOT_SUGGESTION_ACTED, 'copilot.suggestion_acted');
    });
  });

  describe('copilotSuggestionSchema', () => {
    it('should validate valid suggestion payload', () => {
      const valid = {
        id: '11111111-1111-1111-1111-111111111111',
        workspaceId: '22222222-2222-2222-2222-222222222222',
        conversationId: '33333333-3333-3333-3333-333333333333',
        suggestionType: CopilotSuggestionType.REPLY_DRAFT,
        title: 'Bản thảo phản hồi Enterprise SSO',
        content: 'Dạ chào anh, gói Enterprise bên em có hỗ trợ SAML 2.0 ạ.',
        actionPayload: { action: CopilotActionType.REPLY_INSERT },
        confidence: 0.95,
        status: SuggestionStatus.PENDING,
        expiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = copilotSuggestionSchema.parse(valid);
      assert.strictEqual(parsed.id, valid.id);
      assert.strictEqual(parsed.confidence, 0.95);
      assert.strictEqual(parsed.suggestionType, CopilotSuggestionType.REPLY_DRAFT);
    });

    it('should reject confidence out of range', () => {
      assert.throws(() => {
        copilotSuggestionSchema.parse({
          id: '11111111-1111-1111-1111-111111111111',
          workspaceId: '22222222-2222-2222-2222-222222222222',
          conversationId: '33333333-3333-3333-3333-333333333333',
          suggestionType: CopilotSuggestionType.REPLY_DRAFT,
          title: 'Test',
          content: 'Test',
          confidence: 1.5,
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });
    });
  });

  describe('generateCopilotSuggestionsJobSchema', () => {
    it('should validate valid job payload', () => {
      const valid = {
        workspaceId: '22222222-2222-2222-2222-222222222222',
        conversationId: '33333333-3333-3333-3333-333333333333',
      };
      const parsed = generateCopilotSuggestionsJobSchema.parse(valid);
      assert.strictEqual(parsed.conversationId, valid.conversationId);
    });
  });

  describe('streamReplyDraftSchema', () => {
    it('should validate optional customInstruction', () => {
      const parsed1 = streamReplyDraftSchema.parse({});
      assert.strictEqual(parsed1.customInstruction, undefined);

      const parsed2 = streamReplyDraftSchema.parse({ customInstruction: 'Thêm ví dụ giá cả' });
      assert.strictEqual(parsed2.customInstruction, 'Thêm ví dụ giá cả');
    });
  });

  describe('resolveSuggestionSchema', () => {
    it('should validate optional reason', () => {
      const parsed = resolveSuggestionSchema.parse({ reason: DismissalReason.NOT_RELEVANT });
      assert.strictEqual(parsed.reason, DismissalReason.NOT_RELEVANT);
    });
  });

  describe('copilotMetricsSchema', () => {
    it('should validate metrics response', () => {
      const valid = {
        totalSuggestions: 50,
        pendingCount: 5,
        acceptedCount: 30,
        appliedCount: 25,
        dismissedCount: 10,
        expiredCount: 5,
        acceptanceRate: 70.0,
        dismissalReasons: {
          [DismissalReason.NOT_RELEVANT]: 6,
          [DismissalReason.OTHER]: 4,
        },
      };
      const parsed = copilotMetricsSchema.parse(valid);
      assert.strictEqual(parsed.totalSuggestions, 50);
      assert.strictEqual(parsed.acceptanceRate, 70.0);
    });
  });
});
