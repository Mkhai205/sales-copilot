import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DomainEvent, OpportunityStage, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { OpportunitiesService } from '../opportunities.service';

describe('OpportunitiesService (Pipeline Management & Analytics)', () => {
  let service: OpportunitiesService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let leadsDb: Map<string, any>;
  let opportunitiesDb: Map<string, any>;
  let membersDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const user1 = 'usr_agent_1';
  const userOther = 'usr_alien';
  const contact1 = 'ct_11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    contactsDb = new Map();
    leadsDb = new Map();
    opportunitiesDb = new Map();
    membersDb = new Map();
    emittedEvents = [];

    contactsDb.set(contact1, {
      id: contact1,
      workspaceId: ws1,
      name: 'Bob Richards',
      email: 'bob@richards.com',
      phoneNumber: null,
      avatarUrl: null,
    });

    membersDb.set(`${ws1}_${user1}`, { workspaceId: ws1, userId: user1 });

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      contact: {
        findFirst: async ({ where }: any) => {
          for (const c of contactsDb.values()) {
            if (where.id && c.id !== where.id) continue;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            return { ...c };
          }
          return null;
        },
      },
      lead: {
        findFirst: async ({ where }: any) => {
          for (const l of leadsDb.values()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            return { ...l };
          }
          return null;
        },
      },
      workspaceMember: {
        findFirst: async ({ where }: any) => {
          return membersDb.get(`${where.workspaceId}_${where.userId}`) || null;
        },
      },
      opportunity: {
        findFirst: async ({ where, include }: any) => {
          for (const o of opportunitiesDb.values()) {
            if (where.id && o.id !== where.id) continue;
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            const res = { ...o };
            if (include?.contact) res.contact = contactsDb.get(o.contactId);
            return res;
          }
          return null;
        },
        findMany: async ({ where, skip, take }: any) => {
          let list = Array.from(opportunitiesDb.values()).filter(o => {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) return false;
            if (where.stage && o.stage !== where.stage) return false;
            if (where.currency && o.currency !== where.currency) return false;
            if (where.assignedUserId && o.assignedUserId !== where.assignedUserId) return false;
            return true;
          });

          if (skip !== undefined && take !== undefined) {
            list = list.slice(skip, skip + take);
          }
          return list.map(o => ({
            ...o,
            contact: contactsDb.get(o.contactId),
          }));
        },
        count: async ({ where }: any) => {
          return Array.from(opportunitiesDb.values()).filter(o => {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) return false;
            if (where.stage && o.stage !== where.stage) return false;
            if (where.currency && o.currency !== where.currency) return false;
            return true;
          }).length;
        },
        create: async ({ data, include }: any) => {
          const id = `opp_${Date.now()}_${Math.random()}`;
          const opp = {
            id,
            ...data,
            actualCloseDate: null,
            lostReason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          opportunitiesDb.set(id, opp);
          const res = { ...opp };
          if (include?.contact) res.contact = contactsDb.get(data.contactId);
          return res;
        },
        update: async ({ where, data, include }: any) => {
          const existing = opportunitiesDb.get(where.id);
          if (!existing) throw new Error('Opportunity not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          opportunitiesDb.set(where.id, updated);
          const res = { ...updated };
          if (include?.contact) res.contact = contactsDb.get(updated.contactId);
          return res;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      client: clientMock,
    };

    service = new OpportunitiesService(mockPrismaService, mockEventEmitter);
  });

  describe('createOpportunity', () => {
    it('should create opportunity with automatic stage probability default', async () => {
      const opp = await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Initial Discovery Deal',
        stage: OpportunityStage.PROSPECTING,
        amount: 20000,
        currency: 'USD',
      });

      assert.ok(opp.id);
      assert.strictEqual(opp.stage, OpportunityStage.PROSPECTING);
      assert.strictEqual(opp.probability, 10); // PROSPECTING default is 10%
      assert.strictEqual(opp.amount, 20000);

      // Verify domain event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.OPPORTUNITY_CREATED);
    });

    it('should preserve explicit custom probability', async () => {
      const opp = await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Custom Probability Deal',
        stage: OpportunityStage.PROPOSAL,
        amount: 50000,
        currency: 'USD',
        probability: 65,
      });

      assert.strictEqual(opp.stage, OpportunityStage.PROPOSAL);
      assert.strictEqual(opp.probability, 65);
    });

    it('should throw 404 when contact is not in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createOpportunity(ws2, {
            contactId: contact1,
            title: 'Alien Contact Deal',
            stage: OpportunityStage.PROSPECTING,
            amount: 10000,
            currency: 'USD',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw 400 when assignee is outside workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createOpportunity(ws1, {
            contactId: contact1,
            title: 'Bad Assignee Deal',
            stage: OpportunityStage.PROSPECTING,
            amount: 10000,
            currency: 'USD',
            assignedUserId: userOther,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'ASSIGNEE_NOT_IN_WORKSPACE');
          return true;
        },
      );
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal 1',
        stage: OpportunityStage.PROSPECTING,
        amount: 10000,
      });

      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal 2',
        stage: OpportunityStage.QUALIFICATION,
        amount: 20000,
      });

      // Alien deal in ws2
      opportunitiesDb.set('alien_opp', {
        id: 'alien_opp',
        workspaceId: ws2,
        contactId: 'alien_ct',
        title: 'Alien Opp',
        stage: OpportunityStage.PROSPECTING,
        amount: 99999,
        currency: 'USD',
        probability: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should list opportunities scoped to workspace', async () => {
      const result = await service.findAll(ws1, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.total, 2);
      assert.ok(result.items.every(o => o.workspaceId === ws1));
    });

    it('should support empty query object with defaults', async () => {
      const result = await service.findAll(ws1, {});

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.page, 1);
      assert.strictEqual(result.meta.limit, 20);
    });

    it('should filter by stage', async () => {
      const result = await service.findAll(ws1, {
        stage: OpportunityStage.QUALIFICATION,
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].stage, OpportunityStage.QUALIFICATION);
    });
  });

  describe('findById', () => {
    it('should return opportunity details when found in workspace', async () => {
      const created = await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Find Deal',
        stage: OpportunityStage.PROPOSAL,
        amount: 30000,
      });

      const found = await service.findById(ws1, created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.title, 'Find Deal');
    });

    it('should throw 404 when opportunity is not found in workspace', async () => {
      const created = await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Find Deal',
        stage: OpportunityStage.PROPOSAL,
        amount: 30000,
      });

      await assert.rejects(
        async () => {
          await service.findById(ws2, created.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'OPPORTUNITY_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('updateStage', () => {
    let oppId: string;

    beforeEach(async () => {
      const created = await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Pipeline Progression Test Deal',
        stage: OpportunityStage.QUALIFICATION,
        amount: 30000,
        currency: 'USD',
      });
      oppId = created.id;
      emittedEvents = [];
    });

    it('should transition to CLOSED_WON, setting probability to 100% and actualCloseDate', async () => {
      const updated = await service.updateStage(
        ws1,
        oppId,
        { stage: OpportunityStage.CLOSED_WON },
        WorkspaceRole.AGENT,
      );

      assert.strictEqual(updated.stage, OpportunityStage.CLOSED_WON);
      assert.strictEqual(updated.probability, 100);
      assert.ok(updated.actualCloseDate);

      // Verify domain event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.OPPORTUNITY_STAGE_UPDATED);
    });

    it('should transition to CLOSED_LOST with lostReason, probability 0%, and actualCloseDate', async () => {
      const updated = await service.updateStage(
        ws1,
        oppId,
        {
          stage: OpportunityStage.CLOSED_LOST,
          lostReason: 'Budget was diverted to other initiatives',
        },
        WorkspaceRole.AGENT,
      );

      assert.strictEqual(updated.stage, OpportunityStage.CLOSED_LOST);
      assert.strictEqual(updated.probability, 0);
      assert.strictEqual(updated.lostReason, 'Budget was diverted to other initiatives');
      assert.ok(updated.actualCloseDate);
    });

    it('should reject transition to CLOSED_LOST when lostReason is missing', async () => {
      await assert.rejects(
        async () => {
          await service.updateStage(
            ws1,
            oppId,
            {
              stage: OpportunityStage.CLOSED_LOST,
            },
            WorkspaceRole.AGENT,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LOST_REASON_REQUIRED');
          return true;
        },
      );
    });

    it('should reject transition to CLOSED_LOST when lostReason is shorter than 5 characters', async () => {
      await assert.rejects(
        async () => {
          await service.updateStage(
            ws1,
            oppId,
            {
              stage: OpportunityStage.CLOSED_LOST,
              lostReason: 'bad',
            },
            WorkspaceRole.AGENT,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LOST_REASON_REQUIRED');
          return true;
        },
      );
    });

    it('should reject modification of closed deals by non-admin roles', async () => {
      // First, close the deal
      await service.updateStage(
        ws1,
        oppId,
        { stage: OpportunityStage.CLOSED_WON },
        WorkspaceRole.ADMIN,
      );

      // Attempt to modify closed deal as AGENT
      await assert.rejects(
        async () => {
          await service.updateStage(
            ws1,
            oppId,
            { stage: OpportunityStage.NEGOTIATION },
            WorkspaceRole.AGENT,
          );
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CLOSED_DEAL_IMMUTABLE');
          return true;
        },
      );
    });

    it('should allow ADMIN to re-open or modify a closed deal', async () => {
      // Close deal
      await service.updateStage(
        ws1,
        oppId,
        { stage: OpportunityStage.CLOSED_WON },
        WorkspaceRole.ADMIN,
      );

      // Re-open as ADMIN
      const reopened = await service.updateStage(
        ws1,
        oppId,
        { stage: OpportunityStage.NEGOTIATION },
        WorkspaceRole.ADMIN,
      );

      assert.strictEqual(reopened.stage, OpportunityStage.NEGOTIATION);
      assert.strictEqual(reopened.probability, 80); // NEGOTIATION default
      assert.strictEqual(reopened.actualCloseDate, null);
    });
  });

  describe('getPipelineSummary', () => {
    beforeEach(async () => {
      // Create deals at various stages in ws1
      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal 1 - Prospecting',
        stage: OpportunityStage.PROSPECTING,
        amount: 10000,
        currency: 'USD',
        probability: 10,
      });

      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal 2 - Qualification',
        stage: OpportunityStage.QUALIFICATION,
        amount: 20000,
        currency: 'USD',
        probability: 25,
      });

      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal 3 - Closed Won',
        stage: OpportunityStage.CLOSED_WON,
        amount: 50000,
        currency: 'USD',
        probability: 100,
      });

      // Alien workspace deal that must NOT be counted
      opportunitiesDb.set('alien_deal', {
        id: 'alien_deal',
        workspaceId: ws2,
        contactId: 'ct_alien',
        title: 'Alien Deal',
        stage: OpportunityStage.CLOSED_WON,
        amount: 1000000,
        currency: 'USD',
        probability: 100,
      });
    });

    it('should aggregate metrics per stage and calculate total and weighted pipeline value', async () => {
      const summary = await service.getPipelineSummary(ws1, { currency: 'USD' });

      assert.strictEqual(summary.currency, 'USD');
      assert.strictEqual(summary.totalDeals, 3);
      // Total value: 10000 + 20000 + 50000 = 80000
      assert.strictEqual(summary.totalPipelineValue, 80000);
      // Weighted value: (10000 * 0.1) + (20000 * 0.25) + (50000 * 1.0) = 1000 + 5000 + 50000 = 56000
      assert.strictEqual(summary.weightedPipelineValue, 56000);

      // Verify stages list has all 6 stages
      assert.strictEqual(summary.stages.length, 6);

      const prospectingStage = summary.stages.find(s => s.stage === OpportunityStage.PROSPECTING);
      assert.strictEqual(prospectingStage?.count, 1);
      assert.strictEqual(prospectingStage?.totalAmount, 10000);
      assert.strictEqual(prospectingStage?.weightedAmount, 1000);

      const wonStage = summary.stages.find(s => s.stage === OpportunityStage.CLOSED_WON);
      assert.strictEqual(wonStage?.count, 1);
      assert.strictEqual(wonStage?.totalAmount, 50000);
      assert.strictEqual(wonStage?.weightedAmount, 50000);

      const lostStage = summary.stages.find(s => s.stage === OpportunityStage.CLOSED_LOST);
      assert.strictEqual(lostStage?.count, 0);
      assert.strictEqual(lostStage?.totalAmount, 0);
    });

    it('should correctly round floating-point amounts to two decimal places', async () => {
      opportunitiesDb.clear();
      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Decimal Deal 1',
        stage: OpportunityStage.PROSPECTING,
        amount: 10.333333,
        currency: 'USD',
        probability: 33.333333,
      });

      const summary = await service.getPipelineSummary(ws1, { currency: 'USD' });
      assert.strictEqual(summary.totalPipelineValue, 10.33);
      // 10.333333 * 0.33333333 = 3.444444... -> 3.44
      assert.strictEqual(summary.weightedPipelineValue, 3.44);
    });

    it('should support calling getPipelineSummary without query (default USD)', async () => {
      opportunitiesDb.clear();
      await service.createOpportunity(ws1, {
        contactId: contact1,
        title: 'Deal Default Currency',
        stage: OpportunityStage.PROSPECTING,
        amount: 25000,
      });

      const summary = await service.getPipelineSummary(ws1);
      assert.strictEqual(summary.currency, 'USD');
      assert.strictEqual(summary.totalDeals, 1);
      assert.strictEqual(summary.totalPipelineValue, 25000);
    });
  });
});
