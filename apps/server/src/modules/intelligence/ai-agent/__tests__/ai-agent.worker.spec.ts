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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('SUPERSEDED_BY_NEWER_MESSAGE');
    expect(createdMessages.length).toBe(0);
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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('HUMAN_TAKEOVER');
    expect(createdMessages.length).toBe(0);
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

    expect(result.text).toBe('Dạ shop còn hàng ạ!');
    expect(createdMessages.length).toBe(1);

    const saved = createdMessages[0];
    expect(saved.wsId).toBe(workspaceId);
    expect(saved.convId).toBe(conversationId);
    expect(saved.dto.content).toBe('Dạ shop còn hàng ạ!');
    expect(saved.dto.senderType).toBe(SenderType.SYSTEM);
    expect(saved.dto.messageType).toBe(MessageType.OUTGOING);
    expect(saved.dto.isPrivate).toBe(false);
    expect(saved.dto.metadata.isAiGenerated).toBe(true);

    const conv = conversationsDb.get(conversationId);
    expect(conv.lastAiMessageAt instanceof Date).toBeTruthy();
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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('HUMAN_TAKEOVER');
    expect(createdMessages.length).toBe(0);
  });
});
