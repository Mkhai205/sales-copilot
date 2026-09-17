import type { PaginationMeta } from './pagination';
import type { ApiErrorResponse } from './errors';

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
