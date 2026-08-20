import { Injectable } from '@nestjs/common';
import { PrismaService } from './infrastructure/database/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth() {
    const dbHealth = await this.prisma.ping();

    return {
      status: dbHealth.status === 'up' ? 'ok' : 'degraded',
      service: 'sales-copilot-api',
      version: '0.1.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealth,
      },
    };
  }
}
