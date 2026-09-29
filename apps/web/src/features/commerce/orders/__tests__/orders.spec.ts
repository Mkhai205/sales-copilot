import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ordersApi } from '../api/orders';
import { formatVND } from '../../shared/lib/currency';
import { recipientInfoSchema } from '../components/recipient-info-form';
import { OrderStatus, PaymentStatus, PaymentMethod } from '@sales-copilot/shared-contracts';

describe('Commerce Orders OMS Test Suite (Phase 5)', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];
  const workspaceId = 'ws-orders-test-01';
  const orderId = 'ord-1234-5678';

  beforeEach(() => {
    fetchCalls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls.push({ url: String(input), options: init });
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('ordersApi Client Methods', () => {
    it('listOrders: should query orders with workspaceId header and filter query params', async () => {
      await ordersApi.listOrders(workspaceId, {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        search: 'Nguyen Van An',
        page: 2,
        limit: 15,
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/orders?`));
      assert.ok(call.url.includes('status=CONFIRMED'));
      assert.ok(call.url.includes('paymentStatus=PAID'));
      assert.ok(call.url.includes('page=2'));
      assert.ok(call.url.includes('limit=15'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getOrder: should query single order by ID with X-Workspace-Id header', async () => {
      await ordersApi.getOrder(workspaceId, orderId);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/orders/${orderId}`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('createOrder: should send POST with create order payload and X-Workspace-Id header', async () => {
      const payload = {
        contactId: '11111111-1111-4111-8111-111111111111',
        status: OrderStatus.DRAFT,
        confirmImmediately: true,
        items: [
          {
            productId: '22222222-2222-4222-8222-222222222222',
            variantId: '33333333-3333-4333-8333-333333333333',
            quantity: 2,
            unitPrice: 200000,
          },
        ],
      };

      await ordersApi.createOrder(workspaceId, payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/orders`));
      assert.strictEqual(JSON.parse(call.options?.body as string).confirmImmediately, true);
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('completeOrder: should send POST to :id/complete endpoint with X-Workspace-Id header', async () => {
      await ordersApi.completeOrder(workspaceId, orderId, {
        notes: 'Đã hoàn tất đơn và nhận tiền COD',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/orders/${orderId}/complete`));
      assert.strictEqual(
        JSON.parse(call.options?.body as string).notes,
        'Đã hoàn tất đơn và nhận tiền COD',
      );
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('cancelOrder: should send POST to :id/cancel endpoint with cancelReason and X-Workspace-Id header', async () => {
      await ordersApi.cancelOrder(workspaceId, orderId, {
        cancelReason: 'Khách hàng đổi ý muốn đổi sang mẫu khác',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/orders/${orderId}/cancel`));
      assert.strictEqual(
        JSON.parse(call.options?.body as string).cancelReason,
        'Khách hàng đổi ý muốn đổi sang mẫu khác',
      );
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('confirmOrder: should send POST to :id/confirm endpoint with X-Workspace-Id header', async () => {
      await ordersApi.confirmOrder(workspaceId, orderId);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/orders/${orderId}/confirm`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('payOrder: should send POST to :id/pay endpoint with X-Workspace-Id header', async () => {
      await ordersApi.payOrder(workspaceId, orderId, {
        paymentMethod: PaymentMethod.CASH,
        amount: 350000,
        notes: 'Thu tiền mặt tại quầy',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/orders/${orderId}/pay`));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });
  });

  describe('Domain Helpers & Form Schemas', () => {
    it('formatVND should format both numbers and numeric strings consistently', () => {
      const formattedNum = formatVND(150000);
      const formattedStr = formatVND('150000');
      assert.strictEqual(formattedNum, formattedStr);
      assert.ok(formattedNum.includes('150.000'));
    });

    it('recipientInfoSchema should validate recipient data with defaults', () => {
      const parsed = recipientInfoSchema.safeParse({
        recipientName: 'Nguyen Van A',
        phoneNumber: '0988123456',
        streetAddress: '123 Le Loi',
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.recipientName, 'Nguyen Van A');
        assert.strictEqual(parsed.data.ward, '');
      }
    });
  });
});
