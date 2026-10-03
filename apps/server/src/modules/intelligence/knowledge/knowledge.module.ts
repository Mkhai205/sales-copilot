import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../../infrastructure/database/database.module';
import { AuthModule } from '../../identity/auth/auth.module';
import { WorkspacesModule } from '../../identity/workspaces/workspaces.module';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';
import { KnowledgeEmbeddingProcessor } from './knowledge-embedding.processor';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [DatabaseModule, ConfigModule, AuthModule, WorkspacesModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeEmbeddingService, KnowledgeEmbeddingProcessor, KnowledgeService],
  exports: [KnowledgeService, KnowledgeEmbeddingService],
})
export class KnowledgeModule {}
