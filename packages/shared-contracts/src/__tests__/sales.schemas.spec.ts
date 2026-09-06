import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  LeadStatus,
  LeadStage,
  LeadGrade,
  OpportunityStage,
  STAGE_DEFAULT_PROBABILITIES,
  computeLeadGrade,
  createLeadSchema,
  updateLeadSchema,
  convertLeadSchema,
  createOpportunitySchema,
  updateOpportunityStageSchema,
  listLeadsQuerySchema,
  listOpportunitiesQuerySchema,
  pipelineSummaryQuerySchema,
  type CreateLeadDto,
  type CreateOpportunityDto,
} from '../sales';

describe('Sales Shared Contracts & Schemas', () => {
  describe('computeLeadGrade', () => {
    it('should classify score >= 80 as HOT', () => {
      assert.strictEqual(computeLeadGrade(80), LeadGrade.HOT);
      assert.strictEqual(computeLeadGrade(95), LeadGrade.HOT);
      assert.strictEqual(computeLeadGrade(100), LeadGrade.HOT);
    });

    it('should classify score 50..79 as WARM', () => {
      assert.strictEqual(computeLeadGrade(50), LeadGrade.WARM);
      assert.strictEqual(computeLeadGrade(65), LeadGrade.WARM);
      assert.strictEqual(computeLeadGrade(79), LeadGrade.WARM);
    });

    it('should classify score 20..49 as COLD', () => {
      assert.strictEqual(computeLeadGrade(20), LeadGrade.COLD);
      assert.strictEqual(computeLeadGrade(35), LeadGrade.COLD);
      assert.strictEqual(computeLeadGrade(49), LeadGrade.COLD);
    });

    it('should classify score < 20 as JUNK', () => {
      assert.strictEqual(computeLeadGrade(19), LeadGrade.JUNK);
      assert.strictEqual(computeLeadGrade(0), LeadGrade.JUNK);
      assert.strictEqual(computeLeadGrade(-10), LeadGrade.JUNK);
    });
  });

  describe('STAGE_DEFAULT_PROBABILITIES', () => {
    it('should provide correct probability defaults according to spec', () => {
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.PROSPECTING], 10);
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.QUALIFICATION], 25);
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.PROPOSAL], 50);
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.NEGOTIATION], 80);
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.CLOSED_WON], 100);
      assert.strictEqual(STAGE_DEFAULT_PROBABILITIES[OpportunityStage.CLOSED_LOST], 0);
    });
  });

  describe('createLeadSchema', () => {
    const validContactId = '11111111-1111-4111-8111-111111111111';

    it('should validate and parse valid lead creation payload with defaults', () => {
      const parsed = createLeadSchema.parse({
        contactId: validContactId,
      });

      assert.strictEqual(parsed.contactId, validContactId);
      assert.strictEqual(parsed.currency, 'USD');
      assert.deepStrictEqual(parsed.metadata, {});
      assert.strictEqual(parsed.estimatedValue, undefined);
    });

    it('should allow CreateLeadDto to omit status, stage, currency, and metadata', () => {
      const inputDto: CreateLeadDto = {
        contactId: validContactId,
      };
      const parsed = createLeadSchema.parse(inputDto);
      assert.strictEqual(parsed.status, LeadStatus.NEW);
      assert.strictEqual(parsed.stage, LeadStage.DISCOVERY);
      assert.strictEqual(parsed.currency, 'USD');
      assert.deepStrictEqual(parsed.metadata, {});
    });

    it('should parse explicit estimatedValue and custom currency', () => {
      const parsed = createLeadSchema.parse({
        contactId: validContactId,
        estimatedValue: 15000,
        currency: 'eur',
        metadata: { source: 'web_form' },
      });

      assert.strictEqual(parsed.estimatedValue, 15000);
      assert.strictEqual(parsed.currency, 'EUR');
      assert.deepStrictEqual(parsed.metadata, { source: 'web_form' });
    });

    it('should parse status, stage, and assignedUserId if provided', () => {
      const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
      const parsed = createLeadSchema.parse({
        contactId: validContactId,
        status: LeadStatus.CONTACTED,
        stage: LeadStage.EVALUATION,
        assignedUserId: userId,
      });

      assert.strictEqual(parsed.status, LeadStatus.CONTACTED);
      assert.strictEqual(parsed.stage, LeadStage.EVALUATION);
      assert.strictEqual(parsed.assignedUserId, userId);
    });

    it('should reject invalid assignedUserId uuid', () => {
      assert.throws(() => {
        createLeadSchema.parse({
          contactId: validContactId,
          assignedUserId: 'invalid-user-uuid',
        });
      });
    });

    it('should reject invalid contactId uuid', () => {
      assert.throws(() => {
        createLeadSchema.parse({ contactId: 'not-a-uuid' });
      });
    });

    it('should reject negative estimatedValue', () => {
      assert.throws(() => {
        createLeadSchema.parse({
          contactId: validContactId,
          estimatedValue: -500,
        });
      });
    });
  });

  describe('updateLeadSchema', () => {
    it('should allow partial updates with valid enum values', () => {
      const parsed = updateLeadSchema.parse({
        status: LeadStatus.ENGAGED,
        stage: LeadStage.EVALUATION,
        estimatedValue: 20000,
      });

      assert.strictEqual(parsed.status, LeadStatus.ENGAGED);
      assert.strictEqual(parsed.stage, LeadStage.EVALUATION);
      assert.strictEqual(parsed.estimatedValue, 20000);
    });

    it('should reject invalid status value', () => {
      assert.throws(() => {
        updateLeadSchema.parse({
          status: 'INVALID_STATUS',
        });
      });
    });
  });

  describe('convertLeadSchema', () => {
    it('should accept title and set default stage and probability', () => {
      const parsed = convertLeadSchema.parse({
        title: 'Acme Corp Annual Deal',
        amount: 50000,
      });

      assert.strictEqual(parsed.title, 'Acme Corp Annual Deal');
      assert.strictEqual(parsed.amount, 50000);
      assert.strictEqual(parsed.stage, OpportunityStage.QUALIFICATION);
      assert.strictEqual(parsed.probability, 25);
      assert.strictEqual(parsed.currency, 'USD');
    });

    it('should accept dealName alias and transform to title', () => {
      const parsed = convertLeadSchema.parse({
        dealName: 'Acme Corp Deal Alias',
        amount: 30000,
      });

      assert.strictEqual(parsed.title, 'Acme Corp Deal Alias');
      assert.strictEqual(parsed.amount, 30000);
      assert.strictEqual(parsed.probability, 25);
    });

    it('should preserve explicit custom probability', () => {
      const parsed = convertLeadSchema.parse({
        title: 'High Intent Deal',
        amount: 75000,
        stage: OpportunityStage.PROPOSAL,
        probability: 60,
      });

      assert.strictEqual(parsed.stage, OpportunityStage.PROPOSAL);
      assert.strictEqual(parsed.probability, 60);
    });

    it('should reject when both title and dealName are missing', () => {
      assert.throws(() => {
        convertLeadSchema.parse({
          amount: 10000,
        });
      });
    });

    it('should reject title shorter than 3 characters', () => {
      assert.throws(() => {
        convertLeadSchema.parse({
          title: 'ab',
          amount: 10000,
        });
      });
    });

    it('should reject amount <= 0', () => {
      assert.throws(() => {
        convertLeadSchema.parse({
          title: 'Valid Title',
          amount: 0,
        });
      });
    });

    it('should accept valid ISO expectedCloseDate and reject invalid ISO format', () => {
      const valid = convertLeadSchema.parse({
        title: 'Valid Deal',
        amount: 5000,
        expectedCloseDate: '2026-12-31T00:00:00.000Z',
      });
      assert.strictEqual(valid.expectedCloseDate, '2026-12-31T00:00:00.000Z');

      assert.throws(() => {
        convertLeadSchema.parse({
          title: 'Valid Deal',
          amount: 5000,
          expectedCloseDate: 'not-a-real-date',
        });
      });
    });
  });

  describe('createOpportunitySchema', () => {
    const validContactId = '22222222-2222-4222-8222-222222222222';

    it('should auto-compute probability from stage if omitted', () => {
      const parsed = createOpportunitySchema.parse({
        contactId: validContactId,
        title: 'New Enterprise Expansion',
        stage: OpportunityStage.PROPOSAL,
        amount: 80000,
      });

      assert.strictEqual(parsed.probability, 50);
      assert.strictEqual(parsed.stage, OpportunityStage.PROPOSAL);
      assert.strictEqual(parsed.currency, 'USD');
    });

    it('should allow CreateOpportunityDto to omit metadata, currency, and stage', () => {
      const inputDto: CreateOpportunityDto = {
        contactId: validContactId,
        title: 'Minimal Opportunity',
        amount: 25000,
      };
      const parsed = createOpportunitySchema.parse(inputDto);
      assert.strictEqual(parsed.stage, OpportunityStage.PROSPECTING);
      assert.strictEqual(parsed.currency, 'USD');
      assert.deepStrictEqual(parsed.metadata, {});
      assert.strictEqual(parsed.probability, 10);
    });

    it('should preserve custom probability if provided', () => {
      const parsed = createOpportunitySchema.parse({
        contactId: validContactId,
        title: 'New Enterprise Expansion',
        stage: OpportunityStage.PROPOSAL,
        amount: 80000,
        probability: 70,
      });

      assert.strictEqual(parsed.probability, 70);
    });

    it('should reject invalid amount <= 0', () => {
      assert.throws(() => {
        createOpportunitySchema.parse({
          contactId: validContactId,
          title: 'Invalid Deal',
          amount: -100,
        });
      });
    });

    it('should accept valid ISO expectedCloseDate and reject invalid ISO format', () => {
      const valid = createOpportunitySchema.parse({
        contactId: validContactId,
        title: 'New Expansion',
        amount: 80000,
        expectedCloseDate: '2026-11-30T12:00:00.000Z',
      });
      assert.strictEqual(valid.expectedCloseDate, '2026-11-30T12:00:00.000Z');

      assert.throws(() => {
        createOpportunitySchema.parse({
          contactId: validContactId,
          title: 'New Expansion',
          amount: 80000,
          expectedCloseDate: 'invalid-date',
        });
      });
    });
  });

  describe('updateOpportunityStageSchema', () => {
    it('should allow updating stage to CLOSED_WON without lostReason', () => {
      const parsed = updateOpportunityStageSchema.parse({
        stage: OpportunityStage.CLOSED_WON,
      });

      assert.strictEqual(parsed.stage, OpportunityStage.CLOSED_WON);
    });

    it('should allow updating stage to CLOSED_LOST when lostReason >= 5 characters', () => {
      const parsed = updateOpportunityStageSchema.parse({
        stage: OpportunityStage.CLOSED_LOST,
        lostReason: 'Budget constraints this quarter',
      });

      assert.strictEqual(parsed.stage, OpportunityStage.CLOSED_LOST);
      assert.strictEqual(parsed.lostReason, 'Budget constraints this quarter');
    });

    it('should reject CLOSED_LOST when lostReason is missing or null', () => {
      assert.throws(
        () => {
          updateOpportunityStageSchema.parse({
            stage: OpportunityStage.CLOSED_LOST,
          });
        },
        (err: any) => {
          return err.errors?.[0]?.message.includes('lostReason is required');
        },
      );
    });

    it('should reject CLOSED_LOST when lostReason is shorter than 5 characters', () => {
      assert.throws(
        () => {
          updateOpportunityStageSchema.parse({
            stage: OpportunityStage.CLOSED_LOST,
            lostReason: 'bad',
          });
        },
        (err: any) => {
          return err.errors?.[0]?.message.includes('lostReason is required');
        },
      );
    });
  });

  describe('Query schemas', () => {
    it('should validate listLeadsQuerySchema defaults', () => {
      const parsed = listLeadsQuerySchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
      assert.strictEqual(parsed.sortBy, 'createdAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });

    it('should validate listOpportunitiesQuerySchema defaults', () => {
      const parsed = listOpportunitiesQuerySchema.parse({});
      assert.strictEqual(parsed.page, 1);
      assert.strictEqual(parsed.limit, 20);
      assert.strictEqual(parsed.sortBy, 'createdAt');
      assert.strictEqual(parsed.sortOrder, 'desc');
    });

    it('should validate valid ISO startDate and endDate in listOpportunitiesQuerySchema', () => {
      const parsed = listOpportunitiesQuerySchema.parse({
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-12-31T23:59:59.999Z',
      });
      assert.strictEqual(parsed.startDate, '2026-01-01T00:00:00.000Z');
      assert.strictEqual(parsed.endDate, '2026-12-31T23:59:59.999Z');

      assert.throws(() => {
        listOpportunitiesQuerySchema.parse({
          startDate: 'invalid-date',
        });
      });

      assert.throws(() => {
        listOpportunitiesQuerySchema.parse({
          endDate: 'not-a-date',
        });
      });
    });

    it('should validate pipelineSummaryQuerySchema defaults', () => {
      const parsed = pipelineSummaryQuerySchema.parse({});
      assert.strictEqual(parsed.currency, 'USD');
    });
  });
});
