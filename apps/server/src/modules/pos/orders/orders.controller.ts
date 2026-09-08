import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  cancelOrderSchema,
  createOrderSchema,
  updateOrderSchema,
  listOrdersQuerySchema,
  manualPayOrderSchema,
  type CancelOrderDto,
  type CreateOrderDto,
  type UpdateOrderDto,
  type ListOrdersQueryOutput,
  type ManualPayOrderDto,
  type OrderResponseDto,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../../common/pipes';
import { CurrentUser, type JwtUserPayload } from '../../auth';
import { CurrentWorkspace, Roles } from '../../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../workspaces/guards';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import { OrdersService } from './orders.service';

@ApiTags('POS Orders')
@Controller(['workspaces/:workspaceId/orders', 'orders'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List and filter orders in workspace' })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async listOrders(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(listOrdersQuerySchema) query: ListOrdersQueryOutput,
  ): Promise<{ items: OrderResponseDto[]; meta: PaginationMeta }> {
    return this.ordersService.listOrders(context.workspaceId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get order details by ID' })
  @ApiResponse({ status: 200, description: 'Order details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.getOrderById(context.workspaceId, id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Create a new order draft' })
  @ApiResponse({ status: 201, description: 'Order draft created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'Contact or item not found' })
  async createOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(createOrderSchema) dto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.createOrder(context.workspaceId, dto, user?.userId);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Update draft order' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed or order not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async updateOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @ZodBody(updateOrderSchema) dto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.updateOrder(context.workspaceId, id, dto, user?.userId);
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({
    summary: 'Confirm order and atomically reserve stock (Anti-Overselling Model A)',
  })
  @ApiResponse({ status: 200, description: 'Order confirmed and inventory reserved' })
  @ApiResponse({ status: 400, description: 'Order not in DRAFT status or empty' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Insufficient available stock' })
  async confirmOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    return this.ordersService.confirmOrder(context.workspaceId, id, user?.userId);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Record manual payment and commit inventory sale' })
  @ApiResponse({ status: 200, description: 'Payment recorded successfully' })
  @ApiResponse({ status: 400, description: 'Order not in payable status' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async payOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @ZodBody(manualPayOrderSchema) dto: ManualPayOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.payOrder(context.workspaceId, id, dto, user?.userId);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Cancel order and release reserved stock' })
  @ApiResponse({ status: 200, description: 'Order cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({ status: 409, description: 'Order not in cancellable state' })
  async cancelOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @ZodBody(cancelOrderSchema) dto: CancelOrderDto,
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(context.workspaceId, id, dto, user?.userId);
  }
}
