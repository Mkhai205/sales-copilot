import { z } from 'zod';

export const KNOWLEDGE_CATEGORIES = [
  'policy',
  'faq',
  'shipping',
  'warranty',
  'promotion',
  'other',
] as const;

export const knowledgeCategorySchema = z.enum(KNOWLEDGE_CATEGORIES);
export type KnowledgeCategory = z.infer<typeof knowledgeCategorySchema>;

export const KnowledgeEmbeddingStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;

export type KnowledgeEmbeddingStatus =
  (typeof KnowledgeEmbeddingStatus)[keyof typeof KnowledgeEmbeddingStatus];

export const knowledgeEmbeddingStatusSchema = z.nativeEnum(KnowledgeEmbeddingStatus);

export const createKnowledgeArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(255, 'Tiêu đề không quá 255 ký tự'),
  content: z
    .string()
    .trim()
    .min(1, 'Nội dung không được để trống')
    .max(10000, 'Nội dung không quá 10,000 ký tự'),
  category: z.string().trim().optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateKnowledgeArticleDto = z.input<typeof createKnowledgeArticleSchema>;

export const updateKnowledgeArticleSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Tiêu đề không được để trống')
    .max(255, 'Tiêu đề không quá 255 ký tự')
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, 'Nội dung không được để trống')
    .max(10000, 'Nội dung không quá 10,000 ký tự')
    .optional(),
  category: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateKnowledgeArticleDto = z.input<typeof updateKnowledgeArticleSchema>;

export const knowledgeArticleQuerySchema = z.object({
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  status: knowledgeEmbeddingStatusSchema.optional(),
  isActive: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return undefined;
  }, z.boolean().optional()),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type KnowledgeArticleQueryDto = z.input<typeof knowledgeArticleQuerySchema>;
export type KnowledgeArticleQueryOutput = z.infer<typeof knowledgeArticleQuerySchema>;

export const knowledgeArticleDtoSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string().nullable().optional(),
  embeddingStatus: knowledgeEmbeddingStatusSchema,
  embeddingError: z.string().nullable().optional(),
  isActive: z.boolean(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export type KnowledgeArticleDto = z.infer<typeof knowledgeArticleDtoSchema>;

export interface KnowledgeArticleListResponseDto {
  items: KnowledgeArticleDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const testSearchKnowledgeSchema = z.object({
  query: z.string().trim().min(1, 'Nội dung tìm kiếm không được để trống'),
  minSimilarity: z.coerce.number().min(0).max(1).optional().default(0.65),
  limit: z.coerce.number().int().min(1).max(20).optional().default(3),
});

export type TestSearchKnowledgeDto = z.input<typeof testSearchKnowledgeSchema>;
export type TestSearchKnowledgeOutput = z.infer<typeof testSearchKnowledgeSchema>;

export const testSearchResultDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  category: z.string().nullable().optional(),
  similarity: z.number(),
});

export type TestSearchResultDto = z.infer<typeof testSearchResultDtoSchema>;
