import { createSearchKnowledgeTool } from '../search-knowledge.tool';

describe('searchKnowledge Tool', () => {
  const workspaceId = 'ws-test-123';
  let mockKnowledgeService: any;
  let tool: any;

  beforeEach(() => {
    mockKnowledgeService = {
      searchSimilar: jest.fn().mockImplementation(async (wsId: string, query: string) => {
        if (wsId !== workspaceId) return [];
        if (query.includes('đổi trả')) {
          return [
            {
              id: 'art-1',
              title: 'Chính sách đổi trả',
              category: 'policy',
              content:
                'Shop hỗ trợ đổi size hoặc sản phẩm lỗi trong vòng 7 ngày kể từ khi nhận hàng.',
              similarity: 0.854,
            },
          ];
        }
        return [];
      }),
    };

    tool = createSearchKnowledgeTool({
      workspaceId,
      knowledgeService: mockKnowledgeService,
    });
  });

  it('should return empty message when query is whitespace', async () => {
    const result = await tool.execute({ query: '   ' }, {} as any);
    expect(result.found).toBe(false);
    expect(result.articles).toEqual([]);
  });

  it('should return matched articles when similarity search succeeds', async () => {
    const result = await tool.execute({ query: 'Shop có hỗ trợ đổi trả áo không?' }, {} as any);
    expect(result.found).toBe(true);
    expect(result.count).toBe(1);
    expect(result.articles.length).toBe(1);
    expect(result.articles[0].id).toBe('art-1');
    expect(result.articles[0].title).toBe('Chính sách đổi trả');
    expect(result.articles[0].similarity).toBe(0.85);
  });

  it('should return found=false when no articles match the query', async () => {
    const result = await tool.execute({ query: 'Chính sách sửa xe máy' }, {} as any);
    expect(result.found).toBe(false);
    expect(result.articles).toEqual([]);
    expect(result.message).toContain('Không tìm thấy thông tin phù hợp');
  });

  it('should handle service errors gracefully without throwing', async () => {
    mockKnowledgeService.searchSimilar = jest
      .fn()
      .mockRejectedValue(new Error('pgvector database connection timeout'));

    const result = await tool.execute({ query: 'Có chính sách đổi trả không?' }, {} as any);
    expect(result.found).toBe(false);
    expect(result.error).toBe('SEARCH_KNOWLEDGE_FAILED');
    expect(result.message).toBe('pgvector database connection timeout');
  });
});
