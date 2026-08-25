import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { WebhookDeliveryProcessor, WebhookDeliveryJobData } from '../webhook-delivery.processor';
import { WebhookDeliveryStatus } from '@sales-copilot/shared-contracts';
import { verifyWebhookSignature } from '../../../modules/webhooks/webhook-signer';

describe('WebhookDeliveryProcessor (BullMQ Worker — Feature F-1.9.4)', () => {
  let processor: WebhookDeliveryProcessor;
  let mockPrismaService: any;
  let updatedDeliveries: any[];
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    updatedDeliveries = [];
    originalFetch = global.fetch;

    mockPrismaService = {
      getClient: () => ({
        webhookDelivery: {
          update: async (args: any) => {
            const updated = {
              id: args.where.id,
              ...args.data,
              updatedAt: new Date(),
            };
            updatedDeliveries.push(updated);
            return updated;
          },
        },
      }),
    };

    processor = new WebhookDeliveryProcessor(mockPrismaService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should deliver webhook payload with valid HMAC-SHA256 signature and update status to DELIVERED on 200 OK', async () => {
    let capturedUrl = '';
    let capturedHeaders: Record<string, string> = {};
    let capturedBody = '';

    global.fetch = async (url: any, init: any) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers || {};
      capturedBody = init?.body || '';

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const secretKey = 'my-secret-test-key';
    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_123',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://example.com/api/webhook',
      secretKey,
      eventType: 'message.created',
      payload: {
        event: 'message.created',
        data: { messageId: 'm_100', text: 'Hello' },
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_1',
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processor.process(mockJob);

    // Verify HTTP invocation details
    assert.strictEqual(capturedUrl, 'https://example.com/api/webhook');
    assert.strictEqual(capturedHeaders['Content-Type'], 'application/json');
    assert.strictEqual(capturedHeaders['User-Agent'], 'SalesCopilot-Webhook/1.0');
    assert.strictEqual(capturedHeaders['X-Webhook-Event'], 'message.created');
    assert.strictEqual(capturedHeaders['X-Webhook-Delivery'], 'del_123');

    // Verify HMAC Signature header
    const signatureHeader = capturedHeaders['X-Webhook-Signature'];
    assert.ok(signatureHeader);
    assert.ok(signatureHeader.startsWith('sha256='));
    const isValidSignature = verifyWebhookSignature(capturedBody, signatureHeader, secretKey);
    assert.strictEqual(isValidSignature, true);

    // Verify WebhookDelivery DB status updates
    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.DELIVERED);
    assert.strictEqual(finalUpdate.responseStatus, 200);
    assert.strictEqual(finalUpdate.responseBody, JSON.stringify({ received: true }));
    assert.ok(finalUpdate.deliveredAt instanceof Date);
    assert.strictEqual(finalUpdate.nextRetryAt, null);
  });

  it('should deliver webhook payload without X-Webhook-Signature if secretKey is missing', async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = async (url: any, init: any) => {
      capturedHeaders = init?.headers || {};
      return new Response('OK', { status: 200 });
    };

    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_no_secret',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://example.com/api/no-secret',
      secretKey: null,
      eventType: 'conversation.created',
      payload: {
        event: 'conversation.created',
        data: {},
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_2',
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processor.process(mockJob);

    assert.strictEqual(capturedHeaders['X-Webhook-Signature'], undefined);
    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.DELIVERED);
  });

  it('should transition status to RETRYING and compute nextRetryAt on non-2xx HTTP status for retryable attempt', async () => {
    global.fetch = async () => {
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
      });
    };

    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_retry',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://example.com/failing',
      secretKey: 'key',
      eventType: 'message.created',
      payload: {
        event: 'message.created',
        data: {},
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_3',
      data: jobData,
      attemptsMade: 0, // Attempt 1 out of 3
      opts: { attempts: 3 },
    };

    await assert.rejects(async () => {
      await processor.process(mockJob);
    }, /responded with HTTP 500/);

    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.RETRYING);
    assert.strictEqual(finalUpdate.responseStatus, 500);
    assert.ok(finalUpdate.nextRetryAt instanceof Date);
  });

  it('should transition status to FAILED and clear nextRetryAt on final attempt exhaustion', async () => {
    global.fetch = async () => {
      return new Response('Not Found', { status: 404 });
    };

    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_exhausted',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://example.com/not-found',
      secretKey: 'key',
      eventType: 'message.created',
      payload: {
        event: 'message.created',
        data: {},
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_4',
      data: jobData,
      attemptsMade: 2, // Attempt 3 out of 3 (final attempt)
      opts: { attempts: 3 },
    };

    await assert.rejects(async () => {
      await processor.process(mockJob);
    }, /responded with HTTP 404/);

    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.FAILED);
    assert.strictEqual(finalUpdate.responseStatus, 404);
    assert.strictEqual(finalUpdate.nextRetryAt, null);
  });

  it('should handle network/timeout errors gracefully and record error details in WebhookDelivery', async () => {
    global.fetch = async () => {
      const err = new Error('Connection refused');
      throw err;
    };

    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_net_err',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://unreachable.host/webhook',
      secretKey: 'key',
      eventType: 'message.created',
      payload: {
        event: 'message.created',
        data: {},
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_5',
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await assert.rejects(async () => {
      await processor.process(mockJob);
    }, /Connection refused/);

    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.RETRYING);
    assert.strictEqual(finalUpdate.responseStatus, null);
    assert.ok(finalUpdate.responseBody.includes('Connection refused'));
  });

  it('should truncate large response bodies over 2000 characters', async () => {
    const hugeBody = 'A'.repeat(5000);
    global.fetch = async () => {
      return new Response(hugeBody, { status: 200 });
    };

    const jobData: WebhookDeliveryJobData = {
      deliveryId: 'del_large_body',
      subscriptionId: 'sub_1',
      workspaceId: 'ws_1',
      url: 'https://example.com/large',
      secretKey: null,
      eventType: 'message.created',
      payload: {
        event: 'message.created',
        data: {},
        timestamp: '2026-08-26T00:00:00.000Z',
        workspaceId: 'ws_1',
      },
    };

    const mockJob: any = {
      id: 'job_6',
      data: jobData,
      attemptsMade: 0,
      opts: { attempts: 3 },
    };

    await processor.process(mockJob);

    const finalUpdate = updatedDeliveries[updatedDeliveries.length - 1];
    assert.strictEqual(finalUpdate.status, WebhookDeliveryStatus.DELIVERED);
    assert.ok(finalUpdate.responseBody.length < 2100);
    assert.ok(finalUpdate.responseBody.endsWith('... [truncated]'));
  });
});
