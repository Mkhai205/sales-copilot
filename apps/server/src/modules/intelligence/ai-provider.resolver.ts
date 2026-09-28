import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';

export type ResolvedGoogleAiProvider =
  ReturnType<typeof createGoogleGenerativeAI> | ReturnType<typeof createVertex>;

/**
 * Resolves the platform-level Google AI provider shared by the chat agent and the
 * knowledge embedding service:
 * 1. Google Cloud Vertex AI — organization GCP credits (GOOGLE_APPLICATION_CREDENTIALS
 *    + GOOGLE_VERTEX_PROJECT).
 * 2. Google AI Studio — platform GEMINI_API_KEY.
 *
 * Throws when neither is configured. Per-workspace BYOK keys are resolved by the callers
 * (from workspace settings) BEFORE falling back to this resolver.
 */
export function resolvePlatformGoogleAiProvider(
  configService: ConfigService,
  logger: Logger,
  contextLabel: string,
): ResolvedGoogleAiProvider {
  const vertexCredentials =
    configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS') ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const vertexProject =
    configService.get<string>('GOOGLE_VERTEX_PROJECT') || process.env.GOOGLE_VERTEX_PROJECT;
  const vertexLocation =
    configService.get<string>('GOOGLE_VERTEX_LOCATION') ||
    process.env.GOOGLE_VERTEX_LOCATION ||
    'us-central1';

  if (vertexCredentials && vertexProject) {
    logger.debug(
      `Using Google Cloud Vertex AI ${contextLabel} (project: ${vertexProject}, region: ${vertexLocation})`,
    );
    return createVertex({ project: vertexProject, location: vertexLocation });
  }

  const envKey = configService.get<string>('GEMINI_API_KEY');
  if (envKey && envKey.trim()) {
    logger.debug(`Using Google AI Studio default ${contextLabel}`);
    return createGoogleGenerativeAI({ apiKey: envKey.trim() });
  }

  throw new Error(
    `No AI provider available ${contextLabel}. Please configure Google Cloud Vertex AI or GEMINI_API_KEY.`,
  );
}
