import { expectReject } from '../../../../../test/test-assertions';
import { AiAgentService } from '../ai-agent.service';

describe('AiAgentService', () => {
  let service: AiAgentService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockContextBuilder: any;
  let workspacesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;

  const workspaceId = 'ws-agent-1';

  beforeEach(() => {
    workspacesDb = new Map();
    conversationsDb = new Map();

    mockPrisma = {
      getClient: () => ({
        workspace: {
          findUnique: async ({ where }: any) => workspacesDb.get(where.id) || null,
        },
        conversation: {
          findFirst: async ({ where }: any) => conversationsDb.get(where.id) || null,
          updateMany: async ({ where, data }: any) => {
            const conv = conversationsDb.get(where.id);
            if (conv) Object.assign(conv, data);
            return { count: conv ? 1 : 0 };
          },
        },
      }),
    };

    mockConfig = {
      get: (key: string) => {
        if (key === 'GEMINI_API_KEY') return 'env-gemini-key-123';
        return undefined;
      },
    };

    mockContextBuilder = {
      build: async () => ({
        systemPrompt: 'System test',
        messages: [{ role: 'user', content: 'Hello' }],
        aiPolicy: { enabled: true },
      }),
    };

    service = new AiAgentService(mockPrisma, mockConfig, mockContextBuilder);
  });

  it('should resolve workspace BYOK key over env key when configured', async () => {
    workspacesDb.set(workspaceId, {
      id: workspaceId,
      settings: {
        llmCredentials: {
          geminiApiKey: 'byok-key-xyz',
        },
      },
    });

    const key = await service.resolveApiKey(workspaceId);
    expect(key).toBe('byok-key-xyz');
  });

  it('should fallback to env GEMINI_API_KEY when BYOK is not configured', async () => {
    workspacesDb.set(workspaceId, {
      id: workspaceId,
      settings: {},
    });

    const key = await service.resolveApiKey(workspaceId);
    expect(key).toBe('env-gemini-key-123');
  });

  it('should throw Error when neither BYOK nor env key is available', async () => {
    workspacesDb.set(workspaceId, {
      id: workspaceId,
      settings: {},
    });
    mockConfig.get = () => undefined;

    await expectReject(
      async () => service.resolveApiKey(workspaceId),
      /No Gemini API key available/,
    );
  });
});
