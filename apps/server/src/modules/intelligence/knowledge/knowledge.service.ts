import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type {
  CreateKnowledgeArticleDto,
  KnowledgeArticleDto,
  KnowledgeArticleListResponseDto,
  KnowledgeArticleQueryDto,
  TestSearchResultDto,
  UpdateKnowledgeArticleDto,
} from '@sales-copilot/shared-contracts';
import { KNOWLEDGE_EMBEDDING_QUEUE } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { KnowledgeEmbeddingStatus } from '../../../infrastructure/database/generated/enums';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_TOP_K,
  MAX_ARTICLES_PER_WORKSPACE,
  type KnowledgeEmbeddingJobData,
} from './knowledge.constants';
import { KnowledgeEmbeddingService } from './knowledge-embedding.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: KnowledgeEmbeddingService,
    @InjectQueue(KNOWLEDGE_EMBEDDING_QUEUE)
    private readonly knowledgeQueue: Queue<KnowledgeEmbeddingJobData>,
  ) {}

  /**
   * Enqueues an article for vector embedding.
   */
  private async enqueueEmbedding(workspaceId: string, articleId: string): Promise<void> {
    try {
      await this.knowledgeQueue.add(
        'generate-embedding',
        { workspaceId, articleId },
        {
          jobId: `embed-${workspaceId}-${articleId}-${Date.now()}`,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to enqueue embedding job for article '${articleId}': ${err?.message}`,
        err?.stack,
      );
    }
  }

  /**
   * Lists knowledge articles for a workspace with pagination and filters.
   * Strict Multi-Tenancy: always filters by workspaceId.
   */
  async list(
    workspaceId: string,
    query?: KnowledgeArticleQueryDto,
  ): Promise<KnowledgeArticleListResponseDto> {
    const client = this.prisma.getClient();
    const page =
      typeof query?.page === 'number' && query.page > 0
        ? query.page
        : Number(query?.page) > 0
          ? Number(query?.page)
          : 1;
    const limit =
      typeof query?.limit === 'number' && query.limit > 0
        ? query.limit
        : Number(query?.limit) > 0
          ? Number(query?.limit)
          : 20;
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (query?.category) {
      where.category = query.category;
    }

    if (query?.status) {
      where.embeddingStatus = query.status;
    }

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search && query.search.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { title: { contains: searchTerm, mode: 'insensitive' } },
        { content: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const sortBy = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder || 'desc';

    const [total, items] = await Promise.all([
      client.knowledgeArticle.count({ where }),
      client.knowledgeArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          workspaceId: true,
          title: true,
          content: true,
          category: true,
          embeddingStatus: true,
          embeddingError: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      items: items as KnowledgeArticleDto[],
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Retrieves a single article by ID.
   * Strict Multi-Tenancy: ensures article belongs to the workspace.
   */
  async getById(workspaceId: string, id: string): Promise<KnowledgeArticleDto> {
    const client = this.prisma.getClient();
    const article = await client.knowledgeArticle.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        content: true,
        category: true,
        embeddingStatus: true,
        embeddingError: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!article) {
      throw new NotFoundException(`Knowledge article with ID '${id}' not found`);
    }

    return article as KnowledgeArticleDto;
  }

  /**
   * Creates a new knowledge article, enforcing workspace limits and enqueuing embedding.
   */
  async create(workspaceId: string, dto: CreateKnowledgeArticleDto): Promise<KnowledgeArticleDto> {
    const client = this.prisma.getClient();

    // Check workspace article limit
    const totalCount = await client.knowledgeArticle.count({
      where: { workspaceId },
    });

    if (totalCount >= MAX_ARTICLES_PER_WORKSPACE) {
      throw new BadRequestException({
        code: 'MAX_ARTICLES_EXCEEDED',
        message: `Đã đạt giới hạn tối đa ${MAX_ARTICLES_PER_WORKSPACE} bài viết kiến thức cho workspace.`,
      });
    }

    const article = await client.knowledgeArticle.create({
      data: {
        workspaceId,
        title: dto.title.trim(),
        content: dto.content.trim(),
        category: dto.category?.trim() || null,
        isActive: dto.isActive ?? true,
        embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
      },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        content: true,
        category: true,
        embeddingStatus: true,
        embeddingError: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Enqueue embedding generation asynchronously
    await this.enqueueEmbedding(workspaceId, article.id);

    return article as KnowledgeArticleDto;
  }

  /**
   * Updates an existing knowledge article. If title or content changed, triggers re-embedding.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateKnowledgeArticleDto,
  ): Promise<KnowledgeArticleDto> {
    const client = this.prisma.getClient();

    const existing = await client.knowledgeArticle.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException(`Knowledge article with ID '${id}' not found`);
    }

    const shouldReEmbed =
      (dto.title !== undefined && dto.title.trim() !== existing.title) ||
      (dto.content !== undefined && dto.content.trim() !== existing.content) ||
      (dto.category !== undefined && (dto.category?.trim() || null) !== existing.category);

    const updated = await client.knowledgeArticle.update({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.content !== undefined ? { content: dto.content.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category?.trim() || null } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(shouldReEmbed
          ? { embeddingStatus: KnowledgeEmbeddingStatus.PENDING, embeddingError: null }
          : {}),
      },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        content: true,
        category: true,
        embeddingStatus: true,
        embeddingError: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (shouldReEmbed) {
      await this.enqueueEmbedding(workspaceId, id);
    }

    return updated as KnowledgeArticleDto;
  }

  /**
   * Hard deletes an article from the workspace.
   */
  async delete(workspaceId: string, id: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();

    const existing = await client.knowledgeArticle.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException(`Knowledge article with ID '${id}' not found`);
    }

    await client.knowledgeArticle.delete({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
    });

    return { success: true };
  }

  /**
   * Manually triggers re-indexing of an article's vector embedding.
   */
  async reindex(workspaceId: string, id: string): Promise<KnowledgeArticleDto> {
    const client = this.prisma.getClient();

    const existing = await client.knowledgeArticle.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException(`Knowledge article with ID '${id}' not found`);
    }

    const updated = await client.knowledgeArticle.update({
      where: {
        workspaceId_id: {
          workspaceId,
          id,
        },
      },
      data: {
        embeddingStatus: KnowledgeEmbeddingStatus.PENDING,
        embeddingError: null,
      },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        content: true,
        category: true,
        embeddingStatus: true,
        embeddingError: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.enqueueEmbedding(workspaceId, id);

    return updated as KnowledgeArticleDto;
  }

  /**
   * Performs semantic vector similarity search using PostgreSQL pgvector.
   * Only matches active articles with READY embeddings.
   */
  async searchSimilar(
    workspaceId: string,
    query: string,
    minSimilarity = DEFAULT_SIMILARITY_THRESHOLD,
    limit = DEFAULT_TOP_K,
  ): Promise<TestSearchResultDto[]> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
      return [];
    }

    const client = this.prisma.getClient();

    // 1. Generate query embedding
    const queryVector = await this.embeddingService.generateEmbedding(workspaceId, trimmedQuery);
    const vectorString = JSON.stringify(queryVector);

    // 2. Query pgvector using cosine distance <=> operator:
    // similarity = 1 - (embedding <=> query_vector)
    const results: Array<{
      id: string;
      title: string;
      content: string;
      category: string | null;
      similarity: number | string;
    }> = await client.$queryRawUnsafe(
      `SELECT 
        "id", "title", "content", "category",
        (1 - ("embedding" <=> $1::vector)) AS "similarity"
      FROM "KnowledgeArticle"
      WHERE "workspaceId" = $2
        AND "isActive" = true
        AND "embeddingStatus" = '${KnowledgeEmbeddingStatus.READY}'
        AND "embedding" IS NOT NULL
        AND (1 - ("embedding" <=> $1::vector)) >= $3
      ORDER BY "embedding" <=> $1::vector ASC
      LIMIT $4;`,
      vectorString,
      workspaceId,
      minSimilarity,
      limit,
    );

    return results.map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      category: row.category,
      similarity: Number(row.similarity),
    }));
  }
}
