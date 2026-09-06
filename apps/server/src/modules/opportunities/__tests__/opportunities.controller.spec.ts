import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  BillingPlanType,
  OpportunityStage,
  WorkspaceRole,
  type OpportunityResponseDto,
  type PipelineSummaryResponseDto,
} from '@sales-copilot/shared-contracts';
import { OpportunitiesController, PipelineController } from '../opportunities.controller';
import { OpportunitiesService } from '../opportunities.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('OpportunitiesController & PipelineController (Presentation Layer Endpoints)', () => {
  let oppController: OpportunitiesController;
  let pipelineController: PipelineController;
  let mockOpportunitiesService: Partial<OpportunitiesService>;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_test_1',
    role: WorkspaceRole.ADMIN,
    workspace: {
      id: 'ws_test_1',
      name: 'Alpha Corp',
      slug: 'alpha-corp',
      billingPlan: BillingPlanType.FREE,
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const sampleOpp: OpportunityResponseDto = {
    id: 'opp_123',
    workspaceId: 'ws_test_1',
    leadId: null,
    contactId: 'ct_123',
    title: 'Alpha Contract',
    stage: OpportunityStage.PROSPECTING,
    amount: 50000,
    currency: 'USD',
    probability: 10,
    expectedCloseDate: null,
    actualCloseDate: null,
    lostReason: null,
    assignedUserId: null,
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const samplePipelineSummary: PipelineSummaryResponseDto = {
    currency: 'USD',
    totalPipelineValue: 50000,
    weightedPipelineValue: 5000,
    totalDeals: 1,
    stages: [
      {
        stage: OpportunityStage.PROSPECTING,
        count: 1,
        totalAmount: 50000,
        weightedAmount: 5000,
        averageProbability: 10,
      },
    ],
  };

  beforeEach(() => {
    mockOpportunitiesService = {
      createOpportunity: async (workspaceId, dto) => ({
        ...sampleOpp,
        workspaceId,
        contactId: dto.contactId,
        title: dto.title,
        amount: dto.amount,
        stage: dto.stage ?? OpportunityStage.PROSPECTING,
        probability: dto.probability ?? 10,
      }),
      findAll: async (workspaceId, query) => ({
        items: [sampleOpp],
        meta: {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
      findById: async (workspaceId, id) => ({
        ...sampleOpp,
        workspaceId,
        id,
      }),
      updateStage: async (workspaceId, id, dto, userRole) => ({
        ...sampleOpp,
        workspaceId,
        id,
        stage: dto.stage,
        probability: dto.stage === OpportunityStage.CLOSED_WON ? 100 : 0,
      }),
      getPipelineSummary: async (workspaceId, query) => ({
        ...samplePipelineSummary,
        currency: query?.currency ?? 'USD',
      }),
    };

    oppController = new OpportunitiesController(mockOpportunitiesService as OpportunitiesService);
    pipelineController = new PipelineController(mockOpportunitiesService as OpportunitiesService);
  });

  describe('OpportunitiesController', () => {
    it('should delegate createOpportunity to OpportunitiesService', async () => {
      const result = await oppController.createOpportunity(mockContext, {
        contactId: 'ct_123',
        title: 'Alpha Contract',
        amount: 50000,
        currency: 'USD',
        stage: OpportunityStage.PROSPECTING,
        probability: 10,
        metadata: {},
      });

      assert.strictEqual(result.workspaceId, 'ws_test_1');
      assert.strictEqual(result.title, 'Alpha Contract');
      assert.strictEqual(result.amount, 50000);
    });

    it('should delegate listOpportunities to OpportunitiesService', async () => {
      const result = await oppController.listOpportunities(mockContext, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.meta.page, 1);
    });

    it('should delegate getOpportunityById to OpportunitiesService', async () => {
      const result = await oppController.getOpportunityById(mockContext, 'opp_123');
      assert.strictEqual(result.id, 'opp_123');
      assert.strictEqual(result.workspaceId, 'ws_test_1');
    });

    it('should delegate updateStage with workspace role to OpportunitiesService', async () => {
      const result = await oppController.updateStage(mockContext, 'opp_123', {
        stage: OpportunityStage.CLOSED_WON,
      });

      assert.strictEqual(result.stage, OpportunityStage.CLOSED_WON);
      assert.strictEqual(result.probability, 100);
    });
  });

  describe('PipelineController', () => {
    it('should delegate getPipelineSummary to OpportunitiesService', async () => {
      const result = await pipelineController.getPipelineSummary(mockContext, {
        currency: 'USD',
      });

      assert.strictEqual(result.currency, 'USD');
      assert.strictEqual(result.totalPipelineValue, 50000);
      assert.strictEqual(result.totalDeals, 1);
    });
  });
});
