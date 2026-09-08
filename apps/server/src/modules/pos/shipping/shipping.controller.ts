import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  WorkspaceRole,
  carrierRateQuoteSchema,
  dispatchOrderSchema,
  type CarrierQuoteResultDto,
  type CarrierRateQuoteDto,
  type DispatchOrderDto,
  type OrderResponseDto,
  type TrackingStatusDto,
} from '@sales-copilot/shared-contracts';
import { ZodBody } from '../../../common/pipes';
import { CurrentUser, type JwtUserPayload } from '../../auth';
import { CurrentWorkspace, Roles } from '../../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../../workspaces/guards';
import type { WorkspaceContext } from '../../workspaces/types/workspace-context.type';
import { ShippingService } from './shipping.service';

@ApiTags('POS Shipping')
@Controller(['workspaces/:workspaceId/shipping', 'shipping'])
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: false,
  description: 'Target Workspace UUID for tenant resolution (or via path parameter)',
})
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Calculate shipping rate quote from carrier' })
  @ApiResponse({ status: 200, description: 'Rate quote calculated successfully' })
  async calculateQuote(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodBody(carrierRateQuoteSchema) dto: CarrierRateQuoteDto,
  ): Promise<CarrierQuoteResultDto> {
    return this.shippingService.calculateFee(context.workspaceId, dto);
  }

  @Post('orders/:orderId/dispatch')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Dispatch order and create shipment with 3PL carrier' })
  @ApiResponse({ status: 200, description: 'Order dispatched successfully' })
  async dispatchOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('orderId') orderId: string,
    @ZodBody(dispatchOrderSchema) dto: DispatchOrderDto,
  ): Promise<OrderResponseDto> {
    return this.shippingService.dispatchOrder(context.workspaceId, orderId, dto, user.userId);
  }

  @Get('orders/:orderId/track')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Track shipping progress of dispatched order' })
  @ApiResponse({ status: 200, description: 'Shipping tracking timeline retrieved' })
  async trackOrder(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('orderId') orderId: string,
  ): Promise<TrackingStatusDto> {
    return this.shippingService.trackOrder(context.workspaceId, orderId);
  }

  @Post('orders/:orderId/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT)
  @ApiOperation({ summary: 'Cancel carrier shipment for order' })
  @ApiResponse({ status: 200, description: 'Shipment cancellation requested' })
  async cancelShipment(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('orderId') orderId: string,
  ): Promise<{ success: boolean }> {
    const success = await this.shippingService.cancelOrderShipment(context.workspaceId, orderId);
    return { success };
  }
}
