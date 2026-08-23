import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ChannelIngestionProcessor } from './channel-ingestion.processor';
import { DatabaseModule } from '../database';
import { ContactsModule } from '../../modules/contacts';
import { ConversationsModule } from '../../modules/conversations';
import { MessagesModule } from '../../modules/messages';

export const CHANNEL_INGESTION_QUEUE = 'channel-ingestion';

@Global()
@Module({
  imports: [
    DatabaseModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
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
          };
        } catch {
          return {
            connection: {
              host: '127.0.0.1',
              port: 6379,
              maxRetriesPerRequest: null,
            },
          };
        }
      },
    }),
    BullModule.registerQueue({
      name: CHANNEL_INGESTION_QUEUE,
    }),
  ],
  providers: [ChannelIngestionProcessor],
  exports: [BullModule, ChannelIngestionProcessor],
})
export class QueueModule {}
