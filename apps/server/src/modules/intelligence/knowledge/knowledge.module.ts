import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth';
import { WorkspacesModule } from '../../identity/workspaces';
import { KNOWLEDGE_QUEUE_NAME } from './knowledge.constants';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';
import { KnowledgeEmbeddingProcessor } from './knowledge-embedding.processor';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    AuthModule,
    WorkspacesModule,
    BullModule.registerQueue({
      name: KNOWLEDGE_QUEUE_NAME,
    }),
  ],
  controllers: [KnowledgeController],
  providers: [KnowledgeEmbeddingService, KnowledgeEmbeddingProcessor, KnowledgeService],
  exports: [KnowledgeService, KnowledgeEmbeddingService, BullModule],
})
export class KnowledgeModule {}
