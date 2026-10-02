import { ConversationStatus, MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { AiAgentWorker } from '../ai-agent.worker';
import { AI_AGENT_CONSTANTS } from '../ai-agent.constants';

describe('AiAgentWorker - Proactive Follow-up (Feature 4.4.2)', () => {
  let worker: AiAgentWorker;
  let mockPrisma: any;
  let mockRedis: any;
  let mockAiAgentService: any;
  let mockMessagesService: any;
  let mockQueue: any;
  let conversationsDb: Map<string, any>;
  let createdMessages: any[];
  let scheduledJobs: any[];

  const workspaceId = 'ws-test-fu-1';
  const conversationId = 'conv-test-fu-1';
  const inboxId = 'inbox-test-fu-1';

  beforeEach(() => {
    conversationsDb = new Map();
    createdMessages = [];
    scheduledJobs = [];

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
            if (conv && conv.workspaceId === where.workspaceId) {
              Object.assign(conv, data);
              return { count: 1 };
            }
            return { count: 0 };
          },
        },
      }),
    };

    mockRedis = {
      get: async () => null,
    };

    mockAiAgentService = {
      processConversation: async () => ({
        text: 'Dạ shop có thể tư vấn chi tiết cho bạn ạ!',
        stepsCount: 1,
        usage: { promptTokens: 100, completionTokens: 30, totalTokens: 130 },
      }),
    };

    mockMessagesService = {
      create: async (wsId: string, convId: string, dto: any) => {
        createdMessages.push({ wsId, convId, dto });
        return { id: `msg-${Date.now()}`, ...dto };
      },
    };

    const existingQueueJobs = new Map<string, any>();
    mockQueue = {
      add: jest.fn().mockImplementation(async (name: string, data: any, opts: any) => {
        const job = {
          name,
          data,
          opts,
          remove: jest.fn().mockImplementation(async () => {
            if (opts?.jobId) {
              existingQueueJobs.delete(opts.jobId);
            }
          }),
        };
        scheduledJobs.push({ name, data, opts });
        if (opts?.jobId) {
          existingQueueJobs.set(opts.jobId, job);
        }
        return job;
      }),
      getJob: jest.fn().mockImplementation(async (jobId: string) => {
        return existingQueueJobs.get(jobId) || null;
      }),
    };

    worker = new AiAgentWorker(
      mockPrisma,
      mockRedis,
      mockAiAgentService,
      mockMessagesService,
      mockQueue,
    );
  });

  describe('Scheduling on AI reply', () => {
    it('should schedule a delayed follow-up BullMQ job with 5-minute delay and deterministic jobId', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
      });

      const beforeTime = Date.now();
      await worker.process({
        id: 'job-msg-1',
        name: 'process-message',
        data: {
          workspaceId,
          conversationId,
          inboxId,
          messageId: 'msg-1',
          scheduledAt: beforeTime,
        },
      } as any);

      // AI message should be created
      expect(createdMessages.length).toBe(1);
      expect(createdMessages[0].dto.content).toBe('Dạ shop có thể tư vấn chi tiết cho bạn ạ!');

      // Proactive follow-up job should be scheduled
      expect(scheduledJobs.length).toBe(1);
      const followUpJob = scheduledJobs[0];
      expect(followUpJob.name).toBe(AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME);
      expect(followUpJob.data.workspaceId).toBe(workspaceId);
      expect(followUpJob.data.conversationId).toBe(conversationId);
      expect(followUpJob.data.aiMessageTimestamp).toBeGreaterThanOrEqual(beforeTime);

      // Verify delay and dedup options
      expect(followUpJob.opts.delay).toBe(AI_AGENT_CONSTANTS.FOLLOW_UP_DELAY_MS);
      expect(followUpJob.opts.delay).toBe(5 * 60 * 1000);
      expect(followUpJob.opts.jobId).toBe(`follow-up-${conversationId}`);
      expect(followUpJob.opts.removeOnComplete).toBe(true);
      expect(followUpJob.opts.removeOnFail).toBe(true);
    });

    it('should remove existing delayed follow-up job before scheduling new one when multiple AI replies occur', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
      });

      // First AI message
      await worker.process({
        id: 'job-msg-1',
        name: 'process-message',
        data: {
          workspaceId,
          conversationId,
          inboxId,
          messageId: 'msg-1',
          scheduledAt: Date.now(),
        },
      } as any);

      expect(scheduledJobs.length).toBe(1);
      const firstJobInQueue = await mockQueue.getJob(`follow-up-${conversationId}`);
      expect(firstJobInQueue).toBeDefined();

      // Second AI message in next turn
      await worker.process({
        id: 'job-msg-2',
        name: 'process-message',
        data: {
          workspaceId,
          conversationId,
          inboxId,
          messageId: 'msg-2',
          scheduledAt: Date.now(),
        },
      } as any);

      // Previous job should have been removed
      expect(firstJobInQueue.remove).toHaveBeenCalledTimes(1);
      expect(scheduledJobs.length).toBe(2);
      expect(mockQueue.getJob).toHaveBeenCalledWith(`follow-up-${conversationId}`);
    });

    it('should respect custom followUpDelayMinutes and followUpMessage from aiCommercePolicy', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        inbox: {
          settings: {
            aiCommercePolicy: {
              enabled: true,
              followUpDelayMinutes: 10,
              followUpMessage: 'Bạn ơi còn cần tư vấn gì không ạ? 👋',
            },
          },
        },
      });

      await worker.process({
        id: 'job-msg-custom',
        name: 'process-message',
        data: {
          workspaceId,
          conversationId,
          inboxId,
          messageId: 'msg-custom',
          scheduledAt: Date.now(),
        },
      } as any);

      expect(scheduledJobs.length).toBe(1);
      const customJob = scheduledJobs[0];
      expect(customJob.opts.delay).toBe(10 * 60 * 1000); // 10 minutes
      expect(customJob.data.followUpMessage).toBe('Bạn ơi còn cần tư vấn gì không ạ? 👋');
    });

    it('should not schedule follow-up if AI produces empty response', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
      });

      mockAiAgentService.processConversation = async () => ({
        text: '',
      });

      await worker.process({
        id: 'job-msg-2',
        name: 'process-message',
        data: {
          workspaceId,
          conversationId,
          inboxId,
          messageId: 'msg-2',
          scheduledAt: Date.now(),
        },
      } as any);

      expect(createdMessages.length).toBe(0);
      expect(scheduledJobs.length).toBe(0);
    });
  });

  describe('Follow-up job execution (processFollowUp)', () => {
    it('should dispatch follow-up message when customer has not replied after 5 minutes', async () => {
      const aiMessageTimestamp = Date.now() - 300000; // 5 minutes ago
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: null, // customer never replied
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp,
        },
      } as any);

      expect(result.skipped).toBe(false);
      expect(result.reason).toBe('FOLLOW_UP_SENT');

      // Verify follow-up message content & metadata
      expect(createdMessages.length).toBe(1);
      const msg = createdMessages[0];
      expect(msg.wsId).toBe(workspaceId);
      expect(msg.convId).toBe(conversationId);
      expect(msg.dto.content).toBe(AI_AGENT_CONSTANTS.FOLLOW_UP_MESSAGE);
      expect(msg.dto.content).toBe('Anh/chị còn cần hỗ trợ gì không ạ? 😊');
      expect(msg.dto.senderType).toBe(SenderType.SYSTEM);
      expect(msg.dto.messageType).toBe(MessageType.OUTGOING);
      expect(msg.dto.isPrivate).toBe(false);
      expect(msg.dto.metadata).toEqual({
        isAiGenerated: true,
        isFollowUp: true,
      });
    });

    it('should skip follow-up when customer already replied after AI message', async () => {
      const aiMessageTimestamp = 1000000;
      const customerReplyTime = new Date(1005000); // 5 seconds after AI message

      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: customerReplyTime,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp,
        },
      } as any);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('CUSTOMER_ALREADY_REPLIED');
      expect(createdMessages.length).toBe(0);
    });

    it('should send follow-up when customer last reply was BEFORE AI message', async () => {
      const customerMessageTime = new Date(1000000);
      const aiMessageTimestamp = 1005000; // AI replied after customer

      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: customerMessageTime,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp,
        },
      } as any);

      expect(result.skipped).toBe(false);
      expect(result.reason).toBe('FOLLOW_UP_SENT');
      expect(createdMessages.length).toBe(1);
    });

    it('should skip follow-up when Human Takeover is active (isAiPaused = true)', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: true,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: null,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp: Date.now() - 300000,
        },
      } as any);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('HUMAN_TAKEOVER');
      expect(createdMessages.length).toBe(0);
    });

    it('should skip follow-up when conversation status is RESOLVED', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.RESOLVED,
        lastContactMessageAt: null,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp: Date.now() - 300000,
        },
      } as any);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('RESOLVED');
      expect(createdMessages.length).toBe(0);
    });

    it('should skip follow-up when conversation is not found or in different workspace (Multi-Tenancy)', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId: 'other-ws',
        isAiPaused: false,
        status: ConversationStatus.OPEN,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp: Date.now() - 300000,
        },
      } as any);

      expect(result.skipped).toBe(true);
      expect(result.reason).toBe('CONVERSATION_NOT_FOUND');
      expect(createdMessages.length).toBe(0);
    });

    it('should update lastAiMessageAt when follow-up message is dispatched', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: null,
        lastAiMessageAt: null,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp: Date.now() - 300000,
        },
      } as any);

      expect(result.skipped).toBe(false);
      expect(result.reason).toBe('FOLLOW_UP_SENT');
      const conv = conversationsDb.get(conversationId);
      expect(conv.lastAiMessageAt).toBeInstanceOf(Date);
    });

    it('should use custom followUpMessage in processFollowUp if provided in job data', async () => {
      conversationsDb.set(conversationId, {
        id: conversationId,
        workspaceId,
        isAiPaused: false,
        status: ConversationStatus.OPEN,
        lastContactMessageAt: null,
      });

      const result = await worker.process({
        id: `follow-up-${conversationId}`,
        name: AI_AGENT_CONSTANTS.FOLLOW_UP_JOB_NAME,
        data: {
          workspaceId,
          conversationId,
          aiMessageTimestamp: Date.now() - 300000,
          followUpMessage: 'Em có thể hỗ trợ gì thêm không ạ?',
        },
      } as any);

      expect(result.skipped).toBe(false);
      expect(result.text).toBe('Em có thể hỗ trợ gì thêm không ạ?');
      expect(createdMessages.length).toBe(1);
      expect(createdMessages[0].dto.content).toBe('Em có thể hỗ trợ gì thêm không ạ?');
    });
  });
});
