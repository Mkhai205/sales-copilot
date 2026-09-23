import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { embed, type EmbeddingModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { PrismaService } from '../../../infrastructure/database';
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

    // 2. Google Cloud Vertex AI (uses organization GCP credits)
    const vertexCredentials =
      this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const vertexProject =
      this.configService.get<string>('GOOGLE_VERTEX_PROJECT') || process.env.GOOGLE_VERTEX_PROJECT;
    const vertexLocation =
      this.configService.get<string>('GOOGLE_VERTEX_LOCATION') ||
      process.env.GOOGLE_VERTEX_LOCATION ||
      'us-central1';

    if (vertexCredentials && vertexProject) {
      this.logger.debug(
        `Using Google Cloud Vertex AI for embedding in workspace '${workspaceId}' (project: ${vertexProject}, region: ${vertexLocation})`,
      );
      const vertex = createVertex({
        project: vertexProject,
        location: vertexLocation,
      });
      return vertex.textEmbeddingModel(EMBEDDING_MODEL);
    }

    // 3. Platform default Google AI Studio API key
    const envKey = this.configService.get<string>('GEMINI_API_KEY');
    if (envKey && envKey.trim()) {
      this.logger.debug(
        `Using Google AI Studio default for embedding in workspace '${workspaceId}'`,
      );
      const google = createGoogleGenerativeAI({ apiKey: envKey.trim() });
      return google.textEmbeddingModel(EMBEDDING_MODEL);
    }

    throw new Error(
      `No AI provider available for embedding in workspace '${workspaceId}'. Please configure Google Cloud Vertex AI or GEMINI_API_KEY.`,
    );
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
