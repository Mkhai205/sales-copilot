import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { BuyingSignalType, TimelineEventType } from '@sales-copilot/shared-contracts';
import { ActivityTimelineService } from '../activity-timeline.service';

describe('ActivityTimelineService (Chronological Timeline Aggregator)', () => {
  let service: ActivityTimelineService;
  let clientMock: any;

  let leadsDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let evidencesDb: Map<string, any>;
  let auditLogsDb: Map<string, any>;

  const ws1 = 'ws_01';
  const ws2 = 'ws_02';

  const contact1 = 'ct-01';
  const lead1 = 'lead-01';
  const conv1 = 'conv-01';

  beforeEach(() => {
    leadsDb = new Map();
    conversationsDb = new Map();
    messagesDb = new Map();
    evidencesDb = new Map();
    auditLogsDb = new Map();

    // Seed lead
    leadsDb.set(lead1, {
      id: lead1,
      workspaceId: ws1,
      contactId: contact1,
      contact: {
        id: contact1,
        name: 'Nguyen Van A',
        avatarUrl: 'https://avatar.test/1.png',
      },
    });

    // Seed conversation
    conversationsDb.set(conv1, {
      id: conv1,
      workspaceId: ws1,
      contactId: contact1,
    });

    // Seed events chronologically matching Story US-2.2.3:
    // 10:00:00 - MESSAGE (Customer opening message)
    messagesDb.set('msg_01', {
      id: 'msg_01',
      workspaceId: ws1,
      conversationId: conv1,
      senderType: 'CONTACT',
      senderId: contact1,
      isPrivate: false,
      contentType: 'TEXT',
      content: 'Khách gửi tin nhắn mở đầu',
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    });

    // 10:05:00 - SALES_EVIDENCE (AI detected NEED)
    evidencesDb.set('evi_01', {
      id: 'evi_01',
      workspaceId: ws1,
      leadId: lead1,
      conversationId: conv1,
      signalType: BuyingSignalType.NEED_EXPRESSED,
      signalCategory: 'crm_migration',
      confidence: 0.92,
      snippet: 'Bên mình đang cần tìm giải pháp CRM thay thế',
      reason: 'Need expressed clearly',
      isInvalidated: false,
      createdAt: new Date('2026-09-01T10:05:00.000Z'),
    });

    // 10:15:00 - STATUS_CHANGE (Status changed to CONTACTED)
    auditLogsDb.set('audit_01', {
      id: 'audit_01',
      workspaceId: ws1,
      resourceType: 'lead',
      resourceId: lead1,
      action: 'Chuyển trạng thái sang CONTACTED',
      payload: { status: 'CONTACTED' },
      user: { id: 'usr_01', name: 'Agent John', avatarUrl: null },
      createdAt: new Date('2026-09-01T10:15:00.000Z'),
    });

    // 10:20:00 - NOTE (Internal agent note)
    messagesDb.set('note_01', {
      id: 'note_01',
      workspaceId: ws1,
      conversationId: conv1,
      senderType: 'USER',
      senderId: 'usr_01',
      isPrivate: true,
      contentType: 'TEXT',
      content: 'Ghi chú nội bộ của Agent: Khách rất tiềm năng',
      createdAt: new Date('2026-09-01T10:20:00.000Z'),
    });

    clientMock = {
      lead: {
        findFirst: async ({ where }: any) => {
          for (const l of leadsDb.values()) {
            if (l.id === where.id && l.workspaceId === where.workspaceId) {
              return { ...l };
            }
          }
          return null;
        },
      },
      conversation: {
        findMany: async ({ where }: any) => {
          return Array.from(conversationsDb.values()).filter(
            c => c.workspaceId === where.workspaceId && c.contactId === where.contactId,
          );
        },
      },
      message: {
        findMany: async ({ where }: any) => {
          return Array.from(messagesDb.values()).filter(m => {
            if (m.workspaceId !== where.workspaceId) return false;
            if (where.conversationId?.in && !where.conversationId.in.includes(m.conversationId))
              return false;
            return true;
          });
        },
      },
      salesEvidence: {
        findMany: async ({ where }: any) => {
          return Array.from(evidencesDb.values()).filter(e => {
            if (e.workspaceId !== where.workspaceId) return false;
            if (where.leadId && e.leadId !== where.leadId) return false;
            if (where.isInvalidated !== undefined && e.isInvalidated !== where.isInvalidated)
              return false;
            return true;
          });
        },
      },
      auditLog: {
        findMany: async ({ where }: any) => {
          return Array.from(auditLogsDb.values()).filter(a => {
            if (a.workspaceId !== where.workspaceId) return false;
            if (a.resourceType !== where.resourceType) return false;
            if (a.resourceId !== where.resourceId) return false;
            return true;
          });
        },
      },
    };

    const mockPrisma = {
      getClient: () => clientMock,
    };

    service = new ActivityTimelineService(mockPrisma as any);
  });

  // ==========================================================================
  // Story US-2.2.3: Chronological Unified Activity Timeline Aggregation
  // ==========================================================================
  describe('US-2.2.3: Activity Timeline Aggregation & Ordering', () => {
    it('should fetch activity timeline sorted in reverse chronological order', async () => {
      const result = await service.getLeadTimeline(ws1, lead1, { limit: 10 });

      assert.strictEqual(result.items.length, 4);

      // First item must be the NOTE at 10:20:00
      assert.strictEqual(result.items[0].type, TimelineEventType.NOTE);
      assert.strictEqual(result.items[0].timestamp, '2026-09-01T10:20:00.000Z');
      assert.strictEqual(result.items[0].id, 'note_01');

      // Second item must be the STATUS_CHANGE at 10:15:00
      assert.strictEqual(result.items[1].type, TimelineEventType.STATUS_CHANGE);
      assert.strictEqual(result.items[1].timestamp, '2026-09-01T10:15:00.000Z');

      // Third item must be the SALES_EVIDENCE at 10:05:00
      assert.strictEqual(result.items[2].type, TimelineEventType.SALES_EVIDENCE);
      assert.strictEqual(result.items[2].timestamp, '2026-09-01T10:05:00.000Z');

      // Fourth item must be the MESSAGE at 10:00:00
      assert.strictEqual(result.items[3].type, TimelineEventType.MESSAGE);
      assert.strictEqual(result.items[3].timestamp, '2026-09-01T10:00:00.000Z');
      assert.strictEqual(result.items[3].id, 'msg_01');

      assert.strictEqual(result.meta.hasMore, false);
      assert.strictEqual(result.meta.nextCursor, null);
    });

    it('should paginate activity timeline using cursor-based pagination', async () => {
      // Step 1: Query first page with limit=2
      const page1 = await service.getLeadTimeline(ws1, lead1, { limit: 2 });
      assert.strictEqual(page1.items.length, 2);
      assert.strictEqual(page1.items[0].id, 'note_01');
      assert.strictEqual(page1.items[1].id, 'audit_01');
      assert.strictEqual(page1.meta.hasMore, true);
      assert.ok(page1.meta.nextCursor);

      // Step 2: Query second page using cursor
      const page2 = await service.getLeadTimeline(ws1, lead1, {
        limit: 2,
        cursor: page1.meta.nextCursor!,
      });
      assert.strictEqual(page2.items.length, 2);
      assert.strictEqual(page2.items[0].id, 'evi_01');
      assert.strictEqual(page2.items[1].id, 'msg_01');
      assert.strictEqual(page2.meta.hasMore, false);
      assert.strictEqual(page2.meta.nextCursor, null);
    });

    it('should filter events by event types (e.g. only NOTE and SALES_EVIDENCE)', async () => {
      const result = await service.getLeadTimeline(ws1, lead1, {
        limit: 10,
        types: [TimelineEventType.NOTE, TimelineEventType.SALES_EVIDENCE],
      });

      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.items[0].type, TimelineEventType.NOTE);
      assert.strictEqual(result.items[1].type, TimelineEventType.SALES_EVIDENCE);
    });

    it('should throw NotFoundException when lead is not found in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.getLeadTimeline(ws2, lead1, { limit: 10 }); // ws2 cross tenant
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'LEAD_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
