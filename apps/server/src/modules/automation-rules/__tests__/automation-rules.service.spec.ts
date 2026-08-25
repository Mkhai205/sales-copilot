import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AutomationRulesService } from '../automation-rules.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  ConversationPriority,
  ConversationStatus,
} from '@sales-copilot/shared-contracts';

describe('AutomationRulesService (Feature F-1.9.1)', () => {
  let service: AutomationRulesService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;
  let rulesDb: Map<string, any>;

  beforeEach(() => {
    rulesDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      automationRule: {
        findFirst: async ({ where }: { where: any }) => {
          for (const item of rulesDb.values()) {
            if (where.id && item.id !== where.id) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            return { ...item };
          }
          return null;
        },

        findMany: async ({
          where,
          orderBy,
        }: {
          where?: any;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          const results = Array.from(rulesDb.values()).filter((item: any) => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.isActive !== undefined && item.isActive !== where.isActive) return false;
            if (where?.eventTrigger && item.eventTrigger !== where.eventTrigger) return false;
            if (where?.OR && Array.isArray(where.OR)) {
              const matched = where.OR.some((condition: any) => {
                if (condition.name?.contains) {
                  const query = condition.name.contains.toLowerCase();
                  if (item.name.toLowerCase().includes(query)) return true;
                }
                if (condition.description?.contains) {
                  const query = condition.description.contains.toLowerCase();
                  if (item.description?.toLowerCase().includes(query)) return true;
                }
                return false;
              });
              if (!matched) return false;
            }
            return true;
          });

          if (orderBy?.createdAt === 'asc') {
            results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          } else if (orderBy?.createdAt === 'desc') {
            results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }

          return results.map(item => ({ ...item }));
        },

        create: async ({ data }: { data: any }) => {
          const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const record = {
            id,
            workspaceId: data.workspaceId,
            name: data.name,
            description: data.description ?? null,
            eventTrigger: data.eventTrigger,
            conditions: data.conditions ?? [],
            actions: data.actions ?? [],
            isActive: data.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          rulesDb.set(id, record);
          return { ...record };
        },

        update: async ({ where, data }: { where: any; data: any }) => {
          const existing = rulesDb.get(where.id);
          if (!existing) throw new Error('Record not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          rulesDb.set(where.id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: any }) => {
          const existing = rulesDb.get(where.id);
          if (!existing) throw new Error('Record not found');
          rulesDb.delete(where.id);
          return { ...existing };
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new AutomationRulesService(mockPrismaService, mockEventEmitter);
  });

  describe('create()', () => {
    it('should create an automation rule successfully and emit event', async () => {
      const workspaceId = 'ws_123';
      const actorUserId = 'usr_admin';
      const dto = {
        name: 'VIP Auto Assign',
        description: 'Assigns VIP customers to support team',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [
          {
            attribute: AutomationAttribute.STATUS,
            operator: AutomationOperator.EQUAL,
            values: [ConversationStatus.OPEN],
          },
        ],
        actions: [
          {
            type: AutomationActionType.ASSIGN_TEAM as const,
            params: { teamId: 'team_support' },
          },
          {
            type: AutomationActionType.CHANGE_PRIORITY as const,
            params: { priority: ConversationPriority.HIGH },
          },
        ],
        isActive: true,
      };

      const result = await service.create(workspaceId, dto, actorUserId);

      assert.ok(result.id);
      assert.strictEqual(result.name, 'VIP Auto Assign');
      assert.strictEqual(result.eventTrigger, AutomationEventTrigger.CONVERSATION_CREATED);
      assert.strictEqual(result.conditions.length, 1);
      assert.strictEqual(result.actions.length, 2);
      assert.strictEqual(result.isActive, true);

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'automation_rule.created');
      assert.strictEqual(emittedEvents[0].payload.workspaceId, workspaceId);
      assert.strictEqual(emittedEvents[0].payload.userId, actorUserId);
      assert.strictEqual(emittedEvents[0].payload.rule.id, result.id);
    });

    it('should reject when rule name is empty or solely whitespace', async () => {
      const workspaceId = 'ws_123';
      await assert.rejects(
        async () => {
          await service.create(workspaceId, {
            name: '   ',
            eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
            conditions: [],
            actions: [
              {
                type: AutomationActionType.ADD_LABEL,
                params: { labelTitle: 'vip' },
              },
            ],
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'INVALID_RULE_NAME');
          return true;
        },
      );
    });
  });

  describe('list()', () => {
    it('should return rules for a workspace ordered by createdAt ASC', async () => {
      const workspaceId = 'ws_123';

      const rule1 = await service.create(workspaceId, {
        name: 'First Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'first' } }],
      });

      const rule2 = await service.create(workspaceId, {
        name: 'Second Rule',
        eventTrigger: AutomationEventTrigger.CONVERSATION_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'second' } }],
      });

      const list = await service.list(workspaceId);
      assert.strictEqual(list.length, 2);
      assert.strictEqual(list[0].id, rule1.id);
      assert.strictEqual(list[1].id, rule2.id);
    });

    it('should filter rules by isActive and eventTrigger', async () => {
      const workspaceId = 'ws_123';

      await service.create(workspaceId, {
        name: 'Active Message Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'msg' } }],
        isActive: true,
      });

      await service.create(workspaceId, {
        name: 'Inactive Message Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'msg' } }],
        isActive: false,
      });

      await service.create(workspaceId, {
        name: 'Active Status Rule',
        eventTrigger: AutomationEventTrigger.CONVERSATION_STATUS_CHANGED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'status' } }],
        isActive: true,
      });

      const activeRules = await service.list(workspaceId, { isActive: true });
      assert.strictEqual(activeRules.length, 2);

      const messageTriggerRules = await service.list(workspaceId, {
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
      });
      assert.strictEqual(messageTriggerRules.length, 2);

      const activeMessageRules = await service.list(workspaceId, {
        isActive: true,
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
      });
      assert.strictEqual(activeMessageRules.length, 1);
      assert.strictEqual(activeMessageRules[0].name, 'Active Message Rule');
    });

    it('should search rules by name and description', async () => {
      const workspaceId = 'ws_123';

      await service.create(workspaceId, {
        name: 'Routing Rule for Sales',
        description: 'Handles incoming sales inquiries',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'sales' } }],
      });

      await service.create(workspaceId, {
        name: 'Billing Support',
        description: 'Routes billing inquiries',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'billing' } }],
      });

      const searchSales = await service.list(workspaceId, { search: 'sales' });
      assert.strictEqual(searchSales.length, 1);
      assert.strictEqual(searchSales[0].name, 'Routing Rule for Sales');

      const searchInquiries = await service.list(workspaceId, { q: 'inquiries' });
      assert.strictEqual(searchInquiries.length, 2);
    });

    it('should strictly isolate rules across tenants', async () => {
      const wsA = 'ws_A';
      const wsB = 'ws_B';

      await service.create(wsA, {
        name: 'Tenant A Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'A' } }],
      });

      await service.create(wsB, {
        name: 'Tenant B Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'B' } }],
      });

      const listA = await service.list(wsA);
      assert.strictEqual(listA.length, 1);
      assert.strictEqual(listA[0].name, 'Tenant A Rule');

      const listB = await service.list(wsB);
      assert.strictEqual(listB.length, 1);
      assert.strictEqual(listB[0].name, 'Tenant B Rule');
    });
  });

  describe('getById()', () => {
    it('should return rule by ID', async () => {
      const workspaceId = 'ws_123';
      const created = await service.create(workspaceId, {
        name: 'Get Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'get' } }],
      });

      const found = await service.getById(workspaceId, created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.name, 'Get Rule');
    });

    it('should throw NotFoundException if rule does not exist', async () => {
      await assert.rejects(
        async () => {
          await service.getById('ws_123', 'non_existent_id');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'AUTOMATION_RULE_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException if rule belongs to another workspace', async () => {
      const created = await service.create('ws_A', {
        name: 'Tenant A Rule',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'A' } }],
      });

      await assert.rejects(
        async () => {
          await service.getById('ws_B', created.id);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'AUTOMATION_RULE_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('update()', () => {
    it('should update rule fields and emit event', async () => {
      const workspaceId = 'ws_123';
      const actorUserId = 'usr_admin';
      const created = await service.create(workspaceId, {
        name: 'Initial Name',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'init' } }],
        isActive: true,
      });

      const updated = await service.update(
        workspaceId,
        created.id,
        {
          name: 'Updated Name',
          isActive: false,
        },
        actorUserId,
      );

      assert.strictEqual(updated.name, 'Updated Name');
      assert.strictEqual(updated.isActive, false);

      const updateEvent = emittedEvents.find(e => e.event === 'automation_rule.updated');
      assert.ok(updateEvent);
      assert.strictEqual(updateEvent.payload.workspaceId, workspaceId);
      assert.strictEqual(updateEvent.payload.userId, actorUserId);
      assert.strictEqual(updateEvent.payload.rule.name, 'Updated Name');
    });

    it('should throw BadRequestException when updated name is empty', async () => {
      const workspaceId = 'ws_123';
      const created = await service.create(workspaceId, {
        name: 'Valid Name',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'valid' } }],
      });

      await assert.rejects(
        async () => {
          await service.update(workspaceId, created.id, { name: '   ' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'INVALID_RULE_NAME');
          return true;
        },
      );
    });

    it('should throw NotFoundException when updating non-existent rule', async () => {
      await assert.rejects(
        async () => {
          await service.update('ws_123', 'non_existent_id', { name: 'Test' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'AUTOMATION_RULE_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('delete()', () => {
    it('should delete rule and emit event', async () => {
      const workspaceId = 'ws_123';
      const actorUserId = 'usr_admin';
      const created = await service.create(workspaceId, {
        name: 'To Delete',
        eventTrigger: AutomationEventTrigger.MESSAGE_CREATED,
        conditions: [],
        actions: [{ type: AutomationActionType.ADD_LABEL, params: { labelTitle: 'del' } }],
      });

      const result = await service.delete(workspaceId, created.id, actorUserId);
      assert.deepStrictEqual(result, { success: true });

      const deletedEvent = emittedEvents.find(e => e.event === 'automation_rule.deleted');
      assert.ok(deletedEvent);
      assert.strictEqual(deletedEvent.payload.workspaceId, workspaceId);
      assert.strictEqual(deletedEvent.payload.ruleId, created.id);
      assert.strictEqual(deletedEvent.payload.name, 'To Delete');
      assert.strictEqual(deletedEvent.payload.userId, actorUserId);

      // Verify rule is gone
      await assert.rejects(async () => {
        await service.getById(workspaceId, created.id);
      }, NotFoundException);
    });

    it('should throw NotFoundException when deleting non-existent rule', async () => {
      await assert.rejects(
        async () => {
          await service.delete('ws_123', 'non_existent_id');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual((err.getResponse() as any)?.code, 'AUTOMATION_RULE_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
