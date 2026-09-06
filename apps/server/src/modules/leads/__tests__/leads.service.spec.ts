import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DomainEvent, LeadGrade, LeadStage, LeadStatus } from '@sales-copilot/shared-contracts';
import { LeadsService } from '../leads.service';

describe('LeadsService (Lead Core & Lifecycle State Machine)', () => {
  let service: LeadsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let leadsDb: Map<string, any>;
  let membersDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';

  const user1 = 'usr_agent_1';
  const userOtherWs = 'usr_agent_other';

  const contact1 = 'ct_11111111-1111-4111-8111-111111111111';
  const contact2 = 'ct_22222222-2222-4222-8222-222222222222';
  const contactWs2 = 'ct_33333333-3333-4333-8333-333333333333';

  beforeEach(() => {
    contactsDb = new Map();
    leadsDb = new Map();
    membersDb = new Map();
    emittedEvents = [];

    // Seed contacts
    contactsDb.set(contact1, {
      id: contact1,
      workspaceId: ws1,
      name: 'Alice Johnson',
      email: 'alice@example.com',
      phoneNumber: '+1234567890',
      avatarUrl: null,
      customAttributes: {},
    });

    contactsDb.set(contact2, {
      id: contact2,
      workspaceId: ws1,
      name: 'Bob Smith',
      email: 'bob@example.com',
      phoneNumber: '+1987654321',
      avatarUrl: null,
      customAttributes: {},
    });

    contactsDb.set(contactWs2, {
      id: contactWs2,
      workspaceId: ws2,
      name: 'Charlie Tenant2',
      email: 'charlie@tenant2.com',
      phoneNumber: null,
      avatarUrl: null,
      customAttributes: {},
    });

    // Seed members
    membersDb.set(`${ws1}_${user1}`, {
      workspaceId: ws1,
      userId: user1,
    });
    membersDb.set(`${ws2}_${userOtherWs}`, {
      workspaceId: ws2,
      userId: userOtherWs,
    });

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    clientMock = {
      contact: {
        findFirst: async ({ where }: { where: any }) => {
          for (const c of contactsDb.values()) {
            if (where.id && c.id !== where.id) continue;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            return { ...c };
          }
          return null;
        },
      },
      workspaceMember: {
        findFirst: async ({ where }: { where: any }) => {
          const key = `${where.workspaceId}_${where.userId}`;
          return membersDb.get(key) || null;
        },
      },
      lead: {
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const l of leadsDb.values()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            if (where.contactId && l.contactId !== where.contactId) continue;

            const res = { ...l };
            if (include?.contact) {
              res.contact = contactsDb.get(l.contactId);
            }
            return res;
          }
          return null;
        },
        findMany: async ({ where, skip, take, orderBy }: any) => {
          let list = Array.from(leadsDb.values()).filter(l => {
            if (where.workspaceId && l.workspaceId !== where.workspaceId) return false;
            if (where.status && l.status !== where.status) return false;
            if (where.stage && l.stage !== where.stage) return false;
            if (where.assignedUserId && l.assignedUserId !== where.assignedUserId) return false;
            if (where.score) {
              if (where.score.gte !== undefined && l.score < where.score.gte) return false;
              if (where.score.lte !== undefined && l.score > where.score.lte) return false;
              if (where.score.lt !== undefined && l.score >= where.score.lt) return false;
            }
            if (where.contact?.OR) {
              const contact = contactsDb.get(l.contactId);
              const search = where.contact.OR[0].name.contains.toLowerCase();
              const matchName = contact?.name?.toLowerCase().includes(search);
              const matchEmail = contact?.email?.toLowerCase().includes(search);
              if (!matchName && !matchEmail) return false;
            }
            return true;
          });

          if (skip !== undefined && take !== undefined) {
            list = list.slice(skip, skip + take);
          }
          return list.map(l => ({
            ...l,
            contact: contactsDb.get(l.contactId),
          }));
        },
        count: async ({ where }: any) => {
          return Array.from(leadsDb.values()).filter(l => {
            if (where.workspaceId && l.workspaceId !== where.workspaceId) return false;
            if (where.status && l.status !== where.status) return false;
            if (where.stage && l.stage !== where.stage) return false;
            if (where.assignedUserId && l.assignedUserId !== where.assignedUserId) return false;
            if (where.score) {
              if (where.score.gte !== undefined && l.score < where.score.gte) return false;
              if (where.score.lte !== undefined && l.score > where.score.lte) return false;
              if (where.score.lt !== undefined && l.score >= where.score.lt) return false;
            }
            return true;
          }).length;
        },
        create: async ({ data, include }: any) => {
          const id = `lead_${Date.now()}_${Math.random()}`;
          const record = {
            id,
            workspaceId: data.workspaceId,
            contactId: data.contactId,
            status: data.status,
            stage: data.stage,
            score: data.score,
            assignedUserId: data.assignedUserId,
            estimatedValue: data.estimatedValue,
            currency: data.currency,
            metadata: data.metadata,
            lastActivityAt: data.lastActivityAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          leadsDb.set(id, record);
          const res: any = { ...record };
          if (include?.contact) res.contact = contactsDb.get(data.contactId);
          return res;
        },
        update: async ({ where, data, include }: any) => {
          const existing = leadsDb.get(where.id);
          if (!existing) throw new Error('Lead not found in mock DB');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          leadsDb.set(where.id, updated);
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

    service = new LeadsService(mockPrismaService, mockEventEmitter);
  });

  describe('createLead', () => {
    it('should successfully create a new lead with status NEW, score 0, grade JUNK', async () => {
      const result = await service.createLead(ws1, {
        contactId: contact1,
        estimatedValue: 10000,
        currency: 'USD',
        metadata: { source: 'web' },
      });

      assert.strictEqual(result.workspaceId, ws1);
      assert.strictEqual(result.contactId, contact1);
      assert.strictEqual(result.status, LeadStatus.NEW);
      assert.strictEqual(result.stage, LeadStage.DISCOVERY);
      assert.strictEqual(result.score, 0);
      assert.strictEqual(result.grade, LeadGrade.JUNK); // score 0 < 20 is JUNK
      assert.strictEqual(result.estimatedValue, 10000);
      assert.strictEqual(result.contact?.name, 'Alice Johnson');

      // Verify domain event emission
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.LEAD_CREATED);
      assert.strictEqual(emittedEvents[0].payload.leadId, result.id);
    });

    it('should reject when contact does not exist in the workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createLead(ws1, {
            contactId: 'ct_non_existent',
            currency: 'USD',
            metadata: {},
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should reject when contact belongs to a different workspace (tenant isolation)', async () => {
      await assert.rejects(
        async () => {
          await service.createLead(ws1, {
            contactId: contactWs2,
            currency: 'USD',
            metadata: {},
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should reject duplicate lead creation for same contact in same workspace', async () => {
      await service.createLead(ws1, {
        contactId: contact1,
        currency: 'USD',
        metadata: {},
      });

      await assert.rejects(
        async () => {
          await service.createLead(ws1, {
            contactId: contact1,
            currency: 'USD',
            metadata: {},
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LEAD_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should reject assignee when user is not a member of the workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createLead(ws1, {
            contactId: contact2,
            assignedUserId: userOtherWs,
            currency: 'USD',
            metadata: {},
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'ASSIGNEE_NOT_IN_WORKSPACE');
          return true;
        },
      );
    });

    it('should reject creating a lead directly with status CONVERTED', async () => {
      await assert.rejects(
        async () => {
          await service.createLead(ws1, {
            contactId: contact2,
            status: LeadStatus.CONVERTED,
            currency: 'USD',
            metadata: {},
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'USE_CONVERT_ENDPOINT');
          return true;
        },
      );
    });

    it('should catch Prisma P2002 error and throw LEAD_ALREADY_EXISTS on concurrent create', async () => {
      const client = mockPrismaService.client;
      const origCreate = client.lead.create;
      client.lead.create = async () => {
        const p2002Err: any = new Error('Unique constraint failed');
        p2002Err.code = 'P2002';
        throw p2002Err;
      };
      try {
        await assert.rejects(
          async () => {
            await service.createLead(ws1, {
              contactId: contact2,
              currency: 'USD',
              metadata: {},
            });
          },
          (err: any) => {
            assert.strictEqual(err.response?.code, 'LEAD_ALREADY_EXISTS');
            return true;
          },
        );
      } finally {
        client.lead.create = origCreate;
      }
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      const lead1 = await service.createLead(ws1, {
        contactId: contact1,
        currency: 'USD',
        metadata: {},
      });
      // artificially set score for testing grades
      leadsDb.get(lead1.id).score = 85;

      const lead2 = await service.createLead(ws1, {
        contactId: contact2,
        currency: 'USD',
        metadata: {},
      });
      leadsDb.get(lead2.id).score = 30;

      // Seed a lead in another workspace
      leadsDb.set('lead_ws2_alien', {
        id: 'lead_ws2_alien',
        workspaceId: ws2,
        contactId: contactWs2,
        status: LeadStatus.NEW,
        stage: LeadStage.DISCOVERY,
        score: 90,
        currency: 'USD',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    it('should list leads scoped strictly to the requesting workspace', async () => {
      const result = await service.findAll(ws1, {
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.total, 2);
      assert.ok(result.items.every(l => l.workspaceId === ws1));
    });

    it('should filter leads by grade HOT (score >= 80)', async () => {
      const result = await service.findAll(ws1, {
        page: 1,
        limit: 20,
        grade: LeadGrade.HOT,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].score, 85);
      assert.strictEqual(result.items[0].grade, LeadGrade.HOT);
    });

    it('should search leads by contact name', async () => {
      const result = await service.findAll(ws1, {
        page: 1,
        limit: 20,
        search: 'Alice',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].contact?.name, 'Alice Johnson');
    });

    it('should support empty query object with fallback defaults', async () => {
      const result = await service.findAll(ws1, {});

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.page, 1);
      assert.strictEqual(result.meta.limit, 20);
    });
  });

  describe('findById', () => {
    it('should return lead details when found in workspace', async () => {
      const created = await service.createLead(ws1, {
        contactId: contact1,
        currency: 'USD',
        metadata: {},
      });

      const found = await service.findById(ws1, created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.contactId, contact1);
    });

    it('should throw 404 when lead is not in the specified workspace', async () => {
      const created = await service.createLead(ws1, {
        contactId: contact1,
        currency: 'USD',
        metadata: {},
      });

      await assert.rejects(
        async () => {
          await service.findById(ws2, created.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LEAD_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('updateLead', () => {
    let activeLeadId: string;

    beforeEach(async () => {
      const created = await service.createLead(ws1, {
        contactId: contact1,
        currency: 'USD',
        metadata: {},
      });
      activeLeadId = created.id;
      emittedEvents = [];
    });

    it('should successfully update status, stage, and estimatedValue', async () => {
      const updated = await service.updateLead(ws1, activeLeadId, {
        status: LeadStatus.ENGAGED,
        stage: LeadStage.EVALUATION,
        estimatedValue: 45000,
      });

      assert.strictEqual(updated.status, LeadStatus.ENGAGED);
      assert.strictEqual(updated.stage, LeadStage.EVALUATION);
      assert.strictEqual(updated.estimatedValue, 45000);

      // Verify event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.LEAD_UPDATED);
    });

    it('should reject modification when lead is already CONVERTED', async () => {
      // Mark lead as CONVERTED
      leadsDb.get(activeLeadId).status = LeadStatus.CONVERTED;

      await assert.rejects(
        async () => {
          await service.updateLead(ws1, activeLeadId, {
            stage: LeadStage.PROPOSAL,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'LEAD_ALREADY_CONVERTED');
          return true;
        },
      );
    });

    it('should reject direct status change to CONVERTED via updateLead', async () => {
      await assert.rejects(
        async () => {
          await service.updateLead(ws1, activeLeadId, {
            status: LeadStatus.CONVERTED,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'USE_CONVERT_ENDPOINT');
          return true;
        },
      );
    });

    it('should reject reverting status of an already CONVERTED lead with INVALID_STATUS_TRANSITION', async () => {
      leadsDb.get(activeLeadId).status = LeadStatus.CONVERTED;

      await assert.rejects(
        async () => {
          await service.updateLead(ws1, activeLeadId, {
            status: LeadStatus.ENGAGED,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INVALID_STATUS_TRANSITION');
          assert.strictEqual(
            err.response?.message,
            'Converted leads cannot be reverted to active qualification stages',
          );
          return true;
        },
      );
    });

    it('should reject illegal status transition from QUALIFIED to NEW', async () => {
      leadsDb.get(activeLeadId).status = LeadStatus.QUALIFIED;

      await assert.rejects(
        async () => {
          await service.updateLead(ws1, activeLeadId, {
            status: LeadStatus.NEW,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INVALID_STATUS_TRANSITION');
          return true;
        },
      );
    });

    it('should allow valid status transitions according to state machine', async () => {
      // NEW -> CONTACTED
      const updated1 = await service.updateLead(ws1, activeLeadId, {
        status: LeadStatus.CONTACTED,
      });
      assert.strictEqual(updated1.status, LeadStatus.CONTACTED);

      // CONTACTED -> QUALIFIED
      const updated2 = await service.updateLead(ws1, activeLeadId, {
        status: LeadStatus.QUALIFIED,
      });
      assert.strictEqual(updated2.status, LeadStatus.QUALIFIED);
    });
  });

  describe('findByContactId', () => {
    it('should find lead by contactId within workspace', async () => {
      await service.createLead(ws1, { contactId: contact1 });
      const found = await service.findByContactId(ws1, contact1);
      assert.ok(found);
      assert.strictEqual(found?.contactId, contact1);
      assert.strictEqual(found?.workspaceId, ws1);
    });

    it('should return null if contact has no lead in workspace', async () => {
      const found = await service.findByContactId(ws1, 'non-existent-contact');
      assert.strictEqual(found, null);
    });
  });
});
