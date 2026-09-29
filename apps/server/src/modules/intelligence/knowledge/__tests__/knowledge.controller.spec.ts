import { KnowledgeController } from '../knowledge.controller';
import { WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../../../common/authz/workspace-context.type';

describe('KnowledgeController', () => {
  let controller: KnowledgeController;
  let mockKnowledgeService: any;

  const mockContext: WorkspaceContext = {
    workspaceId: 'ws-test-controller',
    role: WorkspaceRole.OWNER,
    workspace: {
      id: 'ws-test-controller',
      name: 'Test Store',
      slug: 'test-store',
    } as any,
  };

  beforeEach(() => {
    mockKnowledgeService = {
      list: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'art-1',
            workspaceId: mockContext.workspaceId,
            title: 'Chính sách đổi trả',
            content: 'Nội dung',
            category: 'policy',
            embeddingStatus: 'READY',
            isActive: true,
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      }),
      getById: jest.fn().mockResolvedValue({
        id: 'art-1',
        workspaceId: mockContext.workspaceId,
        title: 'Chính sách đổi trả',
        content: 'Nội dung',
        category: 'policy',
      }),
      create: jest.fn().mockResolvedValue({
        id: 'art-new',
        workspaceId: mockContext.workspaceId,
        title: 'Chính sách mới',
        content: 'Nội dung',
        category: 'shipping',
        embeddingStatus: 'PENDING',
        isActive: true,
      }),
      update: jest.fn().mockResolvedValue({
        id: 'art-1',
        workspaceId: mockContext.workspaceId,
        title: 'Chính sách đã sửa',
        content: 'Nội dung',
      }),
      delete: jest.fn().mockResolvedValue({ success: true }),
      reindex: jest.fn().mockResolvedValue({
        id: 'art-1',
        workspaceId: mockContext.workspaceId,
        embeddingStatus: 'PENDING',
      }),
      searchSimilar: jest.fn().mockResolvedValue([
        {
          id: 'art-1',
          title: 'Chính sách đổi trả',
          content: 'Nội dung',
          similarity: 0.82,
        },
      ]),
    };

    controller = new KnowledgeController(mockKnowledgeService);
  });

  it('should call knowledgeService.list with workspaceId and query', async () => {
    const query = { page: 1, limit: 10, search: 'đổi trả' };
    const res = await controller.list(mockContext, query);
    expect(mockKnowledgeService.list).toHaveBeenCalledWith(mockContext.workspaceId, query);
    expect(res.items.length).toBe(1);
    expect(res.meta.total).toBe(1);
  });

  it('should call knowledgeService.getById with workspaceId and article id', async () => {
    const res = await controller.getById(mockContext, 'art-1');
    expect(mockKnowledgeService.getById).toHaveBeenCalledWith(mockContext.workspaceId, 'art-1');
    expect(res.id).toBe('art-1');
  });

  it('should call knowledgeService.create with workspaceId and dto', async () => {
    const dto = {
      title: 'Chính sách mới',
      content: 'Nội dung',
      category: 'shipping',
      isActive: true,
    };
    const res = await controller.create(mockContext, dto);
    expect(mockKnowledgeService.create).toHaveBeenCalledWith(mockContext.workspaceId, dto);
    expect(res.id).toBe('art-new');
  });

  it('should call knowledgeService.update with workspaceId, id, and dto', async () => {
    const dto = { title: 'Chính sách đã sửa' };
    const res = await controller.update(mockContext, 'art-1', dto);
    expect(mockKnowledgeService.update).toHaveBeenCalledWith(mockContext.workspaceId, 'art-1', dto);
    expect(res.title).toBe('Chính sách đã sửa');
  });

  it('should call knowledgeService.delete with workspaceId and id', async () => {
    const res = await controller.delete(mockContext, 'art-1');
    expect(mockKnowledgeService.delete).toHaveBeenCalledWith(mockContext.workspaceId, 'art-1');
    expect(res.success).toBe(true);
  });

  it('should call knowledgeService.reindex with workspaceId and id', async () => {
    const res = await controller.reindex(mockContext, 'art-1');
    expect(mockKnowledgeService.reindex).toHaveBeenCalledWith(mockContext.workspaceId, 'art-1');
    expect(res.embeddingStatus).toBe('PENDING');
  });

  it('should call knowledgeService.searchSimilar on testSearch', async () => {
    const dto = { query: 'Đổi trả thế nào?', minSimilarity: 0.7, limit: 5 };
    const res = await controller.testSearch(mockContext, dto);
    expect(mockKnowledgeService.searchSimilar).toHaveBeenCalledWith(
      mockContext.workspaceId,
      'Đổi trả thế nào?',
      0.7,
      5,
    );
    expect(res.length).toBe(1);
    expect(res[0].similarity).toBe(0.82);
  });
});
