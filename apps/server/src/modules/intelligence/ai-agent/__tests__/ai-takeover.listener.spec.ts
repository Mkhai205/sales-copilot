import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConversationStatus, SenderType } from '@sales-copilot/shared-contracts';
import { AiTakeoverListener } from '../ai-takeover.listener';
import { getAiDebounceKey } from '../ai-agent.constants';

describe('AiTakeoverListener', () => {
  let listener: AiTakeoverListener;
  let mockPrisma: any;
  let mockRedis: any;
  let conversationsDb: Map<string, any>;
  let deletedRedisKeys: string[];

  const workspaceId = 'ws-takeover-1';
  const conversationId = 'conv-takeover-1';

  beforeEach(() => {
    conversationsDb = new Map();
    deletedRedisKeys = [];

    mockPrisma = {
      getClient: () => ({
        conversation: {
          updateMany: async ({ where, data }: any) => {
            let count = 0;
            for (const [id, conv] of conversationsDb.entries()) {
              if (
                id === where.id &&
                conv.workspaceId === where.workspaceId &&
                (where.isAiPaused === undefined || conv.isAiPaused === where.isAiPaused)
              ) {
                Object.assign(conv, data);
                count++;
              }
            }
            return { count };
          },
        },
      }),
    };

    mockRedis = {
      del: async (key: string) => {
        deletedRedisKeys.push(key);
      },
    };

    listener = new AiTakeoverListener(mockPrisma, mockRedis);
  });

  it('should set isAiPaused=true and delete debounce key when human agent sends public message', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: false,
    });

    await listener.handleAgentMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-agent-1',
        senderType: SenderType.USER,
        isPrivate: false,
      },
      isPrivate: false,
    });

    const conv = conversationsDb.get(conversationId);
    assert.strictEqual(conv.isAiPaused, true);
    assert.ok(deletedRedisKeys.includes(getAiDebounceKey(workspaceId, conversationId)));
  });

  it('should NOT trigger takeover if agent message is a private note', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: false,
    });

    await listener.handleAgentMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-agent-private',
        senderType: SenderType.USER,
        isPrivate: true,
      },
      isPrivate: true,
    });

    const conv = conversationsDb.get(conversationId);
    assert.strictEqual(conv.isAiPaused, false);
    assert.strictEqual(deletedRedisKeys.length, 0);
  });

  it('should NOT trigger takeover if message is from CONTACT or SYSTEM', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: false,
    });

    await listener.handleAgentMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-contact',
        senderType: SenderType.CONTACT,
        isPrivate: false,
      },
    });

    assert.strictEqual(conversationsDb.get(conversationId).isAiPaused, false);
  });

  it('should reset isAiPaused to false when conversation status is RESOLVED', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: true,
    });

    await listener.handleConversationStatusUpdated({
      workspaceId,
      conversationId,
      currentStatus: ConversationStatus.RESOLVED,
      conversation: { id: conversationId } as any,
    });

    const conv = conversationsDb.get(conversationId);
    assert.strictEqual(conv.isAiPaused, false);
    assert.ok(deletedRedisKeys.includes(getAiDebounceKey(workspaceId, conversationId)));
  });
});
