import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { AiAgentWorker } from '../ai-agent.worker';
import { getAiDebounceKey, HumanTakeoverAbortError } from '../ai-agent.constants';

describe('AiAgentWorker', () => {
  let worker: AiAgentWorker;
  let mockPrisma: any;
  let mockRedis: any;
  let mockAiAgentService: any;
  let mockMessagesService: any;
  let redisStore: Map<string, string>;
  let conversationsDb: Map<string, any>;
  let createdMessages: any[];

  const workspaceId = 'ws-worker-1';
  const conversationId = 'conv-worker-1';
  const inboxId = 'inbox-worker-1';

  beforeEach(() => {
    redisStore = new Map();
    conversationsDb = new Map();
    createdMessages = [];

    mockPrisma = {
      getClient: () => ({
        conversation: {
          findFirst: async ({ where }: any) => {
            const conv = conversationsDb.get(where.id);
            if (!conv || conv.workspaceId !== where.workspaceId) return null;
            return conv;
          },
          updateMany: async ({ where, data }: any) => {
            const conv = conversationsDb.get(where.id);
            if (conv) Object.assign(conv, data);
            return { count: conv ? 1 : 0 };
          },
        },
      }),
    };

    mockRedis = {
      get: async (key: string) => redisStore.get(key) || null,
    };

    mockAiAgentService = {
      processConversation: async () => ({
        text: 'Dạ shop còn hàng ạ!',
        stepsCount: 1,
        usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
      }),
    };

    mockMessagesService = {
      create: async (wsId: string, convId: string, dto: any) => {
        createdMessages.push({ wsId, convId, dto });
        return { id: 'msg-created-1', ...dto };
      },
    };

    worker = new AiAgentWorker(mockPrisma, mockRedis, mockAiAgentService, mockMessagesService);
  });

  it('should skip job if superseded by a newer message in Redis debounce', async () => {
    const scheduledAt = 1000;
    const newerTime = 1200;
    redisStore.set(getAiDebounceKey(workspaceId, conversationId), newerTime.toString());

    const result = await worker.process({
      id: 'job-1',
      data: {
        workspaceId,
        conversationId,
        inboxId,
        messageId: 'msg-1',
        scheduledAt,
      },
    } as any);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'SUPERSEDED_BY_NEWER_MESSAGE');
    assert.strictEqual(createdMessages.length, 0);
  });

  it('should skip job if conversation has isAiPaused=true prior to processing', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: true,
    });

    const result = await worker.process({
      id: 'job-1',
      data: {
        workspaceId,
        conversationId,
        inboxId,
        messageId: 'msg-1',
        scheduledAt: Date.now(),
      },
    } as any);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'HUMAN_TAKEOVER');
    assert.strictEqual(createdMessages.length, 0);
  });

  it('should successfully run AI agent and persist outbound system message with attribution', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: false,
    });

    const result = await worker.process({
      id: 'job-1',
      data: {
        workspaceId,
        conversationId,
        inboxId,
        messageId: 'msg-1',
        scheduledAt: Date.now(),
      },
    } as any);

    assert.strictEqual(result.text, 'Dạ shop còn hàng ạ!');
    assert.strictEqual(createdMessages.length, 1);

    const saved = createdMessages[0];
    assert.strictEqual(saved.wsId, workspaceId);
    assert.strictEqual(saved.convId, conversationId);
    assert.strictEqual(saved.dto.content, 'Dạ shop còn hàng ạ!');
    assert.strictEqual(saved.dto.senderType, SenderType.SYSTEM);
    assert.strictEqual(saved.dto.messageType, MessageType.OUTGOING);
    assert.strictEqual(saved.dto.isPrivate, false);
    assert.strictEqual(saved.dto.metadata.isAiGenerated, true);

    const conv = conversationsDb.get(conversationId);
    assert.ok(conv.lastAiMessageAt instanceof Date);
  });

  it('should handle HumanTakeoverAbortError gracefully when takeover happens mid-execution', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      isAiPaused: false,
    });

    mockAiAgentService.processConversation = async () => {
      throw new HumanTakeoverAbortError();
    };

    const result = await worker.process({
      id: 'job-1',
      data: {
        workspaceId,
        conversationId,
        inboxId,
        messageId: 'msg-1',
        scheduledAt: Date.now(),
      },
    } as any);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'HUMAN_TAKEOVER');
    assert.strictEqual(createdMessages.length, 0);
  });
});
