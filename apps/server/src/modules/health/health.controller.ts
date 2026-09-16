import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service';
import { Public } from '../identity';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Check API service health status' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is degraded or down' })
  async getHealth(@Res({ passthrough: true }) res: Response) {
    const health = await this.healthService.getHealth();
    if (health.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }

  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Process is alive' })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Service is ready to handle traffic' })
  @ApiResponse({
    status: 503,
    description: 'Service is not ready (dependencies down or migrations pending)',
  })
  async getReadiness(@Res({ passthrough: true }) res: Response) {
    const readiness = await this.healthService.getReadiness();
    if (readiness.status !== 'ok') {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return readiness;
  }
}
