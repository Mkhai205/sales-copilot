import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { AutoAssignmentService } from '../auto-assignment.service';
import { AutoAssignmentListener } from '../auto-assignment.listener';
import { ConversationsService } from '../conversations.service';
import {
  ConversationPriority,
  ConversationReopenedEvent,
  ConversationResponseDto,
  ConversationStatus,
  PresenceStatus,
} from '@sales-copilot/shared-contracts';

describe('AutoAssignmentService (Round-Robin & Least-Loaded Assignment)', () => {
  let autoAssignmentService: AutoAssignmentService;
  let autoAssignmentListener: AutoAssignmentListener;
  let conversationsService: ConversationsService;

  let mockPrismaService: any;
  let mockRedisService: any;
  let mockPresenceService: any;
  let mockEventEmitter: any;

  let emittedEvents: Array<{ event: string; payload: any }>;
  let conversationsDb: Map<string, any>;
  let inboxesDb: Map<string, any>;
  let inboxMembersDb: Map<string, any>;
  let teamMembersDb: Map<string, any>;
  let presenceDb: Map<string, Array<{ userId: string; status: PresenceStatus }>>;
  let redisLists: Map<string, string[]>;
  let redisLocks: Map<string, string>;

  beforeEach(() => {
    conversationsDb = new Map();
    inboxesDb = new Map();
    inboxMembersDb = new Map();
    teamMembersDb = new Map();
    presenceDb = new Map();
    redisLists = new Map();
    redisLocks = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    mockRedisService = {
      acquireLock: async (key: string, _ttlMs: number) => {
        if (redisLocks.has(key)) return null;
        const token = `token_${Date.now()}_${Math.random()}`;
        redisLocks.set(key, token);
        return token;
      },
      releaseLock: async (key: string, token: string) => {
        if (redisLocks.get(key) === token) {
          redisLocks.delete(key);
          return true;
        }
        return false;
      },
      lrange: async (key: string, _start?: number, _stop?: number) => {
        return redisLists.get(key) || [];
      },
      rpush: async (key: string, ...values: string[]) => {
        const list = redisLists.get(key) || [];
        list.push(...values);
        redisLists.set(key, list);
        return list.length;
      },
      lrem: async (key: string, _count: number, value: string) => {
        const list = redisLists.get(key) || [];
        const filtered = list.filter(v => v !== value);
        const removed = list.length - filtered.length;
        redisLists.set(key, filtered);
        return removed;
      },
    };

    mockPresenceService = {
      getWorkspacePresence: async (workspaceId: string, _includeOffline = false) => {
        return presenceDb.get(workspaceId) || [];
      },
    };

    const mockPrismaClient = {
      conversation: {
        findFirst: async ({ where }: any) => {
          for (const conv of conversationsDb.values()) {
            let match = true;
            if (where.id && conv.id !== where.id) match = false;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) match = false;
            if (match) {
              const inbox = inboxesDb.get(conv.inboxId);
              return {
                ...conv,
                inbox,
                contact: { id: conv.contactId, name: 'Test Contact', identities: [] },
                assignee: conv.assigneeId
                  ? { id: conv.assigneeId, name: 'Agent', email: 'agent@test.com' }
                  : null,
                team: conv.teamId ? { id: conv.teamId, name: 'Team' } : null,
                labels: [],
                messages: [],
              };
            }
          }
          return null;
        },
        update: async ({ where, data }: any) => {
          const conv = conversationsDb.get(where.id);
          if (!conv) throw new Error('Not found');
          const updated = { ...conv, ...data, updatedAt: new Date() };
          conversationsDb.set(where.id, updated);
          const inbox = inboxesDb.get(updated.inboxId);
          return {
            ...updated,
            inbox,
            contact: { id: updated.contactId, name: 'Test Contact', identities: [] },
            assignee: updated.assigneeId
              ? { id: updated.assigneeId, name: 'Agent', email: 'agent@test.com' }
              : null,
            team: updated.teamId ? { id: updated.teamId, name: 'Team' } : null,
            labels: [],
            messages: [],
          };
        },
        groupBy: async ({ where }: any) => {
          // Count OPEN conversations by assigneeId
          const counts = new Map<string, number>();
          for (const conv of conversationsDb.values()) {
            if (
              conv.workspaceId === where.workspaceId &&
              conv.status === ConversationStatus.OPEN &&
              conv.assigneeId &&
              where.assigneeId?.in?.includes(conv.assigneeId)
            ) {
              counts.set(conv.assigneeId, (counts.get(conv.assigneeId) || 0) + 1);
            }
          }
          return Array.from(counts.entries()).map(([assigneeId, count]) => ({
            assigneeId,
            _count: { id: count },
          }));
        },
      },
      inbox: {
        findFirst: async ({ where }: any) => {
          for (const ib of inboxesDb.values()) {
            if (where.id && ib.id !== where.id) continue;
            if (where.workspaceId && ib.workspaceId !== where.workspaceId) continue;
            return ib;
          }
          return null;
        },
      },
      inboxMember: {
        findMany: async ({ where }: any) => {
          const results = [];
          for (const member of inboxMembersDb.values()) {
            if (where.inboxId && member.inboxId !== where.inboxId) continue;
            results.push(member);
          }
          return results;
        },
        findUnique: async ({ where }: any) => {
          const key = `${where.inboxId_userId.inboxId}_${where.inboxId_userId.userId}`;
          return inboxMembersDb.get(key) || null;
        },
      },
      team: {
        findFirst: async ({ where }: any) => {
          return { id: where.id, workspaceId: where.workspaceId, name: 'Test Team' };
        },
      },
      teamMember: {
        findMany: async ({ where }: any) => {
          const results = [];
          for (const tm of teamMembersDb.values()) {
            if (where.teamId && tm.teamId !== where.teamId) continue;
            results.push(tm);
          }
          return results;
        },
      },
    };

    mockPrismaService = {
      getClient: () => mockPrismaClient,
    };

    conversationsService = new ConversationsService(mockPrismaService, mockEventEmitter);

    autoAssignmentService = new AutoAssignmentService(
      mockPrismaService,
      mockRedisService,
      mockPresenceService,
      conversationsService,
    );

    autoAssignmentListener = new AutoAssignmentListener(autoAssignmentService);

    // Setup base fixtures
    inboxesDb.set('ib_1', {
      id: 'ib_1',
      workspaceId: 'ws_1',
      name: 'Sales Inbox',
      isAutoAssignmentEnabled: true,
    });

    inboxesDb.set('ib_disabled', {
      id: 'ib_disabled',
      workspaceId: 'ws_1',
      name: 'Manual Inbox',
      isAutoAssignmentEnabled: false,
    });
  });

  describe('Eligibility and Preconditions', () => {
    it('should skip auto-assignment if inbox has isAutoAssignmentEnabled = false', async () => {
      conversationsDb.set('conv_1', {
        id: 'conv_1',
        displayId: 101,
        workspaceId: 'ws_1',
        inboxId: 'ib_disabled',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.MEDIUM,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_1');
      assert.strictEqual(result, null);
      assert.strictEqual(conversationsDb.get('conv_1').assigneeId, null);
    });

    it('should skip auto-assignment if conversation already has an assignee', async () => {
      conversationsDb.set('conv_1', {
        id: 'conv_1',
        displayId: 101,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: 'usr_already_assigned',
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.MEDIUM,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_1');
      assert.strictEqual(result, null);
    });

    it('should skip auto-assignment if conversation status is not OPEN', async () => {
      conversationsDb.set('conv_resolved', {
        id: 'conv_resolved',
        displayId: 101,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.RESOLVED,
        priority: ConversationPriority.MEDIUM,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_resolved');
      assert.strictEqual(result, null);
    });

    it('should return null if conversation does not exist', async () => {
      const result = await autoAssignmentService.assignConversation('ws_1', 'nonexistent_conv');
      assert.strictEqual(result, null);
    });
  });

  describe('Online Presence and Membership Selection', () => {
    beforeEach(() => {
      // Add members to ib_1: usr_1, usr_2, usr_3
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      inboxMembersDb.set('ib_1_usr_2', { id: 'im_2', inboxId: 'ib_1', userId: 'usr_2' });
      inboxMembersDb.set('ib_1_usr_3', { id: 'im_3', inboxId: 'ib_1', userId: 'usr_3' });

      conversationsDb.set('conv_new', {
        id: 'conv_new',
        displayId: 200,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.MEDIUM,
      });
    });

    it('should leave conversation unassigned when no inbox members are ONLINE', async () => {
      // Presence: usr_1 is OFFLINE, usr_2 is AWAY
      presenceDb.set('ws_1', [
        { userId: 'usr_1', status: PresenceStatus.OFFLINE },
        { userId: 'usr_2', status: PresenceStatus.AWAY },
      ]);

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_new');
      assert.strictEqual(result, null);
      assert.strictEqual(conversationsDb.get('conv_new').assigneeId, null);
    });

    it('should assign immediately when exactly one inbox member is ONLINE', async () => {
      // Presence: usr_2 is ONLINE
      presenceDb.set('ws_1', [
        { userId: 'usr_1', status: PresenceStatus.OFFLINE },
        { userId: 'usr_2', status: PresenceStatus.ONLINE },
      ]);

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_new');
      assert.ok(result !== null);
      assert.strictEqual(result.assigneeId, 'usr_2');
      assert.strictEqual(conversationsDb.get('conv_new').assigneeId, 'usr_2');

      // Verify domain event emitted
      const assignEvent = emittedEvents.find(e => e.event === 'conversation.assigned');
      assert.ok(assignEvent);
      assert.strictEqual(assignEvent.payload.newAssigneeId, 'usr_2');
      assert.strictEqual(assignEvent.payload.previousAssigneeId, null);
    });
  });

  describe('Least-Loaded Workload Heuristic (BR-4.2)', () => {
    beforeEach(() => {
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      inboxMembersDb.set('ib_1_usr_2', { id: 'im_2', inboxId: 'ib_1', userId: 'usr_2' });
      inboxMembersDb.set('ib_1_usr_3', { id: 'im_3', inboxId: 'ib_1', userId: 'usr_3' });

      // All 3 agents are ONLINE
      presenceDb.set('ws_1', [
        { userId: 'usr_1', status: PresenceStatus.ONLINE },
        { userId: 'usr_2', status: PresenceStatus.ONLINE },
        { userId: 'usr_3', status: PresenceStatus.ONLINE },
      ]);

      // Pre-seed conversations:
      // usr_1 has 3 OPEN conversations
      // usr_2 has 1 OPEN conversation
      // usr_3 has 2 OPEN conversations
      conversationsDb.set('c_existing_1', {
        id: 'c1',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_1',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_existing_2', {
        id: 'c2',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_1',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_existing_3', {
        id: 'c3',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_1',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_existing_4', {
        id: 'c4',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_2',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_existing_5', {
        id: 'c5',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_3',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_existing_6', {
        id: 'c6',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_3',
        status: ConversationStatus.OPEN,
      });

      conversationsDb.set('conv_to_assign', {
        id: 'conv_to_assign',
        displayId: 300,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
        priority: ConversationPriority.MEDIUM,
      });
    });

    it('should select agent with fewest OPEN conversations (usr_2 with 1 open)', async () => {
      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_to_assign');
      assert.ok(result !== null);
      assert.strictEqual(result.assigneeId, 'usr_2');
    });
  });

  describe('Round-Robin Tiebreaker Mechanism', () => {
    beforeEach(() => {
      inboxMembersDb.set('ib_1_usr_a', { id: 'im_a', inboxId: 'ib_1', userId: 'usr_a' });
      inboxMembersDb.set('ib_1_usr_b', { id: 'im_b', inboxId: 'ib_1', userId: 'usr_b' });
      inboxMembersDb.set('ib_1_usr_c', { id: 'im_c', inboxId: 'ib_1', userId: 'usr_c' });

      presenceDb.set('ws_1', [
        { userId: 'usr_a', status: PresenceStatus.ONLINE },
        { userId: 'usr_b', status: PresenceStatus.ONLINE },
        { userId: 'usr_c', status: PresenceStatus.ONLINE },
      ]);
    });

    it('should distribute tied agents round-robin and update Redis circular queue', async () => {
      // Initialize Redis round robin queue with [usr_a, usr_b, usr_c]
      redisLists.set('round_robin:inbox:ib_1', ['usr_a', 'usr_b', 'usr_c']);

      // 1. First assignment: all 3 have 0 OPEN conversations -> selects usr_a (at front of queue)
      conversationsDb.set('conv_1', {
        id: 'conv_1',
        displayId: 1,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });
      const res1 = await autoAssignmentService.assignConversation('ws_1', 'conv_1');
      assert.strictEqual(res1?.assigneeId, 'usr_a');
      // Queue rotated: [usr_b, usr_c, usr_a]
      assert.deepStrictEqual(redisLists.get('round_robin:inbox:ib_1'), ['usr_b', 'usr_c', 'usr_a']);

      // 2. Second assignment: usr_a has 1 open, usr_b and usr_c have 0 open -> selects usr_b
      conversationsDb.set('conv_2', {
        id: 'conv_2',
        displayId: 2,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });
      const res2 = await autoAssignmentService.assignConversation('ws_1', 'conv_2');
      assert.strictEqual(res2?.assigneeId, 'usr_b');
      // Queue rotated: [usr_c, usr_a, usr_b]
      assert.deepStrictEqual(redisLists.get('round_robin:inbox:ib_1'), ['usr_c', 'usr_a', 'usr_b']);

      // 3. Third assignment: usr_a has 1, usr_b has 1, usr_c has 0 -> selects usr_c (least load)
      conversationsDb.set('conv_3', {
        id: 'conv_3',
        displayId: 3,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });
      const res3 = await autoAssignmentService.assignConversation('ws_1', 'conv_3');
      assert.strictEqual(res3?.assigneeId, 'usr_c');
      // Queue rotated: [usr_a, usr_b, usr_c]
      assert.deepStrictEqual(redisLists.get('round_robin:inbox:ib_1'), ['usr_a', 'usr_b', 'usr_c']);

      // 4. Fourth assignment: all 3 now have 1 open -> selects usr_a (tiebreaker front)
      conversationsDb.set('conv_4', {
        id: 'conv_4',
        displayId: 4,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });
      const res4 = await autoAssignmentService.assignConversation('ws_1', 'conv_4');
      assert.strictEqual(res4?.assigneeId, 'usr_a');
      assert.deepStrictEqual(redisLists.get('round_robin:inbox:ib_1'), ['usr_b', 'usr_c', 'usr_a']);
    });

    it('should prioritize agent missing from Redis queue and add them', async () => {
      // Redis queue has only usr_a, usr_b
      redisLists.set('round_robin:inbox:ib_1', ['usr_a', 'usr_b']);

      // usr_c is not in Redis queue yet
      const selected = await autoAssignmentService.getRoundRobinTiebreaker('ib_1', [
        'usr_a',
        'usr_b',
        'usr_c',
      ]);
      assert.strictEqual(selected, 'usr_c');
    });
  });

  describe('Team-Scoped Auto-Assignment', () => {
    beforeEach(() => {
      // Inbox members: usr_1, usr_2, usr_3
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      inboxMembersDb.set('ib_1_usr_2', { id: 'im_2', inboxId: 'ib_1', userId: 'usr_2' });
      inboxMembersDb.set('ib_1_usr_3', { id: 'im_3', inboxId: 'ib_1', userId: 'usr_3' });

      // Team members for tm_support: only usr_2, usr_3
      teamMembersDb.set('tm_support_usr_2', { id: 'tm_1', teamId: 'tm_support', userId: 'usr_2' });
      teamMembersDb.set('tm_support_usr_3', { id: 'tm_2', teamId: 'tm_support', userId: 'usr_3' });

      // Presence: all 3 online
      presenceDb.set('ws_1', [
        { userId: 'usr_1', status: PresenceStatus.ONLINE },
        { userId: 'usr_2', status: PresenceStatus.ONLINE },
        { userId: 'usr_3', status: PresenceStatus.ONLINE },
      ]);
    });

    it('should filter candidate agents by both Inbox and Team when teamId is specified', async () => {
      // usr_1 has 0 open, usr_2 has 1 open, usr_3 has 2 open
      // Although usr_1 has least load, usr_1 is NOT in tm_support!
      conversationsDb.set('c_open_2', {
        id: 'c2',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_2',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_open_3a', {
        id: 'c3a',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_3',
        status: ConversationStatus.OPEN,
      });
      conversationsDb.set('c_open_3b', {
        id: 'c3b',
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        assigneeId: 'usr_3',
        status: ConversationStatus.OPEN,
      });

      conversationsDb.set('conv_team', {
        id: 'conv_team',
        displayId: 500,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        teamId: 'tm_support',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_team');
      assert.ok(result !== null);
      // Candidate must be chosen from [usr_2, usr_3] -> usr_2 has fewer open than usr_3
      assert.strictEqual(result.assigneeId, 'usr_2');
    });

    it('should leave unassigned if no online members intersect between Inbox and Team', async () => {
      // Team members for tm_special: usr_99 (not an inbox member)
      teamMembersDb.set('tm_special_usr_99', {
        id: 'tm_99',
        teamId: 'tm_special',
        userId: 'usr_99',
      });

      conversationsDb.set('conv_team_none', {
        id: 'conv_team_none',
        displayId: 501,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        teamId: 'tm_special',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_team_none');
      assert.strictEqual(result, null);
    });
  });

  describe('Concurrency and Distributed Lock Handling', () => {
    it('should return null when Redis lock cannot be acquired (parallel in-flight assignment)', async () => {
      // Pre-acquire lock for inbox ib_1
      redisLocks.set('lock:auto_assign:inbox:ib_1', 'existing_lock_token');

      conversationsDb.set('conv_locked', {
        id: 'conv_locked',
        displayId: 600,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_locked');
      assert.strictEqual(result, null);
    });

    it('should always release lock after successful assignment', async () => {
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      presenceDb.set('ws_1', [{ userId: 'usr_1', status: PresenceStatus.ONLINE }]);

      conversationsDb.set('conv_test', {
        id: 'conv_test',
        displayId: 601,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      await autoAssignmentService.assignConversation('ws_1', 'conv_test');
      assert.strictEqual(redisLocks.has('lock:auto_assign:inbox:ib_1'), false);
    });

    it('should retry and succeed when lock becomes available on subsequent attempt', async () => {
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      presenceDb.set('ws_1', [{ userId: 'usr_1', status: PresenceStatus.ONLINE }]);

      conversationsDb.set('conv_retry_success', {
        id: 'conv_retry_success',
        displayId: 602,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      // Simulate lock held initially, then released after 30ms
      redisLocks.set('lock:auto_assign:inbox:ib_1', 'busy_token');
      setTimeout(() => {
        redisLocks.delete('lock:auto_assign:inbox:ib_1');
      }, 30);

      const result = await autoAssignmentService.assignConversation('ws_1', 'conv_retry_success');
      assert.ok(result);
      assert.strictEqual(result.assigneeId, 'usr_1');
    });
  });

  describe('AutoAssignmentListener (Event-Driven Triggers)', () => {
    beforeEach(() => {
      inboxMembersDb.set('ib_1_usr_1', { id: 'im_1', inboxId: 'ib_1', userId: 'usr_1' });
      presenceDb.set('ws_1', [{ userId: 'usr_1', status: PresenceStatus.ONLINE }]);
    });

    it('should auto-assign upon receiving conversation.created event when unassigned', async () => {
      conversationsDb.set('conv_event_1', {
        id: 'conv_event_1',
        displayId: 701,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      const eventPayload = {
        workspaceId: 'ws_1',
        conversation: {
          id: 'conv_event_1',
          displayId: 701,
          workspaceId: 'ws_1',
          inboxId: 'ib_1',
          contactId: 'cnt_1',
          assigneeId: null,
          status: ConversationStatus.OPEN,
        } as ConversationResponseDto,
      };

      await autoAssignmentListener.handleConversationCreated(eventPayload);
      assert.strictEqual(conversationsDb.get('conv_event_1').assigneeId, 'usr_1');
    });

    it('should skip conversation.created event when conversation already has assignee', async () => {
      conversationsDb.set('conv_event_2', {
        id: 'conv_event_2',
        displayId: 702,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: 'usr_manual',
        status: ConversationStatus.OPEN,
      });

      const eventPayload = {
        workspaceId: 'ws_1',
        conversation: {
          id: 'conv_event_2',
          displayId: 702,
          workspaceId: 'ws_1',
          inboxId: 'ib_1',
          contactId: 'cnt_1',
          assigneeId: 'usr_manual',
          status: ConversationStatus.OPEN,
        } as ConversationResponseDto,
      };

      await autoAssignmentListener.handleConversationCreated(eventPayload);
      assert.strictEqual(conversationsDb.get('conv_event_2').assigneeId, 'usr_manual');
    });

    it('should auto-assign upon receiving conversation.reopened event when unassigned', async () => {
      conversationsDb.set('conv_reopened_1', {
        id: 'conv_reopened_1',
        displayId: 703,
        workspaceId: 'ws_1',
        inboxId: 'ib_1',
        contactId: 'cnt_1',
        assigneeId: null,
        status: ConversationStatus.OPEN,
      });

      const eventPayload: ConversationReopenedEvent = {
        workspaceId: 'ws_1',
        conversationId: 'conv_reopened_1',
        triggeredBySenderType: 'CONTACT',
        conversation: {
          id: 'conv_reopened_1',
          displayId: 703,
          workspaceId: 'ws_1',
          inboxId: 'ib_1',
          contactId: 'cnt_1',
          assigneeId: null,
          status: ConversationStatus.OPEN,
        } as ConversationResponseDto,
      };

      await autoAssignmentListener.handleConversationReopened(eventPayload);
      assert.strictEqual(conversationsDb.get('conv_reopened_1').assigneeId, 'usr_1');
    });
  });
});
