import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  BillingPlanType,
  LeadGrade,
  LeadStage,
  LeadStatus,
  OpportunityStage,
  WorkspaceRole,
  type LeadResponseDto,
} from '@sales-copilot/shared-contracts';
import { LeadsController } from '../leads.controller';
import { LeadsService } from '../leads.service';
import { LeadConversionService } from '../lead-conversion.service';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';

describe('LeadsController (Presentation Layer Endpoints)', () => {
  let controller: LeadsController;
  let mockLeadsService: Partial<LeadsService>;
  let mockLeadConversionService: Partial<LeadConversionService>;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws_test_1',
    role: WorkspaceRole.AGENT,
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

  const sampleLead: LeadResponseDto = {
    id: 'lead_123',
    workspaceId: 'ws_test_1',
    contactId: 'ct_123',
    status: LeadStatus.NEW,
    stage: LeadStage.DISCOVERY,
    score: 0,
    grade: LeadGrade.COLD,
    assignedUserId: null,
    estimatedValue: 15000,
    currency: 'USD',
    metadata: {},
    lastActivityAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockLeadsService = {
      createLead: async (workspaceId, dto) => ({
        ...sampleLead,
        workspaceId,
        contactId: dto.contactId,
        estimatedValue: dto.estimatedValue ?? null,
      }),
      findAll: async (workspaceId, query) => ({
        items: [sampleLead],
        meta: {
          page: query.page ?? 1,
          limit: query.limit ?? 20,
          total: 1,
          totalPages: 1,
          hasMore: false,
        },
      }),
      findById: async (workspaceId, id) => ({
        ...sampleLead,
        workspaceId,
        id,
      }),
      updateLead: async (workspaceId, id, dto) => ({
        ...sampleLead,
        workspaceId,
        id,
        status: dto.status ?? sampleLead.status,
        stage: dto.stage ?? sampleLead.stage,
      }),
    };

    mockLeadConversionService = {
      convertLead: async (workspaceId, leadId, dto) => ({
        lead: {
          ...sampleLead,
          id: leadId,
          workspaceId,
          status: LeadStatus.CONVERTED,
          stage: LeadStage.WON,
        },
        opportunity: {
          id: 'opp_new_1',
          workspaceId,
          leadId,
          contactId: sampleLead.contactId,
          title: dto.title || (dto as any).dealName || 'Converted Deal',
          stage: dto.stage ?? OpportunityStage.QUALIFICATION,
          amount: dto.amount,
          currency: dto.currency ?? 'USD',
          probability: dto.probability ?? 25,
          expectedCloseDate: null,
          actualCloseDate: null,
          lostReason: null,
          assignedUserId: null,
          metadata: {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    };

    controller = new LeadsController(
      mockLeadsService as LeadsService,
      mockLeadConversionService as LeadConversionService,
    );
  });

  it('should delegate createLead to LeadsService', async () => {
    const result = await controller.createLead(mockContext, {
      contactId: 'ct_123',
      estimatedValue: 20000,
      currency: 'USD',
      metadata: {},
    });

    assert.strictEqual(result.workspaceId, 'ws_test_1');
    assert.strictEqual(result.contactId, 'ct_123');
    assert.strictEqual(result.estimatedValue, 20000);
  });

  it('should delegate listLeads to LeadsService', async () => {
    const result = await controller.listLeads(mockContext, {
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.meta.page, 1);
    assert.strictEqual(result.meta.limit, 10);
  });

  it('should delegate getLeadById to LeadsService', async () => {
    const result = await controller.getLeadById(mockContext, 'lead_123');
    assert.strictEqual(result.id, 'lead_123');
    assert.strictEqual(result.workspaceId, 'ws_test_1');
  });

  it('should delegate updateLead to LeadsService', async () => {
    const result = await controller.updateLead(mockContext, 'lead_123', {
      status: LeadStatus.ENGAGED,
      stage: LeadStage.EVALUATION,
    });

    assert.strictEqual(result.status, LeadStatus.ENGAGED);
    assert.strictEqual(result.stage, LeadStage.EVALUATION);
  });

  it('should delegate convertLead to LeadConversionService', async () => {
    const result = await controller.convertLead(mockContext, 'lead_123', {
      title: 'Converted Deal',
      amount: 60000,
      stage: OpportunityStage.QUALIFICATION,
      currency: 'USD',
      probability: 25,
    });

    assert.strictEqual(result.lead.status, LeadStatus.CONVERTED);
    assert.strictEqual(result.opportunity.title, 'Converted Deal');
    assert.strictEqual(result.opportunity.amount, 60000);
  });
});
