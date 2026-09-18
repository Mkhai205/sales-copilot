import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { createEscalateToHumanTool } from '../escalate-to-human.tool';

describe('escalateToHuman Tool (T9)', () => {
  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';
  let mockPrisma: any;
  let mockMessagesService: any;
  let mockRedisService: any;
  let actionsOrder: string[];
  let deletedKeys: string[];

  beforeEach(() => {
    actionsOrder = [];
    deletedKeys = [];

    mockMessagesService = {
      create: async (_wsId: string, _convId: string, payload: any) => {
        if (payload.isPrivate) {
          actionsOrder.push('INTERNAL_ACTIVITY_NOTE');
        } else {
          actionsOrder.push('CUSTOMER_FAREWELL_MESSAGE');
        }
        return { id: 'msg-id', ...payload };
      },
    };

    mockPrisma = {
      getClient: () => ({
        conversation: {
          updateMany: async ({ data }: any) => {
            if (data.isAiPaused) {
              actionsOrder.push('SET_AI_PAUSED_TRUE');
            }
            return { count: 1 };
          },
        },
      }),
    };

    mockRedisService = {
      del: async (key: string) => {
        deletedKeys.push(key);
        actionsOrder.push('REDIS_DEBOUNCE_CLEARED');
      },
    };
  });

  it('should send customer farewell BEFORE pausing AI to prevent HumanTakeoverAbortError trap', async () => {
    const tool = createEscalateToHumanTool({
      workspaceId,
      conversationId,
      prisma: mockPrisma,
      messagesService: mockMessagesService,
      redisService: mockRedisService,
    });

    const result = await tool.execute!(
      { reason: 'Khách hàng yêu cầu đổi size và hoàn tiền' },
      {} as any,
    );

    assert.strictEqual(result.escalated, true);
    assert.strictEqual(result.reason, 'Khách hàng yêu cầu đổi size và hoàn tiền');

    // Verify ordering: Farewell must be before pause!
    assert.deepStrictEqual(actionsOrder, [
      'CUSTOMER_FAREWELL_MESSAGE',
      'INTERNAL_ACTIVITY_NOTE',
      'SET_AI_PAUSED_TRUE',
      'REDIS_DEBOUNCE_CLEARED',
    ]);

    // Check Redis debounce key format
    assert.strictEqual(deletedKeys.length, 1);
    assert.ok(deletedKeys[0].includes(`ws:${workspaceId}:ai:debounce:${conversationId}`));
  });

  it('should return error when conversationId is missing', async () => {
    const tool = createEscalateToHumanTool({
      workspaceId,
      conversationId: undefined,
      prisma: mockPrisma,
      messagesService: mockMessagesService,
    });

    const result = await tool.execute!({ reason: 'Test' }, {} as any);
    assert.strictEqual(result.escalated, false);
    assert.strictEqual(result.error, 'MISSING_CONVERSATION_ID');
    assert.strictEqual(actionsOrder.length, 0);
  });
});
