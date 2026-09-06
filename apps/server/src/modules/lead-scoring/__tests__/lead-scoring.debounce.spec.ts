import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  RECALCULATE_LEAD_SCORE_JOB,
  RecalculateLeadScoreJobDto,
  ScoreTriggerEvent,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { LeadScoringListener } from '../lead-scoring.listener';
import { LeadScoringProcessor } from '../lead-scoring.processor';

describe('Lead Scoring Concurrency & Debounce Engine (US-2.5.3 Message Burst Handling)', () => {
  let listener: LeadScoringListener;
  let processor: LeadScoringProcessor;

  let redisStore: Map<string, string>;
  let mockRedisService: any;
  let mockScoringQueue: any;
  let mockPrismaService: any;
  let mockConfigService: any;
  let mockLeadScoringService: any;

  let recalculateCalls: Array<{ workspaceId: string; leadId: string; trigger: any }>;
  let enqueuedJobs: Array<{ jobName: string; data: RecalculateLeadScoreJobDto; options: any }>;

  const wsId = '11111111-1111-4111-8111-111111111111';
  const leadId = 'lead-burst-001';
  const convId = 'conv-burst-001';
  const contactId = 'contact-burst-001';

  beforeEach(() => {
    redisStore = new Map();
    recalculateCalls = [];
    enqueuedJobs = [];

    mockRedisService = {
      get: async (key: string) => redisStore.get(key) || null,
      set: async (key: string, val: string) => {
        redisStore.set(key, val);
      },
      del: async (key: string) => {
        redisStore.delete(key);
        return 1;
      },
      acquireLock: async (key: string) => {
        if (redisStore.has(key)) return null;
        redisStore.set(key, 'locked');
        return 'lock-token-123';
      },
      releaseLock: async (key: string) => {
        redisStore.delete(key);
        return true;
      },
    };

    mockScoringQueue = {
      add: async (jobName: string, data: any, options: any) => {
        enqueuedJobs.push({ jobName, data, options });
      },
    };

    mockConfigService = {
      get: (key: string, defVal: any) => {
        if (key === 'LEAD_SCORE_DEBOUNCE_MS') return 30000;
        return defVal;
      },
    };

    mockPrismaService = {
      getClient: () => ({
        conversation: {
          findFirst: async () => ({ id: convId, contactId, workspaceId: wsId }),
        },
        lead: {
          findFirst: async () => ({ id: leadId, contactId, workspaceId: wsId }),
        },
      }),
    };

    mockLeadScoringService = {
      recalculateScore: async (
        workspaceId: string,
        lId: string,
        trigger: any,
        _reason?: string,
      ) => {
        recalculateCalls.push({ workspaceId, leadId: lId, trigger });
        return { score: 85, grade: 'HOT' };
      },
    };

    listener = new LeadScoringListener(
      mockScoringQueue,
      mockRedisService,
      mockPrismaService,
      mockConfigService,
    );

    processor = new LeadScoringProcessor(mockLeadScoringService, mockRedisService);
  });

  // ==========================================================================
  // US-2.5.3 Burst Scenario
  // ==========================================================================
  it('should coalesce 5 rapid messages into delayed jobs and execute only the latest job after quiet period', async () => {
    // 1. Simulate burst of 5 customer messages in 15 seconds
    for (let i = 1; i <= 5; i++) {
      await listener.handleMessageCreated({
        workspaceId: wsId,
        conversationId: convId,
        leadId,
        message: {
          id: `msg-${i}`,
          conversationId: convId,
          workspaceId: wsId,
          senderType: SenderType.CONTACT,
          isPrivate: false,
        },
      });
    }

    // 5 delayed jobs were registered with 30s delay
    assert.strictEqual(enqueuedJobs.length, 5);
    for (const job of enqueuedJobs) {
      assert.strictEqual(job.jobName, RECALCULATE_LEAD_SCORE_JOB);
      assert.strictEqual(job.options.delay, 30000);
      assert.strictEqual(job.data.leadId, leadId);
    }

    // The Redis debounce key now holds the timestamp of the LAST message
    const latestRecordedTime = Number(
      await mockRedisService.get(`ws:${wsId}:lead_scoring:debounce:${leadId}`),
    );
    assert.ok(latestRecordedTime > 0);

    // 2. Simulate worker executing the earlier 4 jobs (which were superseded)
    for (let i = 0; i < 4; i++) {
      // Modify scheduledAt to be earlier than latestRecordedTime
      const job = {
        name: RECALCULATE_LEAD_SCORE_JOB,
        data: {
          ...enqueuedJobs[i].data,
          scheduledAt: latestRecordedTime - 5000,
        },
      };

      const result = await processor.process(job as any);
      assert.strictEqual(result.status, 'skipped');
      assert.strictEqual(result.reason, 'superseded_by_newer_event');
    }

    // No recalculation should have occurred yet
    assert.strictEqual(recalculateCalls.length, 0);

    // 3. Simulate worker executing the 5th (final) job after the quiet period
    const finalJob = {
      name: RECALCULATE_LEAD_SCORE_JOB,
      data: {
        ...enqueuedJobs[4].data,
        scheduledAt: latestRecordedTime, // Equals latest timestamp!
      },
    };

    const finalResult = await processor.process(finalJob as any);
    assert.strictEqual(finalResult.status, 'success');
    assert.strictEqual(finalResult.score, 85);

    // Exactly 1 recalculation was executed for the entire burst
    assert.strictEqual(recalculateCalls.length, 1);
    assert.strictEqual(recalculateCalls[0].leadId, leadId);

    // Debounce key is cleaned up after successful completion
    const keyAfterCompletion = await mockRedisService.get(
      `ws:${wsId}:lead_scoring:debounce:${leadId}`,
    );
    assert.strictEqual(keyAfterCompletion, null);
  });

  it('should skip job when distributed lock is already held by another worker', async () => {
    const now = Date.now();
    await mockRedisService.set(`ws:${wsId}:lead_scoring:debounce:${leadId}`, String(now));

    // Pre-lock the lead
    await mockRedisService.acquireLock(`ws:${wsId}:lead_scoring:lock:${leadId}`);

    const job = {
      name: RECALCULATE_LEAD_SCORE_JOB,
      data: {
        workspaceId: wsId,
        leadId,
        scheduledAt: now,
        trigger: ScoreTriggerEvent.MESSAGE_RECEIVED,
      },
    };

    const result = await processor.process(job as any);
    assert.strictEqual(result.status, 'locked');
    assert.strictEqual(recalculateCalls.length, 0);
  });
});
