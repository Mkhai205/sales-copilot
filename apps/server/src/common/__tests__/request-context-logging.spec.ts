import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { Writable } from 'node:stream';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';
import {
  WebhookDeliveryProcessor,
  WebhookDeliveryJobData,
} from '../../infrastructure/queue/webhook-delivery.processor';

describe('Request ID Correlation & Context Enrichment (Task 5 — Feature F-1.11.3)', () => {
  describe('Pino HTTP Context Enrichment', () => {
    const createTestPinoHttp = (sink: (logObj: Record<string, any>) => void) => {
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          try {
            const parsed = JSON.parse(chunk.toString());
            sink(parsed);
          } catch {
            // Ignore non-json
          }
          callback();
        },
      });

      return pinoHttp(
        {
          autoLogging: true,
          genReqId: (req: any, res: any) => {
            const existingId =
              (req.headers['x-request-id'] as string) ||
              (req.headers['x-correlation-id'] as string);
            const id = existingId || randomUUID();
            req.headers['x-request-id'] = id;
            res.setHeader?.('x-request-id', id);
            return id;
          },
          customAttributeKeys: {
            reqId: 'requestId',
          },
          customProps: (req: any) => {
            const requestId =
              (req.headers?.['x-request-id'] as string) ||
              (req.headers?.['x-correlation-id'] as string) ||
              req.id;
            const workspaceId =
              req.workspace?.workspaceId ||
              (typeof req.headers?.['x-workspace-id'] === 'string'
                ? req.headers['x-workspace-id']
                : undefined);
            const userId = req.user?.userId;

            return {
              requestId,
              ...(workspaceId ? { workspaceId } : {}),
              ...(userId ? { userId } : {}),
            };
          },
        },
        stream,
      );
    };

    const createMockReqRes = (options: {
      headers?: Record<string, string>;
      user?: { userId: string; email?: string; role?: string };
      workspace?: { workspaceId: string };
    }) => {
      const req: any = {
        headers: options.headers || {},
        method: 'GET',
        url: '/api/v1/test',
        user: options.user,
        workspace: options.workspace,
      };

      const setHeaders: Record<string, string> = {};
      const res: any = new EventEmitter();
      res.setHeader = (key: string, val: string) => {
        setHeaders[key.toLowerCase()] = val;
      };
      res.getHeader = (key: string) => setHeaders[key.toLowerCase()];
      res.statusCode = 200;

      return { req, res, setHeaders };
    };

    it('should propagate existing x-request-id into requestId field and response headers', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(log => logs.push(log));

      const inputReqId = 'req_existing_custom_uuid_999';
      const { req, res, setHeaders } = createMockReqRes({
        headers: { 'x-request-id': inputReqId },
      });

      middleware(req, res);
      req.log.info('test message with existing id');

      assert.strictEqual(setHeaders['x-request-id'], inputReqId);
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].requestId, inputReqId);
      assert.strictEqual(logs[0].msg, 'test message with existing id');
    });

    it('should generate UUID requestId and set response header when x-request-id is absent', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(log => logs.push(log));

      const { req, res, setHeaders } = createMockReqRes({});

      middleware(req, res);
      req.log.info('test message with generated id');

      const generatedId = setHeaders['x-request-id'];
      assert.ok(generatedId, 'Expected x-request-id header to be set');
      assert.strictEqual(typeof generatedId, 'string');
      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].requestId, generatedId);
    });

    it('should enrich log entries with userId and workspaceId for authenticated requests', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(log => logs.push(log));

      const { req, res } = createMockReqRes({
        headers: { 'x-request-id': 'req_auth_123' },
        user: { userId: 'usr_alpha_456' },
        workspace: { workspaceId: 'ws_finance_789' },
      });

      middleware(req, res);
      req.log.info('authenticated action performed');

      assert.strictEqual(logs.length, 1);
      const entry = logs[0];
      assert.strictEqual(entry.requestId, 'req_auth_123');
      assert.strictEqual(entry.userId, 'usr_alpha_456');
      assert.strictEqual(entry.workspaceId, 'ws_finance_789');
      assert.strictEqual(entry.msg, 'authenticated action performed');
      assert.ok(entry.level);
      assert.ok(entry.time);
    });

    it('should extract workspaceId from x-workspace-id header when req.workspace is not yet set', () => {
      const logs: Record<string, any>[] = [];
      const middleware = createTestPinoHttp(log => logs.push(log));

      const { req, res } = createMockReqRes({
        headers: {
          'x-request-id': 'req_header_123',
          'x-workspace-id': 'ws_from_header_999',
        },
      });

      middleware(req, res);
      req.log.info('early request log');

      assert.strictEqual(logs.length, 1);
      assert.strictEqual(logs[0].requestId, 'req_header_123');
      assert.strictEqual(logs[0].workspaceId, 'ws_from_header_999');
      assert.strictEqual(logs[0].userId, undefined);
    });
  });

  describe('BullMQ Queue Processor Trace Context', () => {
    let originalFetch: typeof global.fetch;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should include [requestId] prefix in WebhookDeliveryProcessor logs when requestId is provided', async () => {
      const loggedMessages: string[] = [];
      const mockPrismaService = {
        getClient: () => ({
          webhookDelivery: {
            update: async (args: any) => ({
              id: args.where.id,
              ...args.data,
            }),
          },
        }),
      };

      global.fetch = async () =>
        new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });

      const processor = new WebhookDeliveryProcessor(mockPrismaService as any);

      // Spy on logger.log
      const originalLoggerLog = (processor as any).logger.log.bind((processor as any).logger);
      (processor as any).logger.log = (message: string) => {
        loggedMessages.push(message);
        originalLoggerLog(message);
      };

      const testRequestId = 'req_trace_test_xyz';
      const jobData: WebhookDeliveryJobData = {
        deliveryId: 'del_trace_1',
        subscriptionId: 'sub_trace_1',
        workspaceId: 'ws_trace_1',
        url: 'https://example.com/webhook',
        eventType: 'conversation.created',
        payload: {
          event: 'conversation.created',
          data: { id: 'conv_1' },
          timestamp: new Date().toISOString(),
          workspaceId: 'ws_trace_1',
        },
        requestId: testRequestId,
      };

      const mockJob: any = {
        id: 'job_trace_1',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      };

      await processor.process(mockJob);

      assert.ok(loggedMessages.length >= 2);
      for (const msg of loggedMessages) {
        assert.ok(
          msg.includes(`[${testRequestId}]`),
          `Expected log message to contain [${testRequestId}], but got: ${msg}`,
        );
      }
    });
  });
});
