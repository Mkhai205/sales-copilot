import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embed, type EmbeddingModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { resolvePlatformGoogleAiProvider } from '../ai-provider.resolver';
import { EMBEDDING_MODEL } from './knowledge.constants';

export function formatKnowledgeForEmbedding(
  title: string,
  content: string,
  category?: string | null,
): string {
  const parts: string[] = [];
  if (category && category.trim()) {
    parts.push(`Danh mục: ${category.trim()}`);
  }
  parts.push(`Tiêu đề: ${title.trim()}`);
  parts.push(`Nội dung: ${content.trim()}`);
  return parts.join('\n');
}

@Injectable()
export class KnowledgeEmbeddingService {
  private readonly logger = new Logger(KnowledgeEmbeddingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Resolves EmbeddingModel instance:
   * 1. Per-workspace BYOK (workspace.settings.llmCredentials.geminiApiKey) -> @ai-sdk/google
   * 2. Google Cloud Vertex AI (GOOGLE_APPLICATION_CREDENTIALS) -> @ai-sdk/google-vertex
   * 3. Platform default from GEMINI_API_KEY env -> @ai-sdk/google
   */
  async resolveEmbeddingModel(workspaceId: string): Promise<EmbeddingModel> {
    const client = this.prisma.getClient();
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true },
    });

    const settings = (workspace?.settings as Record<string, unknown>) || {};
    const llmCreds = (settings.llmCredentials as Record<string, unknown>) || {};
    const byokKey = llmCreds.geminiApiKey as string | undefined;

    // 1. Per-workspace BYOK key takes highest precedence for multi-tenant customization
    if (byokKey && byokKey.trim()) {
      this.logger.debug(`Using Workspace BYOK key for embedding in workspace '${workspaceId}'`);
      const google = createGoogleGenerativeAI({ apiKey: byokKey.trim() });
      return google.textEmbeddingModel(EMBEDDING_MODEL);
    }

    // 2. Platform default provider (Vertex AI credits or GEMINI_API_KEY)
    const provider = resolvePlatformGoogleAiProvider(
      this.configService,
      this.logger,
      `for embedding in workspace '${workspaceId}'`,
    );
    return provider.textEmbeddingModel(EMBEDDING_MODEL);
  }

  /**
   * Generates a 768-dimensional float vector for text.
   */
  async generateEmbedding(workspaceId: string, text: string): Promise<number[]> {
    const model = await this.resolveEmbeddingModel(workspaceId);
    const { embedding } = await embed({
      model,
      value: text,
    });
    return embedding;
  }
}
