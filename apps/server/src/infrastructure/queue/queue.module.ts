import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../database/database.module';
import { CHANNEL_INGESTION_QUEUE, COMMENT_GUARD_QUEUE } from '@sales-copilot/shared-contracts';

/**
 * Global BullMQ wiring: Redis connection + queue registrations. Queue
 * name constants live in @sales-copilot/shared-contracts (src/common/queues);
 * the processors themselves live next to the domain modules that own them
 * (omnichannel/integrations, facebook).
 */
@Global()
@Module({
  imports: [
    DatabaseModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('REDIS_URL') || 'redis://localhost:6379';
        try {
          const parsed = new URL(redisUrl);
          return {
            connection: {
              host: parsed.hostname || '127.0.0.1',
              port: parsed.port ? parseInt(parsed.port, 10) : 6379,
              username: parsed.username || undefined,
              password: parsed.password || undefined,
              maxRetriesPerRequest: null,
            },
            defaultJobOptions: {
              // Bounded retention: completed jobs kept 1h / max 500, failed jobs
              // kept 7 days / max 1000 (enough for debugging, no unbounded growth).
              removeOnComplete: { age: 3600, count: 500 },
              removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
            },
          };
        } catch {
          return {
            connection: {
              host: '127.0.0.1',
              port: 6379,
              maxRetriesPerRequest: null,
            },
            defaultJobOptions: {
              removeOnComplete: { age: 3600, count: 500 },
              removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
            },
          };
        }
      },
    }),
    BullModule.registerQueue(
      {
        name: CHANNEL_INGESTION_QUEUE,
      },
      {
        name: COMMENT_GUARD_QUEUE,
      },
    ),
  ],
  providers: [],
  exports: [BullModule],
})
export class QueueModule {}
