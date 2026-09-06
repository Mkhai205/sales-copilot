import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { LEAD_SCORING_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../infrastructure/database';
import { RedisModule } from '../../infrastructure/redis';
import { LeadScoreDecayScheduler } from './lead-score-decay.scheduler';
import { LeadScoringCalculator } from './lead-scoring.calculator';
import { LeadScoringController } from './lead-scoring.controller';
import { LeadScoringListener } from './lead-scoring.listener';
import { LeadScoringProcessor } from './lead-scoring.processor';
import { LeadScoringService } from './lead-scoring.service';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    BullModule.registerQueue({
      name: LEAD_SCORING_QUEUE,
    }),
  ],
  controllers: [LeadScoringController],
  providers: [
    LeadScoringService,
    LeadScoringCalculator,
    LeadScoringListener,
    LeadScoringProcessor,
    LeadScoreDecayScheduler,
  ],
  exports: [LeadScoringService, LeadScoringCalculator, BullModule],
})
export class LeadScoringModule {}
