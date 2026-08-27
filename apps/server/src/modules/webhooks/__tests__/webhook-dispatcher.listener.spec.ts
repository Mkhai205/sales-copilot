import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { WebhookDispatcherListener } from '../webhook-dispatcher.listener';
import { WebhookDeliveryStatus, DomainEvent } from '@sales-copilot/shared-contracts';

describe('WebhookDispatcherListener (Feature F-1.9.4)', () => {
  let listener: WebhookDispatcherListener;
  let mockPrismaService: any;
  let mockQueue: any;
  let storedDeliveries: any[];
  let enqueuedJobs: any[];

  const mockSubscriptions = [
    {
      id: 'sub_1',
      workspaceId: 'ws_test_1',
      url: 'https://example.com/webhook1',
      secretKey: 'secret-key-1',
      subscriptions: ['message.created', 'conversation.status_updated'],
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sub_2',
      workspaceId: 'ws_test_1',
      url: 'https://example.com/webhook2',
      secretKey: null,
      subscriptions: JSON.stringify(['conversation.created']),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'sub_inactive',
      workspaceId: 'ws_test_1',
      url: 'https://example.com/inactive',
      secretKey: 'secret-key-inactive',
      subscriptions: ['message.created'],
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    storedDeliveries = [];
    enqueuedJobs = [];

    mockPrismaService = {
      getClient: () => ({
        webhookSubscription: {
          findMany: async (args: any) => {
            const { workspaceId, isActive } = args.where;
            return mockSubscriptions.filter(
              s =>
                s.workspaceId === workspaceId &&
                (isActive === undefined || s.isActive === isActive),
            );
          },
        },
        webhookDelivery: {
          create: async (args: any) => {
            const record = {
              id: `del_${storedDeliveries.length + 1}`,
              ...args.data,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            storedDeliveries.push(record);
            return record;
          },
        },
      }),
    };

    mockQueue = {
      add: async (jobName: string, data: any, opts: any) => {
        enqueuedJobs.push({ jobName, data, opts });
        return { id: `job_${enqueuedJobs.length}` };
      },
    };

    listener = new WebhookDispatcherListener(mockPrismaService, mockQueue);
  });

  it('should ignore events missing workspaceId', async () => {
    await listener.handleMessageCreated({
      conversationId: 'c_1',
      message: { id: 'm_1', content: 'Hello' } as any,
    });

    assert.strictEqual(storedDeliveries.length, 0);
    assert.strictEqual(enqueuedJobs.length, 0);
  });

  it('should ignore events when no active subscriptions match the event type', async () => {
    await listener.handleChannelCreated({
      workspaceId: 'ws_test_1',
      channelId: 'ch_1',
    });

    assert.strictEqual(storedDeliveries.length, 0);
    assert.strictEqual(enqueuedJobs.length, 0);
  });

  it('should create WebhookDelivery and enqueue BullMQ job for matching subscriptions on message.created', async () => {
    const payload = {
      workspaceId: 'ws_test_1',
      conversationId: 'conv_123',
      message: {
        id: 'msg_999',
        content: 'Hello customer',
        messageType: 'INCOMING',
      },
    };

    await listener.handleMessageCreated(payload);

    // sub_1 matched, sub_inactive ignored because isActive is false
    assert.strictEqual(storedDeliveries.length, 1);
    const delivery = storedDeliveries[0];
    assert.strictEqual(delivery.subscriptionId, 'sub_1');
    assert.strictEqual(delivery.eventType, DomainEvent.MESSAGE_CREATED);
    assert.strictEqual(delivery.status, WebhookDeliveryStatus.PENDING);
    assert.strictEqual(delivery.attemptCount, 0);
    assert.strictEqual(delivery.payload.event, DomainEvent.MESSAGE_CREATED);
    assert.deepStrictEqual(delivery.payload.data, payload);
    assert.strictEqual(delivery.payload.workspaceId, 'ws_test_1');

    assert.strictEqual(enqueuedJobs.length, 1);
    const job = enqueuedJobs[0];
    assert.strictEqual(job.jobName, 'deliver-webhook');
    assert.strictEqual(job.data.deliveryId, delivery.id);
    assert.strictEqual(job.data.subscriptionId, 'sub_1');
    assert.strictEqual(job.data.url, 'https://example.com/webhook1');
    assert.strictEqual(job.data.secretKey, 'secret-key-1');
    assert.strictEqual(job.opts.jobId, delivery.id);
    assert.strictEqual(job.opts.attempts, 3);
    assert.deepStrictEqual(job.opts.backoff, { type: 'exponential', delay: 30000 });
  });

  it('should support JSON-stringified subscriptions format (sub_2 on conversation.created)', async () => {
    const payload = {
      workspaceId: 'ws_test_1',
      conversation: {
        id: 'conv_abc',
        displayId: 101,
      },
    };

    await listener.handleConversationCreated(payload);

    assert.strictEqual(storedDeliveries.length, 1);
    assert.strictEqual(storedDeliveries[0].subscriptionId, 'sub_2');
    assert.strictEqual(storedDeliveries[0].eventType, DomainEvent.CONVERSATION_CREATED);
    assert.strictEqual(enqueuedJobs.length, 1);
    assert.strictEqual(enqueuedJobs[0].data.secretKey, null);
  });

  it('should dispatch all domain event types properly', async () => {
    // Test status updated
    await listener.handleConversationStatusUpdated({
      workspaceId: 'ws_test_1',
      conversationId: 'c_1',
      status: 'RESOLVED',
    });

    assert.strictEqual(storedDeliveries.length, 1);
    assert.strictEqual(storedDeliveries[0].subscriptionId, 'sub_1');
    assert.strictEqual(storedDeliveries[0].eventType, DomainEvent.CONVERSATION_STATUS_UPDATED);
  });

  it('should isolate errors gracefully without throwing', async () => {
    mockQueue.add = async () => {
      throw new Error('Redis connection failed');
    };

    // Should not throw
    await assert.doesNotReject(async () => {
      await listener.handleMessageCreated({
        workspaceId: 'ws_test_1',
        conversationId: 'c_1',
        message: { id: 'm_1' } as any,
      });
    });
  });
});
