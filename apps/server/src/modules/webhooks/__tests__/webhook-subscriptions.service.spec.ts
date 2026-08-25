import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WebhookSubscriptionsService } from '../webhook-subscriptions.service';
import { WebhookEventType } from '@sales-copilot/shared-contracts';

describe('WebhookSubscriptionsService (Feature F-1.9.3)', () => {
  let service: WebhookSubscriptionsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;
  let subsDb: Map<string, any>;
  let deliveriesDb: Map<string, any>;
  let mockQueue: any;
  let enqueuedJobs: any[];

  const workspaceA = 'ws_tenant_alpha';
  const workspaceB = 'ws_tenant_beta';
  const user1 = 'usr_admin_1';

  beforeEach(() => {
    subsDb = new Map();
    deliveriesDb = new Map();
    emittedEvents = [];
    enqueuedJobs = [];

    mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        enqueuedJobs.push({ name, data, opts });
        return { id: `job_${enqueuedJobs.length}` };
      },
    };

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      webhookSubscription: {
        findFirst: async ({ where }: { where: any }) => {
          for (const item of subsDb.values()) {
            if (where.id && item.id !== where.id) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            return { ...item };
          }
          return null;
        },

        findMany: async ({
          where,
          orderBy,
        }: {
          where?: any;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          const results = Array.from(subsDb.values()).filter((item: any) => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.isActive !== undefined && item.isActive !== where.isActive) return false;
            if (where?.url?.contains) {
              const query = where.url.contains.toLowerCase();
              if (!item.url.toLowerCase().includes(query)) return false;
            }
            return true;
          });

          if (orderBy?.createdAt === 'asc') {
            results.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
          } else if (orderBy?.createdAt === 'desc') {
            results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          }

          return results.map(item => ({ ...item }));
        },

        create: async ({ data }: { data: any }) => {
          const id = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const record = {
            id,
            workspaceId: data.workspaceId,
            url: data.url,
            secretKey: data.secretKey ?? null,
            subscriptions: data.subscriptions ?? [],
            isActive: data.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          subsDb.set(id, record);
          return { ...record };
        },

        update: async ({ where, data }: { where: any; data: any }) => {
          const existing = subsDb.get(where.id);
          if (!existing) throw new Error('Record not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          subsDb.set(where.id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: any }) => {
          const existing = subsDb.get(where.id);
          if (!existing) throw new Error('Record not found');
          subsDb.delete(where.id);
          return { ...existing };
        },
      },

      webhookDelivery: {
        count: async ({ where }: { where: any }) => {
          return Array.from(deliveriesDb.values()).filter((item: any) => {
            if (where.subscriptionId && item.subscriptionId !== where.subscriptionId) return false;
            if (where.status && item.status !== where.status) return false;
            if (where.eventType && item.eventType !== where.eventType) return false;
            return true;
          }).length;
        },
        findMany: async ({ where, skip, take }: { where: any; skip?: number; take?: number }) => {
          let results = Array.from(deliveriesDb.values()).filter((item: any) => {
            if (where.subscriptionId && item.subscriptionId !== where.subscriptionId) return false;
            if (where.status && item.status !== where.status) return false;
            if (where.eventType && item.eventType !== where.eventType) return false;
            return true;
          });
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          if (skip !== undefined && take !== undefined) {
            results = results.slice(skip, skip + take);
          }
          return results.map(d => ({ ...d }));
        },
        findFirst: async ({ where }: { where: any }) => {
          for (const item of deliveriesDb.values()) {
            if (where.id && item.id !== where.id) continue;
            if (where.subscriptionId && item.subscriptionId !== where.subscriptionId) continue;
            return { ...item };
          }
          return null;
        },
        update: async ({ where, data }: { where: any; data: any }) => {
          const existing = deliveriesDb.get(where.id);
          if (!existing) throw new Error('Delivery not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          deliveriesDb.set(where.id, updated);
          return { ...updated };
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new WebhookSubscriptionsService(
      mockPrismaService,
      mockEventEmitter as any,
      mockQueue as any,
    );
  });

  describe('create()', () => {
    it('should create a webhook subscription with auto-generated secretKey when not provided', async () => {
      const result = await service.create(
        workspaceA,
        {
          url: 'https://example.com/webhooks/orders',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
          isActive: true,
        },
        user1,
      );

      assert.ok(result.id);
      assert.strictEqual(result.workspaceId, workspaceA);
      assert.strictEqual(result.url, 'https://example.com/webhooks/orders');
      assert.deepStrictEqual(result.subscriptions, ['message.created']);
      assert.strictEqual(typeof result.secretKey, 'string');
      assert.strictEqual((result.secretKey as string).length, 64); // 32 bytes hex
      assert.strictEqual(result.isActive, true);

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'webhook_subscription.created');
      assert.strictEqual(emittedEvents[0].payload.workspaceId, workspaceA);
      assert.strictEqual(emittedEvents[0].payload.subscription.id, result.id);
      assert.strictEqual(emittedEvents[0].payload.userId, user1);
    });

    it('should create a webhook subscription with user-specified secretKey', async () => {
      const result = await service.create(
        workspaceA,
        {
          url: 'https://crm.partner.io/events',
          subscriptions: [
            WebhookEventType.CONVERSATION_CREATED,
            WebhookEventType.CONVERSATION_STATUS_UPDATED,
          ],
          secretKey: 'custom-secret-key-12345',
          isActive: false,
        },
        user1,
      );

      assert.strictEqual(result.url, 'https://crm.partner.io/events');
      assert.strictEqual(result.secretKey, 'custom-secret-key-12345');
      assert.strictEqual(result.isActive, false);
      assert.strictEqual(result.subscriptions.length, 2);
    });

    it('should throw BadRequestException if URL is empty', async () => {
      await assert.rejects(
        async () => {
          await service.create(workspaceA, {
            url: '   ',
            subscriptions: [WebhookEventType.MESSAGE_CREATED],
          });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_WEBHOOK_URL');
          return true;
        },
      );
    });
  });

  describe('list()', () => {
    beforeEach(async () => {
      await service.create(workspaceA, {
        url: 'https://alpha-hook.com/msg',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
        isActive: true,
      });

      await service.create(workspaceA, {
        url: 'https://alpha-hook.com/conv',
        subscriptions: [WebhookEventType.CONVERSATION_CREATED, WebhookEventType.CONTACT_CREATED],
        isActive: false,
      });

      await service.create(workspaceB, {
        url: 'https://beta-hook.com/msg',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
        isActive: true,
      });
    });

    it('should list only subscriptions belonging to the target workspace (Tenant Isolation)', async () => {
      const listA = await service.list(workspaceA);
      assert.strictEqual(listA.length, 2);
      assert.ok(listA.every(s => s.workspaceId === workspaceA));

      const listB = await service.list(workspaceB);
      assert.strictEqual(listB.length, 1);
      assert.strictEqual(listB[0].workspaceId, workspaceB);
    });

    it('should filter by isActive status', async () => {
      const activeSubs = await service.list(workspaceA, { isActive: true });
      assert.strictEqual(activeSubs.length, 1);
      assert.strictEqual(activeSubs[0].url, 'https://alpha-hook.com/msg');

      const inactiveSubs = await service.list(workspaceA, { isActive: false });
      assert.strictEqual(inactiveSubs.length, 1);
      assert.strictEqual(inactiveSubs[0].url, 'https://alpha-hook.com/conv');
    });

    it('should filter by search query matching URL', async () => {
      const searchResults = await service.list(workspaceA, { search: 'conv' });
      assert.strictEqual(searchResults.length, 1);
      assert.strictEqual(searchResults[0].url, 'https://alpha-hook.com/conv');
    });

    it('should filter by subscribed event', async () => {
      const convSubs = await service.list(workspaceA, {
        event: WebhookEventType.CONVERSATION_CREATED,
      });
      assert.strictEqual(convSubs.length, 1);
      assert.strictEqual(convSubs[0].url, 'https://alpha-hook.com/conv');

      const msgSubs = await service.list(workspaceA, {
        event: WebhookEventType.MESSAGE_CREATED,
      });
      assert.strictEqual(msgSubs.length, 1);
      assert.strictEqual(msgSubs[0].url, 'https://alpha-hook.com/msg');
    });
  });

  describe('getById()', () => {
    it('should return subscription details when found within workspace', async () => {
      const created = await service.create(workspaceA, {
        url: 'https://example.com/webhook',
        subscriptions: [WebhookEventType.LABEL_CREATED],
      });

      const found = await service.getById(workspaceA, created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.url, 'https://example.com/webhook');
    });

    it('should throw NotFoundException when ID does not exist', async () => {
      await assert.rejects(
        async () => {
          await service.getById(workspaceA, 'non_existent_id');
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when trying to access subscription from another workspace', async () => {
      const created = await service.create(workspaceA, {
        url: 'https://example.com/webhook',
        subscriptions: [WebhookEventType.LABEL_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.getById(workspaceB, created.id);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('update()', () => {
    it('should update webhook subscription fields and emit event', async () => {
      const created = await service.create(
        workspaceA,
        {
          url: 'https://old-endpoint.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
          isActive: true,
        },
        user1,
      );
      emittedEvents = [];

      const updated = await service.update(
        workspaceA,
        created.id,
        {
          url: 'https://new-endpoint.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED, WebhookEventType.MESSAGE_DELETED],
          secretKey: 'new-updated-secret-key',
          isActive: false,
        },
        user1,
      );

      assert.strictEqual(updated.id, created.id);
      assert.strictEqual(updated.url, 'https://new-endpoint.com/webhook');
      assert.deepStrictEqual(updated.subscriptions, ['message.created', 'message.deleted']);
      assert.strictEqual(updated.secretKey, 'new-updated-secret-key');
      assert.strictEqual(updated.isActive, false);

      // Verify domain event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'webhook_subscription.updated');
      assert.strictEqual(emittedEvents[0].payload.subscription.id, created.id);
    });

    it('should throw BadRequestException if update provides an empty URL', async () => {
      const created = await service.create(workspaceA, {
        url: 'https://old-endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.update(workspaceA, created.id, { url: '   ' });
        },
        (err: any) => {
          assert.ok(err instanceof BadRequestException);
          assert.strictEqual((err.getResponse() as any).code, 'INVALID_WEBHOOK_URL');
          return true;
        },
      );
    });

    it('should throw NotFoundException if subscription does not exist or belongs to another workspace', async () => {
      const created = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.update(workspaceB, created.id, { isActive: false });
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'WEBHOOK_SUBSCRIPTION_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('delete()', () => {
    it('should delete subscription and emit event', async () => {
      const created = await service.create(
        workspaceA,
        {
          url: 'https://endpoint.com/webhook',
          subscriptions: [WebhookEventType.MESSAGE_CREATED],
        },
        user1,
      );
      emittedEvents = [];

      const result = await service.delete(workspaceA, created.id, user1);
      assert.deepStrictEqual(result, { success: true });

      // Ensure deleted
      await assert.rejects(
        async () => {
          await service.getById(workspaceA, created.id);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );

      // Verify domain event
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'webhook_subscription.deleted');
      assert.strictEqual(emittedEvents[0].payload.subscriptionId, created.id);
      assert.strictEqual(emittedEvents[0].payload.url, 'https://endpoint.com/webhook');
    });

    it('should throw NotFoundException when deleting non-existent or cross-tenant subscription', async () => {
      const created = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.delete(workspaceB, created.id);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });
  });

  describe('listDeliveries()', () => {
    it('should return paginated delivery list for a valid subscription', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      deliveriesDb.set('del_1', {
        id: 'del_1',
        subscriptionId: sub.id,
        eventId: 'ev_1',
        eventType: 'message.created',
        payload: { event: 'message.created' },
        status: 'DELIVERED',
        attemptCount: 1,
        responseStatus: 200,
        responseBody: 'OK',
        createdAt: new Date(Date.now() - 1000),
        updatedAt: new Date(),
      });

      deliveriesDb.set('del_2', {
        id: 'del_2',
        subscriptionId: sub.id,
        eventId: 'ev_2',
        eventType: 'message.created',
        payload: { event: 'message.created' },
        status: 'FAILED',
        attemptCount: 3,
        responseStatus: 500,
        responseBody: 'Server error',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await service.listDeliveries(workspaceA, sub.id, { page: 1, limit: 10 });
      assert.strictEqual(res.items.length, 2);
      assert.strictEqual(res.meta.total, 2);
      assert.strictEqual(res.items[0].id, 'del_2'); // ordered desc
      assert.strictEqual(res.items[0].status, 'FAILED');
    });

    it('should filter deliveries by status and eventType', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED, WebhookEventType.CONVERSATION_CREATED],
      });

      deliveriesDb.set('del_1', {
        id: 'del_1',
        subscriptionId: sub.id,
        eventType: 'message.created',
        status: 'DELIVERED',
        attemptCount: 1,
        createdAt: new Date(),
      });

      deliveriesDb.set('del_2', {
        id: 'del_2',
        subscriptionId: sub.id,
        eventType: 'conversation.created',
        status: 'FAILED',
        attemptCount: 3,
        createdAt: new Date(),
      });

      const filtered = await service.listDeliveries(workspaceA, sub.id, {
        status: 'DELIVERED' as any,
      });
      assert.strictEqual(filtered.items.length, 1);
      assert.strictEqual(filtered.items[0].id, 'del_1');
    });

    it('should throw NotFoundException if subscription belongs to another workspace', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.listDeliveries(workspaceB, sub.id);
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });
  });

  describe('getDeliveryById()', () => {
    it('should return full delivery details log', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      deliveriesDb.set('del_detail', {
        id: 'del_detail',
        subscriptionId: sub.id,
        eventId: 'ev_detail',
        eventType: 'message.created',
        payload: { event: 'message.created', text: 'hi' },
        status: 'DELIVERED',
        attemptCount: 1,
        responseStatus: 200,
        responseBody: '{"ok":true}',
        lastAttemptAt: new Date(),
        nextRetryAt: null,
        deliveredAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const detail = await service.getDeliveryById(workspaceA, sub.id, 'del_detail');
      assert.strictEqual(detail.id, 'del_detail');
      assert.strictEqual(detail.subscriptionId, sub.id);
      assert.strictEqual(detail.eventType, 'message.created');
      assert.strictEqual(detail.responseStatus, 200);
      assert.strictEqual(detail.responseBody, '{"ok":true}');
    });

    it('should throw NotFoundException for non-existent delivery', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
      });

      await assert.rejects(
        async () => {
          await service.getDeliveryById(workspaceA, sub.id, 'del_unknown');
        },
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          return true;
        },
      );
    });
  });

  describe('retryDelivery()', () => {
    it('should reset status to PENDING and re-enqueue delivery job', async () => {
      const sub = await service.create(workspaceA, {
        url: 'https://endpoint.com/webhook',
        subscriptions: [WebhookEventType.MESSAGE_CREATED],
        secretKey: 'key-123',
      });

      deliveriesDb.set('del_retry_target', {
        id: 'del_retry_target',
        subscriptionId: sub.id,
        eventId: 'ev_retry',
        eventType: 'message.created',
        payload: { event: 'message.created', data: { text: 'retry payload' } },
        status: 'FAILED',
        attemptCount: 3,
        responseStatus: 500,
        responseBody: 'Server down',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const retried = await service.retryDelivery(workspaceA, sub.id, 'del_retry_target');
      assert.strictEqual(retried.status, 'PENDING');
      assert.strictEqual(retried.nextRetryAt, null);

      assert.strictEqual(enqueuedJobs.length, 1);
      assert.strictEqual(enqueuedJobs[0].name, 'deliver-webhook');
      assert.strictEqual(enqueuedJobs[0].data.deliveryId, 'del_retry_target');
      assert.strictEqual(enqueuedJobs[0].data.url, 'https://endpoint.com/webhook');
      assert.strictEqual(enqueuedJobs[0].data.secretKey, 'key-123');
    });
  });
});
