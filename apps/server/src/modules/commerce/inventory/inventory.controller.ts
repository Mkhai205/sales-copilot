import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  adjustInventorySchema,
  listInventoryTransactionsQuerySchema,
  listInventoryVariantsQuerySchema,
  type AdjustInventoryDto,
  type InventoryTransactionResponseDto,
  type InventoryVariantItemDto,
  type ListInventoryTransactionsQueryOutput,
  type ListInventoryVariantsQueryOutput,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../../common/pipes/zod-schema-validation.pipe';
import { CurrentUser } from '../../../common/authz/current-user.decorator';
import type { JwtUserPayload } from '../../../common/authz/jwt-payload.type';
import { CurrentWorkspace } from '../../../common/authz/current-workspace.decorator';
import { Roles } from '../../../common/authz/roles.decorator';
import { RolesGuard } from '../../../common/authz/roles.guard';
import { WorkspaceGuard } from '../../identity/workspaces/guards/workspace.guard';
import type { WorkspaceContext } from '../../../common/authz/workspace-context.type';
import { InventoryQueryService } from './inventory-query.service';
import { StockMovementService } from './stock-movement.service';

@ApiTags('Commerce Inventory')
@Controller('inventory')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class InventoryController {
  constructor(
    private readonly inventoryQueryService: InventoryQueryService,
    private readonly stockMovementService: StockMovementService,
  ) {}

  @Get('transactions')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({
    summary: 'List immutable inventory ledger transactions with filtering and pagination',
  })
  @ApiResponse({ status: 200, description: 'Inventory transactions retrieved successfully' })
  async listTransactions(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listInventoryTransactionsQuerySchema) query: ListInventoryTransactionsQueryOutput,
  ): Promise<{ items: InventoryTransactionResponseDto[]; meta: PaginationMeta }> {
    return this.inventoryQueryService.listTransactions(context.workspaceId, query);
  }

  @Get('variants')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({
    summary: 'List flat inventory variants for warehouse operations with stock levels',
  })
  @ApiResponse({ status: 200, description: 'Inventory variants retrieved successfully' })
  async listVariants(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listInventoryVariantsQuerySchema) query: ListInventoryVariantsQueryOutput,
  ): Promise<{ items: InventoryVariantItemDto[]; meta: PaginationMeta }> {
    return this.inventoryQueryService.listInventoryVariants(context.workspaceId, query);
  }

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Get workspace inventory summary metrics and KPI cards' })
  @ApiResponse({ status: 200, description: 'Inventory summary retrieved successfully' })
  async getSummary(@CurrentWorkspace() context: WorkspaceContext) {
    return this.inventoryQueryService.getInventorySummary(context.workspaceId);
  }

  @Post('variants/:variantId/adjust')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({
    summary: 'Manual inventory adjustment (STOCK_IN, STOCK_OUT, INVENTORY_AUDIT) for a variant',
  })
  @ApiResponse({ status: 200, description: 'Inventory adjusted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot reduce below reserved stock' })
  @ApiResponse({ status: 404, description: 'Product variant not found' })
  async adjustStock(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('variantId') variantId: string,
    @ZodBody(adjustInventorySchema) dto: AdjustInventoryDto,
  ): Promise<InventoryTransactionResponseDto> {
    return this.stockMovementService.adjustStock({
      workspaceId: context.workspaceId,
      variantId,
      dto,
      userId: user?.userId,
    });
  }
}
