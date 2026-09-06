import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BuyingSignalType } from '@sales-copilot/shared-contracts';
import { SalesEvidenceController } from '../sales-evidence.controller';

describe('SalesEvidenceController', () => {
  let controller: SalesEvidenceController;
  let mockService: any;
  const mockContext = {
    workspaceId: 'ws_01',
    user: { id: 'usr_01', role: 'AGENT' },
  } as any;

  beforeEach(() => {
    mockService = {
      recordEvidence: async (wsId: string, dto: any) => ({
        id: 'evi_01',
        workspaceId: wsId,
        ...dto,
      }),
      listByLead: async (wsId: string, leadId: string, _query: any) => ({
        items: [{ id: 'evi_01', workspaceId: wsId, leadId }],
        meta: { page: 1, limit: 10, total: 1, totalPages: 1, hasMore: false },
      }),
      listByConversation: async (wsId: string, conversationId: string, _query: any) => [
        { id: 'evi_01', workspaceId: wsId, conversationId },
      ],
      invalidateEvidence: async (wsId: string, id: string, userId: string, dto: any) => ({
        id,
        workspaceId: wsId,
        isInvalidated: true,
        invalidatedByUserId: userId,
        invalidationReason: dto?.invalidationReason,
      }),
    };

    controller = new SalesEvidenceController(mockService);
  });

  it('should delegate recordEvidence to service', async () => {
    const dto: any = {
      conversationId: 'conv_01',
      signalType: BuyingSignalType.BUDGET_CONFIRMED,
      confidence: 0.9,
      snippet: '200M VND',
      reason: 'Budget explicit',
    };
    const result = await controller.recordEvidence(mockContext, dto);
    assert.strictEqual(result.id, 'evi_01');
    assert.strictEqual(result.workspaceId, 'ws_01');
  });

  it('should delegate listByLead to service', async () => {
    const result = await controller.listByLead(mockContext, 'lead_01', {
      page: 1,
      limit: 10,
    } as any);
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].leadId, 'lead_01');
  });

  it('should delegate listByConversation to service', async () => {
    const result = await controller.listByConversation(mockContext, 'conv_01', {} as any);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].conversationId, 'conv_01');
  });

  it('should delegate invalidateEvidence to service with current user id', async () => {
    const result = await controller.invalidateEvidence(
      mockContext,
      'evi_01',
      { userId: 'usr_agent_1' },
      { invalidationReason: 'False positive' },
    );
    assert.strictEqual(result.id, 'evi_01');
    assert.strictEqual(result.isInvalidated, true);
    assert.strictEqual(result.invalidatedByUserId, 'usr_agent_1');
    assert.strictEqual(result.invalidationReason, 'False positive');
  });
});
