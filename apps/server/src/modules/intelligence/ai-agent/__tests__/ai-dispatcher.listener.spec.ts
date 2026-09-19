import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { AiDispatcherListener } from '../ai-dispatcher.listener';
import { AI_AGENT_CONSTANTS, getAiDebounceKey } from '../ai-agent.constants';

describe('AiDispatcherListener', () => {
  let listener: AiDispatcherListener;
  let mockPrisma: any;
  let mockRedis: any;
  let mockQueue: any;
  let redisStore: Map<string, { val: string; ttl?: number }>;
  let queuedJobs: any[];
  let conversationsDb: Map<string, any>;

  const workspaceId = 'ws-disp-1';
  const conversationId = 'conv-disp-1';

  beforeEach(() => {
    redisStore = new Map();
    queuedJobs = [];
    conversationsDb = new Map();

    mockPrisma = {
      getClient: () => ({
        conversation: {
          findFirst: async ({ where }: any) => {
            const conv = conversationsDb.get(where.id);
            if (!conv || conv.workspaceId !== where.workspaceId) return null;
            return conv;
          },
        },
      }),
    };

    mockRedis = {
      set: async (key: string, val: string, ttl?: number) => {
        redisStore.set(key, { val, ttl });
      },
    };

    mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        queuedJobs.push({ name, data, opts });
      },
    };

    listener = new AiDispatcherListener(mockPrisma, mockRedis, mockQueue);
  });

  it('should ignore messages from USER or SYSTEM', async () => {
    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-1',
        senderType: SenderType.USER,
        messageType: MessageType.INCOMING,
        isPrivate: false,
      },
    });

    expect(queuedJobs.length).toBe(0);
  });

  it('should ignore private notes or non-incoming messages', async () => {
    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.OUTGOING,
        isPrivate: false,
      },
    });

    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-2',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        isPrivate: true,
      },
    });

    expect(queuedJobs.length).toBe(0);
  });

  it('should ignore if conversation is paused (Human Takeover)', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      inboxId: 'inbox-1',
      isAiPaused: true,
      inbox: { settings: { aiCommercePolicy: { enabled: true } } },
    });

    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        isPrivate: false,
      },
    });

    expect(queuedJobs.length).toBe(0);
  });

  it('should ignore if inbox has no aiCommercePolicy or enabled is false', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      inboxId: 'inbox-1',
      isAiPaused: false,
      inbox: { settings: { aiCommercePolicy: { enabled: false } } },
    });

    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        isPrivate: false,
      },
    });

    expect(queuedJobs.length).toBe(0);
  });

  it('should set Redis debounce and enqueue BullMQ job when message is valid', async () => {
    conversationsDb.set(conversationId, {
      id: conversationId,
      workspaceId,
      inboxId: 'inbox-1',
      isAiPaused: false,
      inbox: { settings: { aiCommercePolicy: { enabled: true } } },
    });

    await listener.handleInboundMessage({
      workspaceId,
      conversationId,
      message: {
        id: 'msg-contact-1',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        isPrivate: false,
      },
    });

    // Check Redis debounce
    const debounceKey = getAiDebounceKey(workspaceId, conversationId);
    expect(redisStore.has(debounceKey)).toBeTruthy();
    expect(redisStore.get(debounceKey)?.ttl).toBe(AI_AGENT_CONSTANTS.DEBOUNCE_KEY_TTL_SECONDS);

    // Check BullMQ job enqueued
    expect(queuedJobs.length).toBe(1);
    const job = queuedJobs[0];
    expect(job.name).toBe('process-message');
    expect(job.data.workspaceId).toBe(workspaceId);
    expect(job.data.conversationId).toBe(conversationId);
    expect(job.data.messageId).toBe('msg-contact-1');
    expect(job.opts.delay).toBe(AI_AGENT_CONSTANTS.DEFAULT_DEBOUNCE_DELAY_MS);
    expect(job.opts.attempts).toBe(2);
  });
});
