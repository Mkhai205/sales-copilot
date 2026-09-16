import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { HttpStatus } from '@nestjs/common';
import { HealthController } from '../health.controller';
import { HealthService } from '../health.service';

describe('HealthController (Health Check Endpoint)', () => {
  let controller: HealthController;
  let mockHealthService: any;
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
    mockHealthService = {
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

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getHealth(mockResponse);

    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(statusCodeSet, null); // Passthrough retains 200
  });

  it('should set HTTP 503 SERVICE_UNAVAILABLE when dependencies are degraded (FINDING-P8-03)', async () => {
    mockHealthService = {
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
          queues: {
            channelIngestion: { status: 'ok' },
            webhookDelivery: { status: 'ok' },
          },
        },
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getHealth(mockResponse);

    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(statusCodeSet, HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('should set HTTP 503 SERVICE_UNAVAILABLE when dependencies are down', async () => {
    mockHealthService = {
      getHealth: async () => ({
        status: 'down' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'down', error: 'Database connection failed' },
          redis: { status: 'up' },
          storage: { status: 'up' },
          queues: {
            channelIngestion: { status: 'ok' },
            webhookDelivery: { status: 'ok' },
          },
        },
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getHealth(mockResponse);

    assert.strictEqual(result.status, 'down');
    assert.strictEqual(statusCodeSet, HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('should return liveness status ok with uptime and timestamp', () => {
    mockHealthService = {
      getLiveness: () => ({
        status: 'ok' as const,
        service: 'sales-copilot-api',
        uptime: 100,
        timestamp: new Date().toISOString(),
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = controller.getLiveness();

    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.service, 'sales-copilot-api');
    assert.strictEqual(typeof result.uptime, 'number');
  });

  it('should return readiness status and 200 when all dependencies and migrations are ready', async () => {
    mockHealthService = {
      getReadiness: async () => ({
        status: 'ok' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'up', latencyMs: 2, migrationsApplied: true, migrationCount: 2 },
          redis: { status: 'up', latencyMs: 1 },
          storage: { status: 'up', latencyMs: 5 },
          queues: {
            channelIngestion: { status: 'ok' },
            webhookDelivery: { status: 'ok' },
          },
        },
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getReadiness(mockResponse);

    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(statusCodeSet, null); // Passthrough retains 200
  });

  it('should set HTTP 503 SERVICE_UNAVAILABLE when readiness is down', async () => {
    mockHealthService = {
      getReadiness: async () => ({
        status: 'down' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'down', latencyMs: 0, migrationsApplied: false, error: 'DB down' },
          redis: { status: 'up', latencyMs: 1 },
          storage: { status: 'up', latencyMs: 5 },
          queues: {
            channelIngestion: { status: 'ok' },
            webhookDelivery: { status: 'ok' },
          },
        },
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getReadiness(mockResponse);

    assert.strictEqual(result.status, 'down');
    assert.strictEqual(statusCodeSet, HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('should set HTTP 503 SERVICE_UNAVAILABLE when readiness is degraded', async () => {
    mockHealthService = {
      getReadiness: async () => ({
        status: 'degraded' as const,
        service: 'sales-copilot-api',
        version: '0.1.0',
        uptime: 100,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'up', latencyMs: 2, migrationsApplied: true, migrationCount: 2 },
          redis: { status: 'down', latencyMs: 0, error: 'Redis down' },
          storage: { status: 'up', latencyMs: 5 },
          queues: {
            channelIngestion: { status: 'ok' },
            webhookDelivery: { status: 'ok' },
          },
        },
      }),
    };

    controller = new HealthController(mockHealthService as HealthService);
    const result = await controller.getReadiness(mockResponse);

    assert.strictEqual(result.status, 'degraded');
    assert.strictEqual(statusCodeSet, HttpStatus.SERVICE_UNAVAILABLE);
  });
});
