import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AI_AUTOPILOT_QUEUE } from '@sales-copilot/shared-contracts';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { RedisModule } from '../../../infrastructure/redis/redis.module';
import { MessagesModule } from '../../omnichannel/messages/messages.module';
import { AiAgentService } from './ai-agent.service';
import { AiAgentWorker } from './ai-agent.worker';
import { AiDispatcherListener } from './ai-dispatcher.listener';
import { AiTakeoverListener } from './ai-takeover.listener';
import { AiContextBuilder } from './ai-context.builder';

@Module({
  imports: [
    DatabaseModule,
    RedisModule,
    MessagesModule,
    BullModule.registerQueue({
      name: AI_AUTOPILOT_QUEUE,
    }),
  ],
  providers: [
    AiAgentService,
    AiAgentWorker,
    AiDispatcherListener,
    AiTakeoverListener,
    AiContextBuilder,
  ],
  exports: [AiAgentService, BullModule],
})
export class AiAgentModule {}
