import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ChannelIngestionProcessor } from './channel-ingestion.processor';
import { DatabaseModule } from '../database';
import { ContactsModule } from '../../modules/omnichannel/contacts';
import { ConversationsModule } from '../../modules/omnichannel/conversations';
import { MessagesModule } from '../../modules/omnichannel/messages';
import { InboxesModule } from '../../modules/omnichannel/inboxes';

import { CommentGuardProcessor } from '../../modules/omnichannel/integrations/facebook/comment-guard.processor';
import { COMMENT_GUARD_QUEUE } from '@sales-copilot/shared-contracts';

export const CHANNEL_INGESTION_QUEUE = 'channel-ingestion';
export { COMMENT_GUARD_QUEUE };

@Global()
@Module({
  imports: [
    DatabaseModule,
    ContactsModule,
    ConversationsModule,
    MessagesModule,
    InboxesModule,
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
    BullModule.registerQueue(
      {
        name: CHANNEL_INGESTION_QUEUE,
      },
      {
        name: COMMENT_GUARD_QUEUE,
      },
    ),
  ],
  providers: [ChannelIngestionProcessor, CommentGuardProcessor],
  exports: [BullModule, ChannelIngestionProcessor, CommentGuardProcessor],
})
export class QueueModule {}
