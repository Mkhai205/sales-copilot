import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  listReconciliationTransactionsQuerySchema,
  reconciliationStatsQuerySchema,
  manualMatchTransactionSchema,
  type ListReconciliationTransactionsQueryOutput,
  type ReconciliationStatsQueryOutput,
  type ManualMatchTransactionDto,
  type PaymentTransactionResponseDto,
  type ReconciliationStatsResponseDto,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../../common/pipes/zod-schema-validation.pipe';
import { CurrentUser } from '../../identity/auth/decorators/current-user.decorator';
import type { JwtUserPayload } from '../../identity/auth/types/jwt-payload.type';
import { CurrentWorkspace } from '../../identity/workspaces/decorators/current-workspace.decorator';
import { Roles } from '../../identity/workspaces/decorators/roles.decorator';
import { RolesGuard } from '../../identity/workspaces/guards/roles.guard';
import { WorkspaceGuard } from '../../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../identity/workspaces/types/workspace-context.type';
import { ManualMatchService } from './manual-match.service';
import { ReconciliationQueryService } from './reconciliation-query.service';

@ApiTags('Commerce Bank Reconciliation')
@Controller('reconciliation')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class ReconciliationController {
  constructor(
    private readonly reconciliationQueryService: ReconciliationQueryService,
    private readonly manualMatchService: ManualMatchService,
  ) {}

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'List and filter bank payment transactions in workspace' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  async listTransactions(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listReconciliationTransactionsQuerySchema)
    query: ListReconciliationTransactionsQueryOutput,
  ): Promise<{ items: PaymentTransactionResponseDto[]; meta: PaginationMeta }> {
    return this.reconciliationQueryService.listTransactions(context.workspaceId, query);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Get summary statistics of bank reconciliation transactions' })
  @ApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  async getStats(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(reconciliationStatsQuerySchema) query: ReconciliationStatsQueryOutput,
  ): Promise<ReconciliationStatsResponseDto> {
    return this.reconciliationQueryService.getStats(context.workspaceId, query);
  }

  @Post('transactions/:id/manual-match')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Manually match a PENDING bank transaction to an order' })
  @ApiResponse({ status: 200, description: 'Transaction matched successfully' })
  async manualMatch(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') transactionId: string,
    @ZodBody(manualMatchTransactionSchema) dto: ManualMatchTransactionDto,
  ): Promise<{ success: boolean; transaction: PaymentTransactionResponseDto; order: any }> {
    return this.manualMatchService.manualMatchTransaction(
      context.workspaceId,
      transactionId,
      dto,
      user.userId,
    );
  }
}
