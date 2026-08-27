import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { HttpStatus } from '@nestjs/common';
import { AppController } from '../app.controller';
import { AppService } from '../app.service';

describe('AppController (Health Check Endpoint)', () => {
  let controller: AppController;
  let mockAppService: any;
  let mockResponse: any;
  let statusCodeSet: number | null;

  beforeEach(() => {
    statusCodeSet = null;

    mockResponse = {
      status: (code: number) => {
        statusCodeSet = code;
        return mockResponse;
      },
    };
  });

  it('should return health status and keep 200 when all dependencies are ok', async () => {
    mockAppService = {
      getHealth: async () => ({
        status: 'ok' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'up' },
          redis: { status: 'up' },
          storage: { status: 'up' },
        },
      }),
    };

    controller = new AppController(mockAppService as AppService);
    const result = await controller.getHealth(mockResponse);

    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(statusCodeSet, null); // Passthrough retains 200
  });

  it('should set HTTP 503 SERVICE_UNAVAILABLE when dependencies are degraded (FINDING-P8-03)', async () => {
    mockAppService = {
      getHealth: async () => ({
        status: 'degraded' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'up' },
          redis: { status: 'down', error: 'Connection refused' },
          storage: { status: 'up' },
        },
      }),
    };

    controller = new AppController(mockAppService as AppService);
    const result = await controller.getHealth(mockResponse);

    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(statusCodeSet, HttpStatus.SERVICE_UNAVAILABLE);
  });
});
