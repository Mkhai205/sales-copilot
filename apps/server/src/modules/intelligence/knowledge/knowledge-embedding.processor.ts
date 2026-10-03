import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { KnowledgeEmbeddingStatus } from '../../../infrastructure/database/generated/enums';
import { KNOWLEDGE_EMBEDDING_QUEUE } from '@sales-copilot/shared-contracts';
import { type KnowledgeEmbeddingJobData } from './knowledge.constants';
import {
  KnowledgeEmbeddingService,
  formatKnowledgeForEmbedding,
} from './knowledge-embedding.service';

@Processor(KNOWLEDGE_EMBEDDING_QUEUE, { concurrency: 3 })
@Injectable()
export class KnowledgeEmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeEmbeddingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KnowledgeEmbeddingService,
  ) {
    super();
  }

  async process(job: Job<KnowledgeEmbeddingJobData>): Promise<{ success: boolean }> {
    const { articleId, workspaceId } = job.data;
    this.logger.log(
      `Processing embedding for article '${articleId}' in workspace '${workspaceId}' (job: ${job.id})`,
    );

    const client = this.prisma.getClient();

    // 1. Strict Multi-Tenancy check: Fetch article
    const article = await client.knowledgeArticle.findFirst({
      where: { id: articleId, workspaceId },
    });

    if (!article) {
      this.logger.warn(
        `KnowledgeArticle '${articleId}' not found for workspace '${workspaceId}'. Skipping.`,
      );
      return { success: false };
    }

    try {
      // 2. Mark status as PROCESSING
      await client.knowledgeArticle.updateMany({
        where: { id: articleId, workspaceId },
        data: {
          embeddingStatus: KnowledgeEmbeddingStatus.PROCESSING,
          embeddingError: null,
        },
      });

      // 3. Format text for semantic embedding
      const textToEmbed = formatKnowledgeForEmbedding(
        article.title,
        article.content,
        article.category,
      );

      // 4. Generate 768-dim embedding via Gemini
      const vector = await this.embeddingService.generateEmbedding(workspaceId, textToEmbed);
      const vectorString = JSON.stringify(vector);

      // 5. Update Postgres pgvector column & status READY
      await client.$executeRawUnsafe(
        `UPDATE "KnowledgeArticle"
         SET "embedding" = $1::vector,
             "embeddingStatus" = '${KnowledgeEmbeddingStatus.READY}',
             "embeddingError" = NULL,
             "updatedAt" = NOW()
         WHERE "id" = $2 AND "workspaceId" = $3`,
        vectorString,
        articleId,
        workspaceId,
      );

      this.logger.log(
        `Successfully generated and stored embedding for article '${articleId}' in workspace '${workspaceId}'`,
      );

      return { success: true };
    } catch (error: any) {
      this.logger.error(
        `Failed to generate embedding for article '${articleId}' in workspace '${workspaceId}': ${error?.message}`,
        error?.stack,
      );

      await client.knowledgeArticle.updateMany({
        where: { id: articleId, workspaceId },
        data: {
          embeddingStatus: KnowledgeEmbeddingStatus.FAILED,
          embeddingError: error?.message || 'Unknown error occurred while generating embedding',
        },
      });

      throw error;
    }
  }
}
