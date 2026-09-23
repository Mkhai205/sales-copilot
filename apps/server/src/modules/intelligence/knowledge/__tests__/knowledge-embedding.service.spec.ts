import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import {
  KnowledgeEmbeddingService,
  formatKnowledgeForEmbedding,
} from '../knowledge-embedding.service';
import { EMBEDDING_MODEL } from '../knowledge.constants';

// Mock AI SDK modules
jest.mock('ai', () => ({
  embed: jest.fn().mockResolvedValue({
    embedding: new Array(768).fill(0.01),
  }),
}));

const mockTextEmbeddingModel = jest.fn().mockReturnValue({ modelId: 'mock-embedding-model' });

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn().mockReturnValue({
    textEmbeddingModel: (...args: any[]) => mockTextEmbeddingModel(...args),
  }),
}));

jest.mock('@ai-sdk/google-vertex', () => ({
  createVertex: jest.fn().mockReturnValue({
    textEmbeddingModel: (...args: any[]) => mockTextEmbeddingModel(...args),
  }),
}));

describe('KnowledgeEmbeddingService', () => {
  let service: KnowledgeEmbeddingService;
  let mockPrismaService: any;
  let mockConfigService: any;
  let workspaceDb: Map<string, any>;
  const originalEnv = { ...process.env };

  const workspaceId = 'ws-test-embeddings';

  beforeEach(() => {
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_VERTEX_PROJECT;
    delete process.env.GOOGLE_VERTEX_LOCATION;
    delete process.env.GEMINI_API_KEY;

    workspaceDb = new Map();
    jest.clearAllMocks();

    const clientMock = {
      workspace: {
        findUnique: jest.fn().mockImplementation(async ({ where }) => {
          return workspaceDb.get(where.id) || null;
        }),
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'platform-gemini-key';
        return undefined;
      }),
    };

    service = new KnowledgeEmbeddingService(mockPrismaService, mockConfigService);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('formatKnowledgeForEmbedding', () => {
    it('should format title, content, and category correctly', () => {
      const formatted = formatKnowledgeForEmbedding(
        'Chính sách đổi trả',
        'Đổi hàng trong vòng 7 ngày nếu còn nguyên tem mác.',
        'policy',
      );
      expect(formatted).toBe(
        'Danh mục: policy\nTiêu đề: Chính sách đổi trả\nNội dung: Đổi hàng trong vòng 7 ngày nếu còn nguyên tem mác.',
      );
    });

    it('should format title and content when category is null or empty', () => {
      const formatted = formatKnowledgeForEmbedding(
        'Thời gian làm việc',
        'Từ 8h đến 22h hàng ngày.',
        null,
      );
      expect(formatted).toBe('Tiêu đề: Thời gian làm việc\nNội dung: Từ 8h đến 22h hàng ngày.');
    });
  });

  describe('resolveEmbeddingModel', () => {
    it('should prioritize Workspace BYOK key when configured in workspace settings', async () => {
      workspaceDb.set(workspaceId, {
        id: workspaceId,
        settings: {
          llmCredentials: {
            geminiApiKey: 'byok-custom-key-12345',
          },
        },
      });

      const model = await service.resolveEmbeddingModel(workspaceId);
      expect(model).toBeDefined();

      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'byok-custom-key-12345' });
      expect(mockTextEmbeddingModel).toHaveBeenCalledWith(EMBEDDING_MODEL);
    });

    it('should use Google Cloud Vertex AI if Vertex credentials exist and no BYOK', async () => {
      workspaceDb.set(workspaceId, {
        id: workspaceId,
        settings: {},
      });

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GOOGLE_APPLICATION_CREDENTIALS') return '/path/to/creds.json';
        if (key === 'GOOGLE_VERTEX_PROJECT') return 'my-gcp-project';
        if (key === 'GOOGLE_VERTEX_LOCATION') return 'asia-southeast1';
        return undefined;
      });

      const model = await service.resolveEmbeddingModel(workspaceId);
      expect(model).toBeDefined();

      expect(createVertex).toHaveBeenCalledWith({
        project: 'my-gcp-project',
        location: 'asia-southeast1',
      });
      expect(mockTextEmbeddingModel).toHaveBeenCalledWith(EMBEDDING_MODEL);
    });

    it('should fallback to platform GEMINI_API_KEY when no BYOK or Vertex', async () => {
      workspaceDb.set(workspaceId, {
        id: workspaceId,
        settings: {},
      });

      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'GEMINI_API_KEY') return 'default-env-gemini-key';
        return undefined;
      });

      const model = await service.resolveEmbeddingModel(workspaceId);
      expect(model).toBeDefined();

      expect(createGoogleGenerativeAI).toHaveBeenCalledWith({ apiKey: 'default-env-gemini-key' });
    });

    it('should throw error when no provider credentials are configured', async () => {
      workspaceDb.set(workspaceId, {
        id: workspaceId,
        settings: {},
      });

      mockConfigService.get.mockReturnValue(undefined);

      await expect(service.resolveEmbeddingModel(workspaceId)).rejects.toThrow(
        /No AI provider available for embedding in workspace/,
      );
    });
  });

  describe('generateEmbedding', () => {
    it('should generate 768-dim float vector for text', async () => {
      workspaceDb.set(workspaceId, {
        id: workspaceId,
        settings: {},
      });

      const vector = await service.generateEmbedding(workspaceId, 'Câu hỏi tra cứu');
      expect(vector).toBeDefined();
      expect(vector.length).toBe(768);
    });
  });
});
