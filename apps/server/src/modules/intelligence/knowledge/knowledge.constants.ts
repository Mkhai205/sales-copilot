export const KNOWLEDGE_QUEUE_NAME = 'knowledge-embedding';
export const EMBEDDING_MODEL = 'text-embedding-004';
export const DEFAULT_SIMILARITY_THRESHOLD = 0.65;
export const DEFAULT_TOP_K = 3;
export const MAX_ARTICLES_PER_WORKSPACE = 500;

export interface KnowledgeEmbeddingJobData {
  articleId: string;
  workspaceId: string;
}
