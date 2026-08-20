import { randomUUID } from 'crypto';
import { Prisma } from '../generated/client';
import { ITransactionContext, PostCommitHook, RollbackHook } from '@sales-copilot/shared-contracts';

export class PrismaTransactionContext implements ITransactionContext {
  public readonly id: string;
  private readonly postCommitHooks: PostCommitHook[] = [];
  private readonly rollbackHooks: RollbackHook[] = [];

  constructor(
    public readonly txClient: Prisma.TransactionClient,
    id?: string,
  ) {
    this.id = id || `tx_${randomUUID()}`;
  }

  public addPostCommitHook(hook: PostCommitHook): void {
    this.postCommitHooks.push(hook);
  }

  public addRollbackHook(hook: RollbackHook): void {
    this.rollbackHooks.push(hook);
  }

  public getPostCommitHooks(): PostCommitHook[] {
    return [...this.postCommitHooks];
  }

  public getRollbackHooks(): RollbackHook[] {
    return [...this.rollbackHooks];
  }
}
