import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ScoreTriggerEvent } from '@sales-copilot/shared-contracts';
import { LeadScoreDecayScheduler } from '../lead-score-decay.scheduler';

describe('LeadScoreDecayScheduler (Hourly Inactivity Decay Cron)', () => {
  let scheduler: LeadScoreDecayScheduler;
  let mockPrismaService: any;
  let mockRedisService: any;
  let mockLeadScoringService: any;

  let leadsDb: Array<any>;
  let recalculateCalls: Array<{ workspaceId: string; leadId: string; trigger: any }>;
  let acquiredLockKey: string | null;
  let releasedLockKey: string | null;
  let lockAvailable: boolean;

  const wsId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    leadsDb = [];
    recalculateCalls = [];
    acquiredLockKey = null;
    releasedLockKey = null;
    lockAvailable = true;

    mockRedisService = {
      acquireLock: async (key: string) => {
        if (!lockAvailable) return null;
        acquiredLockKey = key;
        return 'token-cron-123';
      },
      releaseLock: async (key: string, _token: string) => {
        releasedLockKey = key;
        return true;
      },
    };

    mockPrismaService = {
      getClient: () => ({
        lead: {
          findMany: async ({ where: _where }: any) => {
            return leadsDb;
          },
        },
      }),
    };

    mockLeadScoringService = {
      recalculateScore: async (
        workspaceId: string,
        leadId: string,
        trigger: any,
        _reason: string,
      ) => {
        recalculateCalls.push({ workspaceId, leadId, trigger });
        return { score: 10 };
      },
    };

    scheduler = new LeadScoreDecayScheduler(
      mockPrismaService,
      mockRedisService,
      mockLeadScoringService,
    );
  });

  it('should skip execution if distributed lock cannot be acquired', async () => {
    lockAvailable = false;
    await scheduler.handleHourlyDecay();

    assert.strictEqual(acquiredLockKey, null);
    assert.strictEqual(recalculateCalls.length, 0);
    assert.strictEqual(releasedLockKey, null);
  });

  it('should scan inactive leads and recalculate scores with TIME_DECAY trigger', async () => {
    leadsDb.push(
      { id: 'lead-decay-1', workspaceId: wsId, score: 50 },
      { id: 'lead-decay-2', workspaceId: wsId, score: 30 },
    );

    await scheduler.handleHourlyDecay();

    assert.strictEqual(acquiredLockKey, 'ws:system:lead_scoring:decay_cron_lock');
    assert.strictEqual(recalculateCalls.length, 2);
    assert.strictEqual(recalculateCalls[0].leadId, 'lead-decay-1');
    assert.strictEqual(recalculateCalls[0].trigger, ScoreTriggerEvent.TIME_DECAY);
    assert.strictEqual(recalculateCalls[1].leadId, 'lead-decay-2');
    assert.strictEqual(releasedLockKey, 'ws:system:lead_scoring:decay_cron_lock');
  });
});
