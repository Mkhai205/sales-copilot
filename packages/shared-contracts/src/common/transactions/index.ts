export type TransactionIsolationLevel =
  'ReadUncommitted' | 'ReadCommitted' | 'RepeatableRead' | 'Serializable';

export interface TransactionOptions {
  maxWait?: number;
  timeout?: number;
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
