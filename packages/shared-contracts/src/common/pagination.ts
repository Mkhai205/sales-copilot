import { z } from 'zod';

export const paginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationParams = z.infer<typeof paginationParamsSchema>;

export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  nextCursor?: string;
  [key: string]: unknown;
}
