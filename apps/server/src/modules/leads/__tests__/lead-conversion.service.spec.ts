import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  DomainEvent,
  LeadStage,
  LeadStatus,
  OpportunityStage,
} from '@sales-copilot/shared-contracts';
import { LeadConversionService } from '../lead-conversion.service';

describe('LeadConversionService (Atomic Conversion Engine)', () => {
  let service: LeadConversionService;
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
  const userAlien = 'usr_alien';
  const contact1 = 'ct_11111111-1111-4111-8111-111111111111';
  let lead1Id: string;

  beforeEach(() => {
    contactsDb = new Map();
    leadsDb = new Map();
    opportunitiesDb = new Map();
    membersDb = new Map();
    emittedEvents = [];

    contactsDb.set(contact1, {
      id: contact1,
      workspaceId: ws1,
      name: 'Jane Doe',
      email: 'jane@doe.com',
      phoneNumber: '+1555123456',
      avatarUrl: null,
      customAttributes: { leadSource: 'organic' },
    });

    membersDb.set(`${ws1}_${user1}`, { workspaceId: ws1, userId: user1 });

    lead1Id = 'lead_active_123';
    leadsDb.set(lead1Id, {
      id: lead1Id,
      workspaceId: ws1,
      contactId: contact1,
      status: LeadStatus.QUALIFIED,
      stage: LeadStage.PROPOSAL,
      score: 75,
      assignedUserId: user1,
      estimatedValue: 25000,
      currency: 'USD',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      lead: {
        findFirst: async ({ where, include }: any) => {
          for (const l of leadsDb.values()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            const res = { ...l };
            if (include?.contact) res.contact = contactsDb.get(l.contactId);
            return res;
          }
          return null;
        },
        findUnique: async ({ where, include }: any) => {
          const l = leadsDb.get(where.id);
          if (!l) return null;
          const res = { ...l };
          if (include?.contact) res.contact = contactsDb.get(l.contactId);
          return res;
        },
        update: async ({ where, data, include }: any) => {
          const existing = leadsDb.get(where.id);
          if (!existing) throw new Error('Lead not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          leadsDb.set(where.id, updated);
          const res = { ...updated };
          if (include?.contact) res.contact = contactsDb.get(updated.contactId);
          return res;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [id, l] of leadsDb.entries()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            if (where.status?.not && l.status === where.status.not) continue;
            leadsDb.set(id, { ...l, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      contact: {
        update: async ({ where, data }: any) => {
          const existing = contactsDb.get(where.id);
          if (!existing) throw new Error('Contact not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          contactsDb.set(where.id, updated);
          return updated;
        },
      },
      workspaceMember: {
        findFirst: async ({ where }: any) => {
          return membersDb.get(`${where.workspaceId}_${where.userId}`) || null;
        },
      },
      opportunity: {
        create: async ({ data, include }: any) => {
          const id = `opp_${Date.now()}_${Math.random()}`;
          const opp = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          opportunitiesDb.set(id, opp);
          const res = { ...opp };
          if (include?.contact) res.contact = contactsDb.get(data.contactId);
          return res;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      client: clientMock,
      runInTransaction: async (fn: (ctx: any) => Promise<any>) => {
        const postCommitHooks: Array<() => Promise<void> | void> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (hook: any) => postCommitHooks.push(hook),
        };
        const result = await fn(ctx);
        for (const hook of postCommitHooks) {
          await hook();
        }
        return result;
      },
    };

    service = new LeadConversionService(mockPrismaService, mockEventEmitter);
  });

  it('should successfully convert an active lead into an opportunity atomically', async () => {
    const result = await service.convertLead(ws1, lead1Id, {
      title: 'Enterprise Annual Subscription',
      amount: 50000,
      currency: 'USD',
      stage: OpportunityStage.QUALIFICATION,
      probability: 25,
    });

    // 1. Check Opportunity
    assert.ok(result.opportunity.id);
    assert.strictEqual(result.opportunity.title, 'Enterprise Annual Subscription');
    assert.strictEqual(result.opportunity.amount, 50000);
    assert.strictEqual(result.opportunity.stage, OpportunityStage.QUALIFICATION);
    assert.strictEqual(result.opportunity.probability, 25);
    assert.strictEqual(result.opportunity.contactId, contact1);
    assert.strictEqual(result.opportunity.leadId, lead1Id);

    // 2. Check Lead status and stage update
    assert.strictEqual(result.lead.status, LeadStatus.CONVERTED);
    assert.strictEqual(result.lead.stage, LeadStage.WON);

    // 3. Check Contact customAttributes preservation and enhancement
    const contact = contactsDb.get(contact1);
    assert.strictEqual(contact.customAttributes.leadSource, 'organic');
    assert.strictEqual(contact.customAttributes.isOpportunity, true);
    assert.ok(contact.customAttributes.convertedAt);

    // 4. Verify post-commit events
    assert.strictEqual(emittedEvents.length, 2);
    assert.strictEqual(emittedEvents[0].event, DomainEvent.LEAD_CONVERTED);
    assert.strictEqual(emittedEvents[1].event, DomainEvent.OPPORTUNITY_CREATED);
  });

  it('should successfully convert using dealName alias and fallback stage/probability defaults', async () => {
    const result = await service.convertLead(ws1, lead1Id, {
      dealName: 'Enterprise Growth Deal',
      amount: 40000,
    });

    assert.strictEqual(result.opportunity.title, 'Enterprise Growth Deal');
    assert.strictEqual(result.opportunity.amount, 40000);
    assert.strictEqual(result.opportunity.stage, OpportunityStage.QUALIFICATION);
    assert.strictEqual(result.opportunity.probability, 25);
    assert.strictEqual(result.opportunity.currency, 'USD');
  });

  it('should reject conversion when neither title nor dealName is provided', async () => {
    await assert.rejects(
      async () => {
        await service.convertLead(ws1, lead1Id, {
          amount: 20000,
        } as any);
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'TITLE_REQUIRED');
        return true;
      },
    );
  });

  it('should reject conversion when title is shorter than 3 characters', async () => {
    await assert.rejects(
      async () => {
        await service.convertLead(ws1, lead1Id, {
          title: 'ab',
          amount: 20000,
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'TITLE_REQUIRED');
        return true;
      },
    );
  });

  it('should reject converting an already CONVERTED lead', async () => {
    leadsDb.get(lead1Id).status = LeadStatus.CONVERTED;

    await assert.rejects(
      async () => {
        await service.convertLead(ws1, lead1Id, {
          title: 'Second Opportunity Attempt',
          amount: 20000,
          currency: 'USD',
          stage: OpportunityStage.QUALIFICATION,
          probability: 25,
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'LEAD_ALREADY_CONVERTED');
        return true;
      },
    );
  });

  it('should throw 404 if lead is in a different workspace', async () => {
    await assert.rejects(
      async () => {
        await service.convertLead(ws2, lead1Id, {
          title: 'Cross Tenant Convert',
          amount: 20000,
          currency: 'USD',
          stage: OpportunityStage.QUALIFICATION,
          probability: 25,
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'LEAD_NOT_FOUND');
        return true;
      },
    );
  });

  it('should reject when assignee is not in the workspace', async () => {
    await assert.rejects(
      async () => {
        await service.convertLead(ws1, lead1Id, {
          title: 'Invalid Assignee Deal',
          amount: 20000,
          currency: 'USD',
          stage: OpportunityStage.QUALIFICATION,
          probability: 25,
          assignedUserId: userAlien,
        });
      },
      (err: any) => {
        assert.strictEqual(err.response?.code, 'ASSIGNEE_NOT_IN_WORKSPACE');
        return true;
      },
    );
  });

  it('should not fire post-commit hooks if transaction fails', async () => {
    // Override runInTransaction to simulate DB error
    mockPrismaService.runInTransaction = async (fn: any) => {
      const postCommitHooks: any[] = [];
      const ctx = {
        tx: {
          opportunity: {
            create: async () => {
              throw new Error('Simulated DB unique constraint violation');
            },
          },
          lead: mockPrismaService.client.lead,
          contact: mockPrismaService.client.contact,
        },
        addPostCommitHook: (h: any) => postCommitHooks.push(h),
      };

      await fn(ctx);
      for (const h of postCommitHooks) await h();
    };

    await assert.rejects(async () => {
      await service.convertLead(ws1, lead1Id, {
        title: 'Failing Transaction',
        amount: 15000,
        currency: 'USD',
        stage: OpportunityStage.QUALIFICATION,
        probability: 25,
      });
    });

    // Verify no events were fired
    assert.strictEqual(emittedEvents.length, 0);
  });

  it('should detect race condition and reject with LEAD_ALREADY_CONVERTED when updateMany returns count 0', async () => {
    // Simulate race condition: initial findFirst sees lead as QUALIFIED,
    // but in-flight concurrent transaction converts it, causing updateMany to match 0 records
    const origUpdateMany = mockPrismaService.client.lead.updateMany;
    mockPrismaService.client.lead.updateMany = async () => ({ count: 0 });

    try {
      await assert.rejects(
        async () => {
          await service.convertLead(ws1, lead1Id, {
            title: 'Race Condition Deal',
            amount: 30000,
            currency: 'USD',
            stage: OpportunityStage.QUALIFICATION,
            probability: 25,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LEAD_ALREADY_CONVERTED');
          return true;
        },
      );
    } finally {
      mockPrismaService.client.lead.updateMany = origUpdateMany;
    }
  });
});
