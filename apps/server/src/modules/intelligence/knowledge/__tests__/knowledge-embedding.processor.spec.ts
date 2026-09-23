import { KnowledgeEmbeddingProcessor } from '../knowledge-embedding.processor';

describe('KnowledgeEmbeddingProcessor', () => {
  let processor: KnowledgeEmbeddingProcessor;
  let mockPrismaService: any;
  let mockEmbeddingService: any;
  let articlesDb: Map<string, any>;
  let executeRawCalls: Array<{ sql: string; params: any[] }>;

  const workspaceId = 'ws-test-123';
  const articleId = 'art-123';

  beforeEach(() => {
    articlesDb = new Map();
    executeRawCalls = [];

    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.05)),
    };

    const clientMock = {
      knowledgeArticle: {
        findFirst: jest.fn().mockImplementation(async ({ where }) => {
          for (const item of articlesDb.values()) {
            if (where.id && item.id !== where.id) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            return { ...item };
          }
          return null;
        }),

        updateMany: jest.fn().mockImplementation(async ({ where, data }) => {
          const item = articlesDb.get(where.id);
          if (item && item.workspaceId === where.workspaceId) {
            Object.assign(item, data);
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },

      $executeRawUnsafe: jest.fn().mockImplementation(async (sql, ...params) => {
        executeRawCalls.push({ sql, params });
        const item = articlesDb.get(params[1]);
        if (item) {
          item.embeddingStatus = 'READY';
          item.embeddingError = null;
        }
        return 1;
      }),
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    processor = new KnowledgeEmbeddingProcessor(mockPrismaService, mockEmbeddingService);
  });

  it('should skip job if article is not found in the workspace', async () => {
    const job: any = {
      id: 'job-1',
      data: { articleId: 'non-existent', workspaceId },
    };

    const res = await processor.process(job);
    expect(res.success).toBe(false);
    expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
  });

  it('should generate embedding and update article vector column to READY', async () => {
    articlesDb.set(articleId, {
      id: articleId,
      workspaceId,
      title: 'Chính sách đổi trả',
      content: 'Đổi trả trong vòng 7 ngày',
      category: 'policy',
      embeddingStatus: 'PENDING',
    });

    const job: any = {
      id: 'job-1',
      data: { articleId, workspaceId },
    };

    const res = await processor.process(job);
    expect(res.success).toBe(true);

    // Verify embedding service called with formatted text
    expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
      workspaceId,
      expect.stringContaining('Tiêu đề: Chính sách đổi trả'),
    );

    // Verify raw query executed to set pgvector
    expect(executeRawCalls.length).toBe(1);
    expect(executeRawCalls[0].sql).toContain('SET "embedding" = $1::vector');
    expect(executeRawCalls[0].params[1]).toBe(articleId);
    expect(executeRawCalls[0].params[2]).toBe(workspaceId);

    const updated = articlesDb.get(articleId);
    expect(updated.embeddingStatus).toBe('READY');
  });

  it('should set embeddingStatus to FAILED and rethrow error on embedding failure', async () => {
    articlesDb.set(articleId, {
      id: articleId,
      workspaceId,
      title: 'Chính sách',
      content: 'Nội dung',
      embeddingStatus: 'PENDING',
    });

    mockEmbeddingService.generateEmbedding.mockRejectedValue(
      new Error('Gemini API quota exceeded'),
    );

    const job: any = {
      id: 'job-1',
      data: { articleId, workspaceId },
    };

    await expect(processor.process(job)).rejects.toThrow('Gemini API quota exceeded');

    const updated = articlesDb.get(articleId);
    expect(updated.embeddingStatus).toBe('FAILED');
    expect(updated.embeddingError).toBe('Gemini API quota exceeded');
  });
});
