import {
  Controller,
  Delete,
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
  CreateWebhookSubscriptionDto,
  createWebhookSubscriptionSchema,
  UpdateWebhookSubscriptionDto,
  updateWebhookSubscriptionSchema,
  WebhookSubscriptionDto,
  WebhookSubscriptionListQueryDto,
  webhookSubscriptionListQuerySchema,
  WebhookDeliveryDto,
  WebhookDeliveryDetailDto,
  WebhookDeliveryListQueryDto,
  webhookDeliveryListQuerySchema,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { ZodBody, ZodQuery } from '../../common/pipes';
import { CurrentUser, type JwtUserPayload } from '../auth';
import { CurrentWorkspace, Roles } from '../workspaces/decorators';
import { RolesGuard, WorkspaceGuard } from '../workspaces/guards';
import type { WorkspaceContext } from '../workspaces/types/workspace-context.type';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';

@ApiTags('Webhook Subscriptions')
@Controller('webhook-subscriptions')
@UseGuards(WorkspaceGuard, RolesGuard)
@ApiBearerAuth()
@ApiHeader({
  name: 'X-Workspace-Id',
  required: true,
  description: 'Target Workspace UUID for tenant resolution',
})
export class WebhookSubscriptionsController {
  constructor(private readonly webhookSubscriptionsService: WebhookSubscriptionsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({
    summary: 'List all webhook subscriptions in the workspace with optional filters',
  })
  @ApiResponse({ status: 200, description: 'Webhook subscriptions retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Missing X-Workspace-Id header or invalid query' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async list(
    @CurrentWorkspace() context: WorkspaceContext,
    @ZodQuery(webhookSubscriptionListQuerySchema) query?: WebhookSubscriptionListQueryDto,
  ): Promise<WebhookSubscriptionDto[]> {
    return this.webhookSubscriptionsService.list(context.workspaceId, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Create a new outbound webhook subscription in the workspace' })
  @ApiResponse({ status: 201, description: 'Webhook subscription created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  async create(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @ZodBody(createWebhookSubscriptionSchema) dto: CreateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionDto> {
    return this.webhookSubscriptionsService.create(context.workspaceId, dto, user.userId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get a webhook subscription detail by ID' })
  @ApiResponse({ status: 200, description: 'Webhook subscription detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async getById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
  ): Promise<WebhookSubscriptionDto> {
    return this.webhookSubscriptionsService.getById(context.workspaceId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Update a webhook subscription in the workspace' })
  @ApiResponse({ status: 200, description: 'Webhook subscription updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async update(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
    @ZodBody(updateWebhookSubscriptionSchema) dto: UpdateWebhookSubscriptionDto,
  ): Promise<WebhookSubscriptionDto> {
    return this.webhookSubscriptionsService.update(context.workspaceId, id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Delete a webhook subscription from the workspace' })
  @ApiResponse({ status: 200, description: 'Webhook subscription deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden / Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async delete(
    @CurrentWorkspace() context: WorkspaceContext,
    @CurrentUser() user: JwtUserPayload,
    @Param('id') id: string,
  ): Promise<{ success: true }> {
    return this.webhookSubscriptionsService.delete(context.workspaceId, id, user.userId);
  }

  @Get(':id/deliveries')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'List delivery history for a webhook subscription' })
  @ApiResponse({ status: 200, description: 'Webhook deliveries retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Webhook subscription not found' })
  async listDeliveries(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @ZodQuery(webhookDeliveryListQuerySchema) query?: WebhookDeliveryListQueryDto,
  ): Promise<{
    items: WebhookDeliveryDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    return this.webhookSubscriptionsService.listDeliveries(context.workspaceId, id, query);
  }

  @Get(':id/deliveries/:deliveryId')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.AGENT, WorkspaceRole.VIEWER)
  @ApiOperation({ summary: 'Get details for a specific webhook delivery attempt' })
  @ApiResponse({ status: 200, description: 'Webhook delivery detail retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Webhook delivery not found' })
  async getDeliveryById(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ): Promise<WebhookDeliveryDetailDto> {
    return this.webhookSubscriptionsService.getDeliveryById(context.workspaceId, id, deliveryId);
  }

  @Post(':id/deliveries/:deliveryId/retry')
  @HttpCode(HttpStatus.OK)
  @Roles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @ApiOperation({ summary: 'Manually retry a failed webhook delivery' })
  @ApiResponse({ status: 200, description: 'Webhook delivery re-enqueued successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Webhook delivery not found' })
  async retryDelivery(
    @CurrentWorkspace() context: WorkspaceContext,
    @Param('id') id: string,
    @Param('deliveryId') deliveryId: string,
  ): Promise<WebhookDeliveryDetailDto> {
    return this.webhookSubscriptionsService.retryDelivery(context.workspaceId, id, deliveryId);
  }
}
