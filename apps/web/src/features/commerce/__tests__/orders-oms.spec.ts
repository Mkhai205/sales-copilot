import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createOrderSchema,
  cancelOrderSchema,
  completeOrderSchema,
  listOrdersQuerySchema,
  OrderStatus,
  PaymentStatus,
  PaymentMethod,
} from '@sales-copilot/shared-contracts';
import * as commerceModule from '../index';
import { commerceApi } from '../api/commerce-client';

describe('Epic 2.2: OMS & Orders Management Web Spec', () => {
  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { url: string; options?: RequestInit }[] = [];

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

  describe('Public Barrel Exports in features/commerce', () => {
    it('should export all OMS components, hooks, and utilities through index.ts', () => {
      assert.ok(commerceModule.OrdersTable, 'OrdersTable should be exported');
      assert.ok(commerceModule.OrderDetailSheet, 'OrderDetailSheet should be exported');
      assert.ok(commerceModule.CreateOrderDialog, 'CreateOrderDialog should be exported');
      assert.ok(commerceModule.OrdersView, 'OrdersView should be exported');
      assert.ok(commerceModule.useCommerceOrders, 'useCommerceOrders should be exported');
      assert.ok(commerceModule.useCommerceOrdersList, 'useCommerceOrdersList should be exported');
      assert.ok(commerceModule.useCommerceOrder, 'useCommerceOrder should be exported');
      assert.ok(commerceModule.CommerceOrderForm, 'CommerceOrderForm should be exported');
      assert.ok(commerceModule.OrderStatusBadge, 'OrderStatusBadge should be exported');
      assert.ok(commerceModule.PaymentStatusBadge, 'PaymentStatusBadge should be exported');
    });
  });

  describe('commerceApi Order Lifecycle Client Methods', () => {
    const workspaceId = 'ws-orders-test-01';
    const orderId = 'ord-1234-5678';

    it('listOrders: should query orders with workspaceId header and filter query params', async () => {
      await commerceApi.listOrders(workspaceId, {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        search: 'Nguyen Van An',
        page: 2,
        limit: 15,
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders?`));
      assert.ok(call.url.includes('status=CONFIRMED'));
      assert.ok(call.url.includes('paymentStatus=PAID'));
      assert.ok(call.url.includes('page=2'));
      assert.ok(call.url.includes('limit=15'));
      const headers = call.options?.headers as Record<string, string>;
      assert.strictEqual(headers['X-Workspace-Id'], workspaceId);
    });

    it('getOrder: should query single order by ID', async () => {
      await commerceApi.getOrder(workspaceId, orderId);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders/${orderId}`));
    });

    it('createOrder: should send POST with create order payload', async () => {
      const payload = {
        contactId: '11111111-1111-4111-8111-111111111111',
        status: OrderStatus.DRAFT as const,
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

      await commerceApi.createOrder(workspaceId, payload);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders`));
      assert.strictEqual(JSON.parse(call.options?.body as string).confirmImmediately, true);
    });

    it('completeOrder: should send POST to :id/complete endpoint', async () => {
      await commerceApi.completeOrder(workspaceId, orderId, {
        notes: 'Đã hoàn tất đơn và nhận tiền COD',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders/${orderId}/complete`));
      assert.strictEqual(
        JSON.parse(call.options?.body as string).notes,
        'Đã hoàn tất đơn và nhận tiền COD',
      );
    });

    it('cancelOrder: should send POST to :id/cancel endpoint with cancelReason', async () => {
      await commerceApi.cancelOrder(workspaceId, orderId, {
        cancelReason: 'Khách hàng đổi ý muốn đổi sang mẫu khác',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders/${orderId}/cancel`));
      assert.strictEqual(
        JSON.parse(call.options?.body as string).cancelReason,
        'Khách hàng đổi ý muốn đổi sang mẫu khác',
      );
    });

    it('confirmOrder: should send POST to :id/confirm endpoint', async () => {
      await commerceApi.confirmOrder(workspaceId, orderId);
      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders/${orderId}/confirm`));
    });

    it('payOrder: should send POST to :id/pay endpoint', async () => {
      await commerceApi.payOrder(workspaceId, orderId, {
        paymentMethod: PaymentMethod.CASH,
        amount: 350000,
        notes: 'Thu tiền mặt tại quầy',
      });

      assert.strictEqual(fetchCalls.length, 1);
      const call = fetchCalls[0];
      assert.strictEqual(call.options?.method, 'POST');
      assert.ok(call.url.includes(`/workspaces/${workspaceId}/orders/${orderId}/pay`));
    });
  });

  describe('OMS Schema Validation Scenarios', () => {
    const contactId = '11111111-1111-4111-8111-111111111111';
    const productId = '22222222-2222-4222-8222-222222222222';
    const variantId = '33333333-3333-4333-8333-333333333333';

    it('should validate dual button flow: confirmImmediately = false (Lưu nháp)', () => {
      const parsed = createOrderSchema.safeParse({
        contactId,
        confirmImmediately: false,
        items: [{ productId, variantId, quantity: 1, unitPrice: 100000 }],
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.confirmImmediately, false);
      }
    });

    it('should validate dual button flow: confirmImmediately = true (Chốt đơn & Giữ kho)', () => {
      const parsed = createOrderSchema.safeParse({
        contactId,
        confirmImmediately: true,
        items: [{ productId, variantId, quantity: 1, unitPrice: 100000 }],
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.confirmImmediately, true);
      }
    });

    it('should validate completeOrderSchema with or without notes', () => {
      assert.strictEqual(completeOrderSchema.safeParse({}).success, true);
      assert.strictEqual(
        completeOrderSchema.safeParse({ notes: 'COD thanh toán đầy đủ' }).success,
        true,
      );
    });

    it('should validate cancelOrderSchema min length constraint', () => {
      assert.strictEqual(cancelOrderSchema.safeParse({ cancelReason: 'a' }).success, false);
      assert.strictEqual(
        cancelOrderSchema.safeParse({ cancelReason: 'Sai màu sắc sản phẩm' }).success,
        true,
      );
    });

    it('should validate listOrdersQuerySchema filters', () => {
      const parsed = listOrdersQuerySchema.safeParse({
        status: OrderStatus.SHIPPING,
        paymentStatus: PaymentStatus.PARTIALLY_PAID,
        search: '0988123456',
        page: '1',
        limit: '20',
      });
      assert.strictEqual(parsed.success, true);
      if (parsed.success) {
        assert.strictEqual(parsed.data.status, OrderStatus.SHIPPING);
        assert.strictEqual(parsed.data.paymentStatus, PaymentStatus.PARTIALLY_PAID);
        assert.strictEqual(parsed.data.search, '0988123456');
      }
    });
  });
});
