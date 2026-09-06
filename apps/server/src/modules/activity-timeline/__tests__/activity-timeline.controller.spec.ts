import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ActivityTimelineController } from '../activity-timeline.controller';

describe('ActivityTimelineController', () => {
  let controller: ActivityTimelineController;
  let mockService: any;
  const mockContext = {
    workspaceId: 'ws_01',
    user: { id: 'usr_01', role: 'AGENT' },
  } as any;

  beforeEach(() => {
    mockService = {
      getLeadTimeline: async (wsId: string, leadId: string, query: any) => ({
        items: [
          {
            id: 'evt_01',
            type: 'MESSAGE',
            timestamp: '2026-09-01T10:00:00.000Z',
            actor: { id: 'c1', name: 'Cust', type: 'CONTACT' },
            summary: 'Summary text',
            payload: {},
          },
        ],
        meta: {
          limit: query.limit || 20,
          hasMore: false,
          nextCursor: null,
        },
      }),
    };

    controller = new ActivityTimelineController(mockService);
  });

  it('should delegate getLeadTimeline to service', async () => {
    const result = await controller.getLeadTimeline(mockContext, 'lead_01', { limit: 10 });
    assert.strictEqual(result.items.length, 1);
    assert.strictEqual(result.items[0].id, 'evt_01');
    assert.strictEqual(result.meta.limit, 10);
  });
});
