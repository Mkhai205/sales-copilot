export type Nullable<T> = T | null;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? DeepPartial<U>[]
    : T[P] extends readonly (infer U)[]
      ? readonly DeepPartial<U>[]
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P];
};

export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page?: number;
  limit?: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface TenantContext {
  workspaceId: string;
}

export interface UserContext extends TenantContext {
  userId: string;
  role: string;
  email: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
}

export type TransactionIsolationLevel =
  'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

export interface TransactionOptions {
  maxWait?: number; // Maximum time to wait for acquiring connection (ms)
  timeout?: number; // Maximum transaction execution time (ms)
  isolationLevel?: TransactionIsolationLevel;
}

export type PostCommitHook = () => Promise<void> | void;
export type RollbackHook = (error: unknown) => Promise<void> | void;

export interface ITransactionContext {
  readonly id: string;
  addPostCommitHook(hook: PostCommitHook): void;
  addRollbackHook(hook: RollbackHook): void;
  getPostCommitHooks(): PostCommitHook[];
  getRollbackHooks(): RollbackHook[];
}

export const TRANSACTION_MANAGER = Symbol('TRANSACTION_MANAGER');

export interface ITransactionManager {
  runInTransaction<T>(
    operation: (ctx: ITransactionContext) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T>;
}
