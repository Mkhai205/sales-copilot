import { BadRequestException, NotFoundException } from '@nestjs/common';
import { KnowledgeService } from '../knowledge.service';
import { MAX_ARTICLES_PER_WORKSPACE } from '../knowledge.constants';

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let mockPrismaService: any;
  let mockEmbeddingService: any;
  let mockQueue: any;
  let enqueuedJobs: any[];
  let articlesDb: Map<string, any>;

  const workspaceId = 'ws-test-123';
  const otherWorkspaceId = 'ws-other-456';

  beforeEach(() => {
    articlesDb = new Map();
    enqueuedJobs = [];

    mockQueue = {
      add: jest.fn().mockImplementation(async (name, data, opts) => {
        enqueuedJobs.push({ name, data, opts });
        return { id: 'job-123' };
      }),
    };

    mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.01)),
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

        findMany: jest.fn().mockImplementation(async ({ where, skip = 0, take = 20 }) => {
          const list = Array.from(articlesDb.values()).filter(item => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.category && item.category !== where.category) return false;
            if (where?.embeddingStatus && item.embeddingStatus !== where.embeddingStatus)
              return false;
            if (where?.isActive !== undefined && item.isActive !== where.isActive) return false;
            if (where?.OR && Array.isArray(where.OR)) {
              const matches = where.OR.some((cond: any) => {
                if (cond.title?.contains) {
                  return item.title.toLowerCase().includes(cond.title.contains.toLowerCase());
                }
                if (cond.content?.contains) {
                  return item.content.toLowerCase().includes(cond.content.contains.toLowerCase());
                }
                return false;
              });
              if (!matches) return false;
            }
            return true;
          });
          return list.slice(skip, skip + take);
        }),

        count: jest.fn().mockImplementation(async ({ where }) => {
          return Array.from(articlesDb.values()).filter(item => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            return true;
          }).length;
        }),

        create: jest.fn().mockImplementation(async ({ data }) => {
          const id = `art-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          const article = {
            id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          articlesDb.set(id, article);
          return { ...article };
        }),

        update: jest.fn().mockImplementation(async ({ where, data }) => {
          const id = where.workspaceId_id?.id || where.id;
          const existing = articlesDb.get(id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          articlesDb.set(id, updated);
          return { ...updated };
        }),

        delete: jest.fn().mockImplementation(async ({ where }) => {
          const id = where.workspaceId_id?.id || where.id;
          articlesDb.delete(id);
          return { id };
        }),
      },

      $queryRawUnsafe: jest.fn().mockImplementation(async () => {
        return [
          {
            id: 'art-1',
            title: 'Chính sách đổi trả',
            content: 'Đổi trả miễn phí trong 7 ngày',
            category: 'policy',
            similarity: 0.88,
          },
        ];
      }),
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new KnowledgeService(mockPrismaService, mockEmbeddingService, mockQueue as any);
  });

  describe('list', () => {
    it('should return paginated articles scoped to workspaceId', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Chính sách bảo hành',
        content: 'Bảo hành 12 tháng',
        category: 'warranty',
        embeddingStatus: 'READY',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      articlesDb.set('art-2', {
        id: 'art-2',
        workspaceId: otherWorkspaceId,
        title: 'Chính sách shop khác',
        content: 'Không liên quan',
        category: 'policy',
        embeddingStatus: 'READY',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.list(workspaceId);
      expect(result.items.length).toBe(1);
      expect(result.items[0].id).toBe('art-1');
      expect(result.meta.total).toBe(1);
    });

    it('should filter articles by search term', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Chính sách vận chuyển',
        content: 'Giao hàng toàn quốc',
        category: 'shipping',
        embeddingStatus: 'READY',
        isActive: true,
      });

      articlesDb.set('art-2', {
        id: 'art-2',
        workspaceId,
        title: 'Hướng dẫn chọn size',
        content: 'Bảng size chi tiết',
        category: 'faq',
        embeddingStatus: 'READY',
        isActive: true,
      });

      const result = await service.list(workspaceId, { search: 'vận chuyển' });
      expect(result.items.length).toBe(1);
      expect(result.items[0].title).toBe('Chính sách vận chuyển');
    });
  });

  describe('getById', () => {
    it('should return article if it belongs to workspace', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Chính sách đổi trả',
        content: 'Đổi trả trong 7 ngày',
        category: 'policy',
        embeddingStatus: 'READY',
        isActive: true,
      });

      const article = await service.getById(workspaceId, 'art-1');
      expect(article.id).toBe('art-1');
      expect(article.title).toBe('Chính sách đổi trả');
    });

    it('should throw NotFoundException if article does not belong to workspace', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId: otherWorkspaceId,
        title: 'Shop khác',
        content: 'Content',
      });

      await expect(service.getById(workspaceId, 'art-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create article with PENDING status and enqueue embedding job', async () => {
      const dto = {
        title: 'Quy định giao hàng',
        content: 'Freeship đơn từ 500k',
        category: 'shipping',
        isActive: true,
      };

      const result = await service.create(workspaceId, dto);
      expect(result.id).toBeDefined();
      expect(result.embeddingStatus).toBe('PENDING');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'generate-embedding',
        { workspaceId, articleId: result.id },
        expect.any(Object),
      );
    });

    it('should reject creation if workspace article limit is exceeded', async () => {
      mockPrismaService.getClient().knowledgeArticle.count = jest
        .fn()
        .mockResolvedValue(MAX_ARTICLES_PER_WORKSPACE);

      await expect(
        service.create(workspaceId, {
          title: 'Article 501',
          content: 'Content',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update article and re-enqueue embedding when title/content changes', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Tiêu đề cũ',
        content: 'Nội dung cũ',
        embeddingStatus: 'READY',
        isActive: true,
      });

      const updated = await service.update(workspaceId, 'art-1', {
        title: 'Tiêu đề mới',
      });

      expect(updated.title).toBe('Tiêu đề mới');
      expect(updated.embeddingStatus).toBe('PENDING');
      expect(mockQueue.add).toHaveBeenCalled();
    });

    it('should not re-enqueue embedding if only isActive changes', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Tiêu đề giữ nguyên',
        content: 'Nội dung giữ nguyên',
        category: 'policy',
        embeddingStatus: 'READY',
        isActive: true,
      });

      const updated = await service.update(workspaceId, 'art-1', {
        isActive: false,
      });

      expect(updated.isActive).toBe(false);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if article does not exist in workspace', async () => {
      await expect(service.update(workspaceId, 'non-existent', { title: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('should delete article scoped to workspace', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'To delete',
      });

      const res = await service.delete(workspaceId, 'art-1');
      expect(res.success).toBe(true);
      expect(articlesDb.has('art-1')).toBe(false);
    });

    it('should throw NotFoundException if article not found in workspace', async () => {
      await expect(service.delete(workspaceId, 'non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reindex', () => {
    it('should reset status to PENDING and enqueue embedding job', async () => {
      articlesDb.set('art-1', {
        id: 'art-1',
        workspaceId,
        title: 'Test',
        content: 'Test content',
        embeddingStatus: 'FAILED',
        embeddingError: 'API error',
      });

      const res = await service.reindex(workspaceId, 'art-1');
      expect(res.embeddingStatus).toBe('PENDING');
      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('searchSimilar', () => {
    it('should return empty list when query is empty', async () => {
      const res = await service.searchSimilar(workspaceId, '   ');
      expect(res).toEqual([]);
      expect(mockEmbeddingService.generateEmbedding).not.toHaveBeenCalled();
    });

    it('should generate query embedding and call pgvector queryRawUnsafe', async () => {
      const res = await service.searchSimilar(workspaceId, 'Có được đổi hàng không?', 0.65, 3);
      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith(
        workspaceId,
        'Có được đổi hàng không?',
      );
      expect(res.length).toBe(1);
      expect(res[0].id).toBe('art-1');
      expect(res[0].similarity).toBe(0.88);
    });
  });
});
