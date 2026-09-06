import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  COPILOT_SUGGESTIONS_QUEUE,
  GENERATE_COPILOT_SUGGESTIONS_JOB,
} from '@sales-copilot/shared-contracts';
import { CopilotProcessor } from '../copilot.processor';

describe('CopilotProcessor (BullMQ Worker & Debounce/Locking)', () => {
  let processor: CopilotProcessor;
  let mockContextService: any;
  let mockEngineService: any;
  let mockCopilotService: any;
  let mockRedisService: any;
  let redisStore: Map<string, string>;

  beforeEach(() => {
    redisStore = new Map();

    mockRedisService = {
      get: async (key: string) => redisStore.get(key) || null,
      del: async (key: string) => redisStore.delete(key),
      acquireLock: async (key: string) => `token-${Date.now()}`,
      releaseLock: async () => {},
    };

    mockContextService = {
      buildContext: async () => ({
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        leadId: 'lead-1',
      }),
    };

    mockEngineService = {
      generateStructuredSuggestions: async () => [
        {
          title: 'Draft',
          content: 'Suggested content',
          confidence: 0.9,
          actionPayload: {},
        },
      ],
    };

    mockCopilotService = {
      createSuggestions: async () => [
        {
          id: 'sug-1',
          title: 'Draft',
        },
      ],
    };

    processor = new CopilotProcessor(
      mockContextService,
      mockEngineService,
      mockCopilotService,
      mockRedisService,
    );
  });

  it('should process job and create suggestions', async () => {
    const job: any = {
      name: GENERATE_COPILOT_SUGGESTIONS_JOB,
      data: {
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        scheduledAt: Date.now(),
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.conversationId, 'conv-1');
    assert.strictEqual(result.generatedCount, 1);
  });

  it('should skip job if superseded by a newer scheduled event in Redis', async () => {
    const olderScheduledAt = Date.now() - 5000;
    const newerScheduledAt = Date.now();

    // Set newer debounce timestamp in Redis
    redisStore.set('ws:ws-1:copilot:debounce:conv-1', String(newerScheduledAt));

    const job: any = {
      name: GENERATE_COPILOT_SUGGESTIONS_JOB,
      data: {
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        scheduledAt: olderScheduledAt,
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.status, 'skipped');
    assert.strictEqual(result.reason, 'superseded_by_newer_message');
  });

  it('should return locked if distributed lock could not be acquired', async () => {
    mockRedisService.acquireLock = async () => null; // Failed lock

    const job: any = {
      name: GENERATE_COPILOT_SUGGESTIONS_JOB,
      data: {
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        scheduledAt: Date.now(),
      },
    };

    const result = await processor.process(job);

    assert.strictEqual(result.status, 'locked');
  });
});
