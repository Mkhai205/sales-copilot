import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConversationsService } from '../conversations.service';
import {
  ConversationPriority,
  ConversationStatus,
  Priority,
} from '@sales-copilot/shared-contracts';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ConversationsService (Core & State Machine)', () => {
  let service: ConversationsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let inboxMembersDb: Map<string, any>;
  let channelIdentitiesDb: Map<string, any>;
  let teamsDb: Map<string, any>;
  let labelsDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let conversationLabelsDb: Map<string, any>;

  beforeEach(() => {
    contactsDb = new Map();
    inboxesDb = new Map();
    inboxMembersDb = new Map();
    channelIdentitiesDb = new Map();
    teamsDb = new Map();
    labelsDb = new Map();
    conversationsDb = new Map();
    conversationLabelsDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    // Seed test fixtures
    contactsDb.set('cnt_1', {
      id: 'cnt_1',
      workspaceId: 'ws_1',
      name: 'John Doe',
      email: 'john@example.com',
      phoneNumber: '+84987654321',
      identifier: 'c_john',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    inboxesDb.set('ib_1', {
      id: 'ib_1',
      workspaceId: 'ws_1',
      name: 'General Support',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed agents as members of ib_1
    inboxMembersDb.set('ib_1_usr_agent_1', {
      id: 'im_1',
      inboxId: 'ib_1',
      userId: 'usr_agent_1',
      createdAt: new Date(),
    });

    inboxMembersDb.set('ib_1_usr_agent_2', {
      id: 'im_2',
      inboxId: 'ib_1',
      userId: 'usr_agent_2',
      createdAt: new Date(),
    });

    channelIdentitiesDb.set('ci_1', {
      id: 'ci_1',
      workspaceId: 'ws_1',
      contactId: 'cnt_1',
      channelId: 'ch_1',
      externalContactId: 'fb_123',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    teamsDb.set('tm_1', {
      id: 'tm_1',
      workspaceId: 'ws_1',
      name: 'Tier 1 Support',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    labelsDb.set('lbl_1', {
      id: 'lbl_1',
      workspaceId: 'ws_1',
      title: 'VIP',
      color: '#FF0000',
      showOnSidebar: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    labelsDb.set('lbl_2', {
      id: 'lbl_2',
      workspaceId: 'ws_1',
      title: 'Billing',
      color: '#00FF00',
      showOnSidebar: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const clientMock = {
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
      inbox: {
        findFirst: async ({ where }: { where: any }) => {
          for (const ib of inboxesDb.values()) {
            if (where.id && ib.id !== where.id) continue;
            if (where.workspaceId && ib.workspaceId !== where.workspaceId) continue;
            return { ...ib };
          }
          return null;
        },
      },
      inboxMember: {
        findUnique: async ({ where }: { where: any }) => {
          const key = `${where.inboxId_userId.inboxId}_${where.inboxId_userId.userId}`;
          const found = inboxMembersDb.get(key);
          return found ? { ...found } : null;
        },
      },
      channelIdentity: {
        findFirst: async ({ where }: { where: any }) => {
          for (const ci of channelIdentitiesDb.values()) {
            if (where.id && ci.id !== where.id) continue;
            if (where.workspaceId && ci.workspaceId !== where.workspaceId) continue;
            if (where.contactId && ci.contactId !== where.contactId) continue;
            return { ...ci };
          }
          return null;
        },
      },
      team: {
        findFirst: async ({ where }: { where: any }) => {
          for (const tm of teamsDb.values()) {
            if (where.id && tm.id !== where.id) continue;
            if (where.workspaceId && tm.workspaceId !== where.workspaceId) continue;
            return { ...tm };
          }
          return null;
        },
      },
      label: {
        findMany: async ({ where }: { where: any }) => {
          return Array.from(labelsDb.values())
            .filter((l: any) => {
              if (where?.workspaceId && l.workspaceId !== where.workspaceId) return false;
              if (where?.id?.in && !where.id.in.includes(l.id)) return false;
              return true;
            })
            .map(l => ({ ...l }));
        },
        findFirst: async ({ where }: { where: any }) => {
          for (const l of labelsDb.values()) {
            if (where.id && l.id !== where.id) continue;
            if (where.workspaceId && l.workspaceId !== where.workspaceId) continue;
            return { ...l };
          }
          return null;
        },
      },
      conversationLabel: {
        findUnique: async ({ where }: { where: any }) => {
          const key = `${where.conversationId_labelId.conversationId}_${where.conversationId_labelId.labelId}`;
          const found = conversationLabelsDb.get(key);
          return found ? { ...found } : null;
        },
        create: async ({ data }: { data: any }) => {
          const key = `${data.conversationId}_${data.labelId}`;
          const record = {
            conversationId: data.conversationId,
            labelId: data.labelId,
            createdAt: new Date(),
            label: labelsDb.get(data.labelId),
          };
          conversationLabelsDb.set(key, record);
          return { ...record };
        },
        createMany: async ({ data, skipDuplicates }: { data: any[]; skipDuplicates?: boolean }) => {
          let count = 0;
          for (const item of data) {
            const key = `${item.conversationId}_${item.labelId}`;
            if (conversationLabelsDb.has(key) && skipDuplicates) continue;
            const record = {
              conversationId: item.conversationId,
              labelId: item.labelId,
              createdAt: new Date(),
              label: labelsDb.get(item.labelId),
            };
            conversationLabelsDb.set(key, record);
            count++;
          }
          return { count };
        },
        delete: async ({ where }: { where: any }) => {
          const key = `${where.conversationId_labelId.conversationId}_${where.conversationId_labelId.labelId}`;
          const existing = conversationLabelsDb.get(key);
          if (existing) {
            conversationLabelsDb.delete(key);
          }
          return existing;
        },
        findMany: async ({ where, orderBy }: { where: any; orderBy?: any }) => {
          const list = Array.from(conversationLabelsDb.values())
            .filter((cl: any) => cl.conversationId === where.conversationId)
            .map((cl: any) => ({
              ...cl,
              label: labelsDb.get(cl.labelId),
            }));
          if (orderBy?.label?.title === 'asc') {
            list.sort((a, b) => (a.label?.title || '').localeCompare(b.label?.title || ''));
          }
          return list;
        },
      },
      conversation: {
        findFirst: async ({ where }: { where: any }) => {
          for (const conv of conversationsDb.values()) {
            if (where.id && conv.id !== where.id) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            if (where.contactId && conv.contactId !== where.contactId) continue;
            if (where.inboxId && conv.inboxId !== where.inboxId) continue;
            if (where.status?.in && !where.status.in.includes(conv.status)) continue;

            const labels = Array.from(conversationLabelsDb.values())
              .filter(cl => cl.conversationId === conv.id)
              .map(cl => ({ label: labelsDb.get(cl.labelId) }));

            return { ...conv, labels };
          }
          return null;
        },
        findMany: async ({
          where,
          skip = 0,
          take = 20,
          orderBy,
        }: {
          where?: any;
          skip?: number;
          take?: number;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          const results = Array.from(conversationsDb.values()).filter((conv: any) => {
            if (where?.workspaceId && conv.workspaceId !== where.workspaceId) return false;
            if (where?.status && conv.status !== where.status) return false;
            if (where?.inboxId && conv.inboxId !== where.inboxId) return false;
            if (where?.assigneeId === null && conv.assigneeId !== null) return false;
            if (
              where?.assigneeId &&
              where.assigneeId !== null &&
              conv.assigneeId !== where.assigneeId
            )
              return false;
            if (where?.teamId && conv.teamId !== where.teamId) return false;
            if (where?.contactId && conv.contactId !== where.contactId) return false;
            if (where?.priority && conv.priority !== where.priority) return false;
            if (where?.labels?.some?.labelId) {
              const hasLabel = Array.from(conversationLabelsDb.values()).some(
                cl => cl.conversationId === conv.id && cl.labelId === where.labels.some.labelId,
              );
              if (!hasLabel) return false;
            }
            return true;
          });

          if (orderBy) {
            const [field, direction] = Object.entries(orderBy)[0];
            results.sort((a, b) => {
              if (direction === 'asc') {
                return a[field] > b[field] ? 1 : -1;
              }
              return a[field] < b[field] ? 1 : -1;
            });
          }

          return results.slice(skip, skip + take).map(c => {
            const labels = Array.from(conversationLabelsDb.values())
              .filter(cl => cl.conversationId === c.id)
              .map(cl => ({ label: labelsDb.get(cl.labelId) }));
            return { ...c, labels };
          });
        },
        count: async ({ where }: { where?: any }) => {
          return Array.from(conversationsDb.values()).filter((conv: any) => {
            if (where?.workspaceId && conv.workspaceId !== where.workspaceId) return false;
            if (where?.status && conv.status !== where.status) return false;
            return true;
          }).length;
        },
        create: async ({ data }: { data: any }) => {
          const id = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const displayId = conversationsDb.size + 1;
          const now = new Date();
          const newConv = {
            id,
            displayId,
            workspaceId: data.workspaceId,
            inboxId: data.inboxId,
            contactId: data.contactId,
            channelIdentityId: data.channelIdentityId ?? null,
            assigneeId: data.assigneeId ?? null,
            teamId: data.teamId ?? null,
            status: data.status ?? ConversationStatus.OPEN,
            priority: data.priority ?? ConversationPriority.MEDIUM,
            snoozedUntil: data.snoozedUntil ?? null,
            waitingSince: data.waitingSince ?? null,
            firstReplyCreatedAt: data.firstReplyCreatedAt ?? null,
            lastActivityAt: data.lastActivityAt ?? now,
            unreadMessagesCount: data.unreadMessagesCount ?? 0,
            customAttributes: data.customAttributes ?? {},
            createdAt: now,
            updatedAt: now,
            contact: contactsDb.get(data.contactId),
            inbox: inboxesDb.get(data.inboxId),
            labels: [],
            messages: [],
          };
          conversationsDb.set(id, newConv);
          return { ...newConv };
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = conversationsDb.get(where.id);
          if (!existing) {
            throw new Error(`Conversation ${where.id} not found`);
          }
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          conversationsDb.set(where.id, updated);
          const labels = Array.from(conversationLabelsDb.values())
            .filter(cl => cl.conversationId === where.id)
            .map(cl => ({ label: labelsDb.get(cl.labelId) }));
          return { ...updated, labels };
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new ConversationsService(mockPrismaService, mockEventEmitter as any);
  });

  describe('create', () => {
    it('should create conversation with defaults and emit conversation.created', async () => {
      const conv = await service.create('ws_1', {
        contactId: 'cnt_1',
        inboxId: 'ib_1',
      });

      assert.strictEqual(conv.workspaceId, 'ws_1');
      assert.strictEqual(conv.contactId, 'cnt_1');
      assert.strictEqual(conv.inboxId, 'ib_1');
      assert.strictEqual(conv.status, ConversationStatus.OPEN);
      assert.strictEqual(conv.priority, ConversationPriority.MEDIUM);
      assert.strictEqual(conv.unreadMessagesCount, 0);

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'conversation.created');
      assert.strictEqual(emittedEvents[0].payload.conversation.id, conv.id);
    });

    it('should throw NotFoundException if contact does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            contactId: 'cnt_unknown',
            inboxId: 'ib_1',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException if inbox does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            contactId: 'cnt_1',
            inboxId: 'ib_unknown',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException if assignee is not a member of the inbox', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            contactId: 'cnt_1',
            inboxId: 'ib_1',
            assigneeId: 'usr_stranger',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'ASSIGNEE_NOT_IN_INBOX');
          return true;
        },
      );
    });

    it('should successfully create conversation with valid assignee and team', async () => {
      const conv = await service.create('ws_1', {
        contactId: 'cnt_1',
        inboxId: 'ib_1',
        channelIdentityId: 'ci_1',
        assigneeId: 'usr_agent_1',
        teamId: 'tm_1',
        priority: Priority.HIGH,
      });

      assert.strictEqual(conv.assigneeId, 'usr_agent_1');
      assert.strictEqual(conv.teamId, 'tm_1');
      assert.strictEqual(conv.priority, ConversationPriority.HIGH);
    });
  });

  describe('updateStatus (State Machine BR-4.1)', () => {
    let convId: string;

    beforeEach(async () => {
      const conv = await service.create('ws_1', {
        contactId: 'cnt_1',
        inboxId: 'ib_1',
      });
      convId = conv.id;
      emittedEvents = [];
    });

    it('should transition OPEN -> PENDING', async () => {
      const updated = await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.PENDING,
      });

      assert.strictEqual(updated.status, ConversationStatus.PENDING);
      assert.strictEqual(
        emittedEvents.some(e => e.event === 'conversation.status_updated'),
        true,
      );
    });

    it('should transition OPEN -> SNOOZED with valid future date', async () => {
      const futureTime = new Date(Date.now() + 86400000).toISOString();
      const updated = await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.SNOOZED,
        snoozedUntil: futureTime,
      });

      assert.strictEqual(updated.status, ConversationStatus.SNOOZED);
      assert.strictEqual(updated.snoozedUntil, futureTime);
    });

    it('should reject transition to SNOOZED without snoozedUntil', async () => {
      await assert.rejects(
        async () => {
          await service.updateStatus('ws_1', convId, {
            status: ConversationStatus.SNOOZED,
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SNOOZED_UNTIL');
          return true;
        },
      );
    });

    it('should reject transition to SNOOZED with past date', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString();
      await assert.rejects(
        async () => {
          await service.updateStatus('ws_1', convId, {
            status: ConversationStatus.SNOOZED,
            snoozedUntil: pastTime,
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SNOOZED_UNTIL');
          return true;
        },
      );
    });

    it('should transition OPEN -> RESOLVED', async () => {
      const updated = await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.RESOLVED,
      });

      assert.strictEqual(updated.status, ConversationStatus.RESOLVED);
    });

    it('should transition RESOLVED -> OPEN and emit conversation.reopened', async () => {
      await service.updateStatus('ws_1', convId, { status: ConversationStatus.RESOLVED });
      emittedEvents = [];

      const reopened = await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.OPEN,
      });

      assert.strictEqual(reopened.status, ConversationStatus.OPEN);
      assert.strictEqual(
        emittedEvents.some(e => e.event === 'conversation.status_updated'),
        true,
      );
      assert.strictEqual(
        emittedEvents.some(e => e.event === 'conversation.reopened'),
        true,
      );
    });

    it('should reject invalid transition RESOLVED -> PENDING with 400', async () => {
      await service.updateStatus('ws_1', convId, { status: ConversationStatus.RESOLVED });

      await assert.rejects(
        async () => {
          await service.updateStatus('ws_1', convId, { status: ConversationStatus.PENDING });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_STATUS_TRANSITION');
          return true;
        },
      );
    });

    it('should reject invalid transition SNOOZED -> PENDING with 400', async () => {
      const future = new Date(Date.now() + 3600000).toISOString();
      await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.SNOOZED,
        snoozedUntil: future,
      });

      await assert.rejects(
        async () => {
          await service.updateStatus('ws_1', convId, { status: ConversationStatus.PENDING });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_STATUS_TRANSITION');
          return true;
        },
      );
    });

    it('should return existing without error on same status (idempotent)', async () => {
      const result = await service.updateStatus('ws_1', convId, {
        status: ConversationStatus.OPEN,
      });
      assert.strictEqual(result.status, ConversationStatus.OPEN);
    });
  });

  describe('assign (Manual Assignment F-1.8.2)', () => {
    let convId: string;

    beforeEach(async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      convId = conv.id;
      emittedEvents = [];
    });

    it('should assign valid agent and team and emit conversation.assigned', async () => {
      const assigned = await service.assign(
        'ws_1',
        convId,
        {
          assigneeId: 'usr_agent_1',
          teamId: 'tm_1',
        },
        'usr_admin',
      );

      assert.strictEqual(assigned.assigneeId, 'usr_agent_1');
      assert.strictEqual(assigned.teamId, 'tm_1');

      const assignEvent = emittedEvents.find(e => e.event === 'conversation.assigned');
      assert.ok(assignEvent);
      assert.strictEqual(assignEvent.payload.workspaceId, 'ws_1');
      assert.strictEqual(assignEvent.payload.conversationId, convId);
      assert.strictEqual(assignEvent.payload.previousAssigneeId, null);
      assert.strictEqual(assignEvent.payload.newAssigneeId, 'usr_agent_1');
      assert.strictEqual(assignEvent.payload.teamId, 'tm_1');
      assert.strictEqual(assignEvent.payload.assignedByUserId, 'usr_admin');
      assert.strictEqual(assignEvent.payload.conversation.id, convId);
    });

    it('should throw NotFoundException if conversation does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.assign('ws_wrong', convId, { assigneeId: 'usr_agent_1' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'CONVERSATION_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException if assignee is not in inbox members', async () => {
      await assert.rejects(
        async () => {
          await service.assign('ws_1', convId, { assigneeId: 'usr_outsider' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'ASSIGNEE_NOT_IN_INBOX');
          return true;
        },
      );
    });

    it('should throw NotFoundException if team does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.assign('ws_1', convId, { teamId: 'tm_nonexistent' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'TEAM_NOT_FOUND');
          return true;
        },
      );
    });

    it('should reassign conversation from agent 1 to agent 2 and emit previousAssigneeId and newAssigneeId', async () => {
      await service.assign('ws_1', convId, { assigneeId: 'usr_agent_1' }, 'usr_admin');
      emittedEvents = [];

      const reassigned = await service.assign(
        'ws_1',
        convId,
        { assigneeId: 'usr_agent_2' },
        'usr_supervisor',
      );

      assert.strictEqual(reassigned.assigneeId, 'usr_agent_2');

      const assignEvent = emittedEvents.find(e => e.event === 'conversation.assigned');
      assert.ok(assignEvent);
      assert.strictEqual(assignEvent.payload.previousAssigneeId, 'usr_agent_1');
      assert.strictEqual(assignEvent.payload.newAssigneeId, 'usr_agent_2');
      assert.strictEqual(assignEvent.payload.assignedByUserId, 'usr_supervisor');
    });

    it('should allow assigning only team without altering existing assignee', async () => {
      await service.assign('ws_1', convId, { assigneeId: 'usr_agent_1' });
      emittedEvents = [];

      const updated = await service.assign('ws_1', convId, { teamId: 'tm_1' });

      assert.strictEqual(updated.assigneeId, 'usr_agent_1');
      assert.strictEqual(updated.teamId, 'tm_1');
    });

    it('should allow unassigning agent by passing null', async () => {
      await service.assign('ws_1', convId, { assigneeId: 'usr_agent_1', teamId: 'tm_1' });
      emittedEvents = [];

      const unassigned = await service.assign('ws_1', convId, { assigneeId: null });

      assert.strictEqual(unassigned.assigneeId, null);
      assert.strictEqual(unassigned.teamId, 'tm_1');

      const assignEvent = emittedEvents.find(e => e.event === 'conversation.assigned');
      assert.ok(assignEvent);
      assert.strictEqual(assignEvent.payload.previousAssigneeId, 'usr_agent_1');
      assert.strictEqual(assignEvent.payload.newAssigneeId, null);
    });

    it('should allow unassigning team by passing null', async () => {
      await service.assign('ws_1', convId, { assigneeId: 'usr_agent_1', teamId: 'tm_1' });
      emittedEvents = [];

      const unassigned = await service.assign('ws_1', convId, { teamId: null });

      assert.strictEqual(unassigned.assigneeId, 'usr_agent_1');
      assert.strictEqual(unassigned.teamId, null);
    });

    it('should allow unassigning both assignee and team simultaneously', async () => {
      await service.assign('ws_1', convId, { assigneeId: 'usr_agent_1', teamId: 'tm_1' });
      emittedEvents = [];

      const unassigned = await service.assign('ws_1', convId, { assigneeId: null, teamId: null });

      assert.strictEqual(unassigned.assigneeId, null);
      assert.strictEqual(unassigned.teamId, null);

      const assignEvent = emittedEvents.find(e => e.event === 'conversation.assigned');
      assert.ok(assignEvent);
      assert.strictEqual(assignEvent.payload.previousAssigneeId, 'usr_agent_1');
      assert.strictEqual(assignEvent.payload.newAssigneeId, null);
      assert.strictEqual(assignEvent.payload.teamId, null);
    });
  });

  describe('updatePriority', () => {
    it('should update priority and emit conversation.priority_updated', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      emittedEvents = [];

      const updated = await service.updatePriority('ws_1', conv.id, {
        priority: Priority.URGENT,
      });

      assert.strictEqual(updated.priority, ConversationPriority.URGENT);

      const priorityEvent = emittedEvents.find(e => e.event === 'conversation.priority_updated');
      assert.ok(priorityEvent);
      assert.strictEqual(priorityEvent.payload.currentPriority, Priority.URGENT);
    });
  });

  describe('resetUnreadCount', () => {
    it('should reset unread count to 0', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      // Simulate unread count
      conversationsDb.get(conv.id).unreadMessagesCount = 5;

      const reset = await service.resetUnreadCount('ws_1', conv.id);
      assert.strictEqual(reset.unreadMessagesCount, 0);
    });
  });

  describe('findActiveByContactAndInbox & findOrCreateActiveConversation', () => {
    it('should find active conversation if exists', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });

      const found = await service.findActiveByContactAndInbox('ws_1', 'cnt_1', 'ib_1');
      assert.ok(found);
      assert.strictEqual(found.id, conv.id);
    });

    it('should return null if only RESOLVED conversations exist', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      await service.updateStatus('ws_1', conv.id, { status: ConversationStatus.RESOLVED });

      const found = await service.findActiveByContactAndInbox('ws_1', 'cnt_1', 'ib_1');
      assert.strictEqual(found, null);
    });

    it('should auto-reopen if findOrCreateActiveConversation hits a SNOOZED conversation', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      const future = new Date(Date.now() + 3600000).toISOString();
      await service.updateStatus('ws_1', conv.id, {
        status: ConversationStatus.SNOOZED,
        snoozedUntil: future,
      });

      const active = await service.findOrCreateActiveConversation('ws_1', {
        contactId: 'cnt_1',
        inboxId: 'ib_1',
      });

      assert.strictEqual(active.id, conv.id);
      assert.strictEqual(active.status, ConversationStatus.OPEN);
    });

    it('should create new conversation if findOrCreateActiveConversation finds no active', async () => {
      const active = await service.findOrCreateActiveConversation('ws_1', {
        contactId: 'cnt_1',
        inboxId: 'ib_1',
      });

      assert.ok(active);
      assert.strictEqual(active.status, ConversationStatus.OPEN);
    });
  });

  describe('list & getById', () => {
    it('should list conversations with pagination and filter', async () => {
      await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      const res = await service.list('ws_1', { status: ConversationStatus.OPEN });

      assert.strictEqual(res.items.length, 1);
      assert.strictEqual(res.meta.total, 1);
      assert.strictEqual(res.meta.page, 1);
    });

    it('should get conversation by ID or throw NotFoundException', async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      const found = await service.getById('ws_1', conv.id);

      assert.strictEqual(found.id, conv.id);

      await assert.rejects(async () => {
        await service.getById('ws_1', 'non_existent');
      }, NotFoundException);
    });
  });

  describe('assignLabels & removeLabel & getLabels', () => {
    let convId: string;

    beforeEach(async () => {
      const conv = await service.create('ws_1', { contactId: 'cnt_1', inboxId: 'ib_1' });
      convId = conv.id;
      emittedEvents = [];
    });

    it('should assign labels to conversation and emit conversation.labels_updated', async () => {
      const labels = await service.assignLabels('ws_1', convId, ['lbl_1', 'lbl_2']);

      assert.strictEqual(labels.length, 2);
      assert.strictEqual(labels[0].title, 'Billing');
      assert.strictEqual(labels[1].title, 'VIP');

      const labelEvent = emittedEvents.find(e => e.event === 'conversation.labels_updated');
      assert.ok(labelEvent);
      assert.strictEqual(labelEvent.payload.labelIds.length, 2);
    });

    it('should be idempotent when assigning the same label again', async () => {
      await service.assignLabels('ws_1', convId, ['lbl_1']);
      const labels = await service.assignLabels('ws_1', convId, ['lbl_1']);

      assert.strictEqual(labels.length, 1);
      assert.strictEqual(labels[0].id, 'lbl_1');
    });

    it('should throw NotFoundException if label does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.assignLabels('ws_1', convId, ['lbl_unknown']);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'LABEL_NOT_FOUND');
          return true;
        },
      );
    });

    it('should remove label from conversation and emit conversation.labels_updated', async () => {
      await service.assignLabels('ws_1', convId, ['lbl_1', 'lbl_2']);
      emittedEvents = [];

      const result = await service.removeLabel('ws_1', convId, 'lbl_1');
      assert.deepStrictEqual(result, { success: true });

      const remaining = await service.getLabels('ws_1', convId);
      assert.strictEqual(remaining.length, 1);
      assert.strictEqual(remaining[0].id, 'lbl_2');

      const labelEvent = emittedEvents.find(e => e.event === 'conversation.labels_updated');
      assert.ok(labelEvent);
      assert.strictEqual(labelEvent.payload.labelIds.length, 1);
    });

    it('should throw NotFoundException when removing unassigned label', async () => {
      await assert.rejects(
        async () => {
          await service.removeLabel('ws_1', convId, 'lbl_1');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'CONVERSATION_LABEL_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
