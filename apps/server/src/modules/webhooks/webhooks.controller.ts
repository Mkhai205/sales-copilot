import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth';
import { WebhooksService } from './webhooks.service';

@ApiTags('Webhooks')
@Public()
@Controller('channels')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Get(':channelId/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public webhook verification handshake endpoint (e.g. Facebook Hub Challenge)',
  })
  @ApiParam({ name: 'channelId', description: 'Target Channel UUID' })
  @ApiResponse({ status: 200, description: 'Webhook verified successfully' })
  @ApiResponse({
    status: 401,
    description: 'Webhook verification token mismatch / invalid challenge',
  })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async verifyWebhook(
    @Param('channelId') channelId: string,
    @Query() query: Record<string, any>,
    @Headers() headers: Record<string, any>,
    @Res() res: Response,
  ): Promise<void> {
    const challengeResult = await this.webhooksService.verifyChallenge(channelId, query, headers);

    if (typeof challengeResult === 'string') {
      res.status(HttpStatus.OK).send(challengeResult);
    } else {
      res.status(HttpStatus.OK).json({ success: true, verified: challengeResult });
    }
  }

  @Post(':channelId/webhook')
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Public inbound webhook ingestion endpoint for omnichannel providers',
  })
  @ApiParam({ name: 'channelId', description: 'Target Channel UUID' })
  @ApiResponse({ status: 200, description: 'Webhook payload received and queued for processing' })
  @ApiResponse({ status: 401, description: 'Invalid webhook HMAC signature' })
  @ApiResponse({ status: 404, description: 'Channel not found' })
  async handleInboundWebhook(
    @Param('channelId') channelId: string,
    @Body() body: any,
    @Headers() headers: Record<string, any>,
    @Query() query: Record<string, any>,
  ): Promise<{ success: boolean; eventId?: string; duplicated?: boolean }> {
    return this.webhooksService.handleInboundWebhook(channelId, body, headers, query);
  }
}
