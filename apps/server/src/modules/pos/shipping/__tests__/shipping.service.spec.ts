import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  CarrierProvider,
  DomainEvent,
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { CustomCarrierAdapter } from '../adapters/custom.adapter';
import { GhnCarrierAdapter } from '../adapters/ghn.adapter';
import { GhtkCarrierAdapter } from '../adapters/ghtk.adapter';
import { ShippingService } from '../shipping.service';

describe('ShippingService (Logistics Carrier Adapters & Dispatch Pipeline)', () => {
  let service: ShippingService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let mockCredentialService: any;
  let customAdapter: CustomCarrierAdapter;
  let ghtkAdapter: GhtkCarrierAdapter;
  let ghnAdapter: GhnCarrierAdapter;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let ordersDb: Map<string, any>;
  let orderItemsDb: Map<string, any>;
  let variantsDb: Map<string, any>;
  let shippingAddressesDb: Map<string, any>;
  let inventoryTransactionsDb: Map<string, any>;
  let workspacesDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const userId = 'usr_dispatcher_1';

  const orderCodId = 'ord-cod-1111-4111-8111-111111111111';
  const orderPaidId = 'ord-paid-2222-4222-8222-222222222222';
  const orderDraftId = 'ord-draft-3333-4333-8333-333333333333';
  const varA = 'var_aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(() => {
    ordersDb = new Map();
    orderItemsDb = new Map();
    variantsDb = new Map();
    shippingAddressesDb = new Map();
    inventoryTransactionsDb = new Map();
    workspacesDb = new Map();
    emittedEvents = [];

    workspacesDb.set(ws1, {
      id: ws1,
      name: 'Workspace Alpha',
      settings: {},
    });

    workspacesDb.set(ws2, {
      id: ws2,
      name: 'Workspace Beta',
      settings: {},
    });

    // Seed Variant: stock = 10, reserved = 2 (for confirmed order)
    variantsDb.set(varA, {
      id: varA,
      workspaceId: ws1,
      name: 'Size M / Trắng',
      sku: 'OXFORD-M-WHT',
      stockQuantity: 10,
      reservedQuantity: 2,
    });

    // Seed COD Order (CONFIRMED)
    ordersDb.set(orderCodId, {
      id: orderCodId,
      workspaceId: ws1,
      displayId: 1001,
      orderNumber: 'ORD-20260909-1001',
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
      subtotal: 500000,
      totalAmount: 500000,
      paidAmount: 0,
      contactId: 'contact-1',
    });

    orderItemsDb.set('item-1', {
      id: 'item-1',
      workspaceId: ws1,
      orderId: orderCodId,
      variantId: varA,
      productName: 'Áo Sơ Mi Oxford',
      variantName: 'Size M / Trắng',
      sku: 'OXFORD-M-WHT',
      quantity: 2,
      unitPrice: 250000,
      totalPrice: 500000,
    });

    shippingAddressesDb.set(orderCodId, {
      id: 'addr-1',
      workspaceId: ws1,
      orderId: orderCodId,
      recipientName: 'Nguyễn Văn An',
      phoneNumber: '0988123456',
      streetAddress: '18 Tam Trinh',
      ward: 'Hoàng Văn Thụ',
      district: 'Hoàng Mai',
      province: 'Hà Nội',
      shippingCarrier: CarrierProvider.CUSTOM,
      trackingCode: null,
    });

    // Seed PAID Order (Prepaid via VietQR, stock was already deducted in M3: stock = 8, reserved = 0)
    ordersDb.set(orderPaidId, {
      id: orderPaidId,
      workspaceId: ws1,
      displayId: 1002,
      orderNumber: 'ORD-20260909-1002',
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
      subtotal: 500000,
      totalAmount: 500000,
      paidAmount: 500000,
      contactId: 'contact-2',
    });

    orderItemsDb.set('item-2', {
      id: 'item-2',
      workspaceId: ws1,
      orderId: orderPaidId,
      variantId: varA,
      productName: 'Áo Sơ Mi Oxford',
      variantName: 'Size M / Trắng',
      sku: 'OXFORD-M-WHT',
      quantity: 2,
      unitPrice: 250000,
      totalPrice: 500000,
    });

    shippingAddressesDb.set(orderPaidId, {
      id: 'addr-2',
      workspaceId: ws1,
      orderId: orderPaidId,
      recipientName: 'Trần Thị Bình',
      phoneNumber: '0912345678',
      streetAddress: '123 Cầu Giấy',
      ward: 'Dịch Vọng',
      district: 'Cầu Giấy',
      province: 'Hà Nội',
      shippingCarrier: CarrierProvider.GHTK,
      trackingCode: null,
    });

    // Seed DRAFT Order
    ordersDb.set(orderDraftId, {
      id: orderDraftId,
      workspaceId: ws1,
      displayId: 1003,
      orderNumber: 'ORD-20260909-1003',
      status: OrderStatus.DRAFT,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
      totalAmount: 250000,
      contactId: 'contact-3',
    });

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    mockCredentialService = {
      decrypt: (token: string) => ({ apiToken: 'decrypted-token', token }),
    };

    const clientMock: any = {
      workspace: {
        findFirst: async ({ where }: any) => workspacesDb.get(where.id) || null,
      },
      order: {
        findFirst: async ({ where, include }: any) => {
          for (const o of ordersDb.values()) {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            if (where.id && o.id !== where.id) continue;
            const res = { ...o };
            if (include?.items) {
              res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === o.id);
            }
            if (include?.shippingAddress) {
              res.shippingAddress = shippingAddressesDb.get(o.id) || null;
            }
            return res;
          }
          return null;
        },
        update: async ({ where, data, include }: any) => {
          const existing = ordersDb.get(where.id);
          if (!existing) throw new Error('Order not found');
          const updated = { ...existing, ...data, updatedAt: new Date() };
          ordersDb.set(where.id, updated);
          const res = { ...updated };
          if (include?.items) {
            res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === where.id);
          }
          if (include?.shippingAddress) {
            res.shippingAddress = shippingAddressesDb.get(where.id) || null;
          }
          return res;
        },
      },
      shippingAddress: {
        update: async ({ where, data }: any) => {
          for (const [k, v] of shippingAddressesDb.entries()) {
            if (v.id === where.id) {
              const updated = { ...v, ...data, updatedAt: new Date() };
              shippingAddressesDb.set(k, updated);
              return updated;
            }
          }
          return null;
        },
        create: async ({ data }: any) => {
          const id = `addr-${Date.now()}`;
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          shippingAddressesDb.set(data.orderId, rec);
          return rec;
        },
      },
      productVariant: {
        findFirst: async ({ where }: any) => {
          for (const v of variantsDb.values()) {
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            if (where.id && v.id !== where.id) continue;
            return { ...v };
          }
          return null;
        },
        findFirstOrThrow: async ({ where }: any) => {
          const v = await clientMock.productVariant.findFirst({ where });
          if (!v) throw new Error('Variant not found');
          return v;
        },
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          const id = `inv-tx-${inventoryTransactionsDb.size + 1}`;
          const rec = { id, ...data, createdAt: new Date() };
          inventoryTransactionsDb.set(id, rec);
          return rec;
        },
      },
      $executeRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
        // Parse raw SQL decrement: stockQuantity = stockQuantity - qty, reservedQuantity = reservedQuantity - qty
        const qty = values[0];
        const varId = values[2];
        const wsId = values[3];
        const v = variantsDb.get(varId);
        if (!v || v.workspaceId !== wsId || v.reservedQuantity < qty) {
          return 0;
        }
        v.stockQuantity -= qty;
        v.reservedQuantity -= qty;
        return 1;
      },
    };

    mockPrismaService = {
      client: clientMock,
      getClient: () => clientMock,
      order: clientMock.order,
      workspace: clientMock.workspace,
      runInTransaction: async (cb: any) => {
        const postHooks: Array<() => void> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (fn: () => void) => postHooks.push(fn),
        };
        const result = await cb(ctx);
        for (const h of postHooks) h();
        return result;
      },
    };

    customAdapter = new CustomCarrierAdapter();
    ghtkAdapter = new GhtkCarrierAdapter();
    ghnAdapter = new GhnCarrierAdapter();

    service = new ShippingService(
      mockPrismaService,
      mockEventEmitter as any,
      mockCredentialService,
      customAdapter,
      ghtkAdapter,
      ghnAdapter,
    );
  });

  describe('calculateFee', () => {
    it('should calculate shipping fee correctly using CustomCarrierAdapter', async () => {
      const quote = await service.calculateFee(ws1, {
        carrier: CarrierProvider.CUSTOM,
        senderDistrict: 'Hoàng Mai',
        senderProvince: 'Hà Nội',
        recipientDistrict: 'Cầu Giấy',
        recipientProvince: 'Hà Nội',
        weightInGrams: 500,
        insuredValue: 500000,
      });

      assert.strictEqual(quote.carrier, CarrierProvider.CUSTOM);
      assert.strictEqual(typeof quote.fee, 'number');
      assert.strictEqual(quote.fee > 0, true);
    });

    it('should quote GHTK fee with fallback when API token is not configured', async () => {
      const quote = await service.calculateFee(ws1, {
        carrier: CarrierProvider.GHTK,
        senderDistrict: 'Hoàng Mai',
        senderProvince: 'Hà Nội',
        recipientDistrict: 'Quận 1',
        recipientProvince: 'Hồ Chí Minh',
        weightInGrams: 800,
        insuredValue: 1200000,
      });

      assert.strictEqual(quote.carrier, CarrierProvider.GHTK);
      assert.strictEqual(quote.fee >= 35000, true);
    });
  });

  describe('dispatchOrder', () => {
    it('should dispatch COD order and deduct physical stock (COMMIT_SALE)', async () => {
      const initialVariant = variantsDb.get(varA);
      assert.strictEqual(initialVariant.stockQuantity, 10);
      assert.strictEqual(initialVariant.reservedQuantity, 2);

      const dispatched = await service.dispatchOrder(
        ws1,
        orderCodId,
        { carrier: CarrierProvider.CUSTOM, note: 'Giao giờ hành chính' },
        userId,
      );

      assert.strictEqual(dispatched.status, OrderStatus.SHIPPING);
      assert.strictEqual(dispatched.fulfillmentStatus, FulfillmentStatus.SHIPPED);
      assert.strictEqual(dispatched.shippingAddress?.shippingCarrier, CarrierProvider.CUSTOM);
      assert.ok(dispatched.shippingAddress?.trackingCode);
      assert.strictEqual(dispatched.shippingAddress?.trackingCode.startsWith('INTERNAL-'), true);

      // Verify stock deduction for COD order: stock 10 -> 8, reserved 2 -> 0
      const updatedVariant = variantsDb.get(varA);
      assert.strictEqual(updatedVariant.stockQuantity, 8);
      assert.strictEqual(updatedVariant.reservedQuantity, 0);

      // Verify COMMIT_SALE inventory ledger transaction
      const invTxs = Array.from(inventoryTransactionsDb.values());
      assert.strictEqual(invTxs.length, 1);
      assert.strictEqual(invTxs[0].type, InventoryTransactionType.COMMIT_SALE);
      assert.strictEqual(invTxs[0].quantity, 2);

      // Verify emitted events
      const shippedEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_SHIPPED);
      assert.ok(shippedEvent);
      assert.strictEqual(shippedEvent.payload.orderId, orderCodId);
      assert.strictEqual(shippedEvent.payload.workspaceId, ws1);
    });

    it('should NOT deduct inventory twice when dispatching a PAID order (Anti-Double-Commit Invariant)', async () => {
      // For prepaid order, stock was already deducted in M3 upon payment.
      // Variant currently has stock = 10, reserved = 2 (from other orders).
      const initialVariant = variantsDb.get(varA);
      const initialStock = initialVariant.stockQuantity;
      const initialReserved = initialVariant.reservedQuantity;

      const dispatched = await service.dispatchOrder(
        ws1,
        orderPaidId,
        { carrier: CarrierProvider.GHTK },
        userId,
      );

      assert.strictEqual(dispatched.status, OrderStatus.SHIPPING);
      assert.strictEqual(dispatched.fulfillmentStatus, FulfillmentStatus.SHIPPED);
      assert.ok(dispatched.shippingAddress?.trackingCode);

      // INVARIANT CHECK: Stock MUST NOT be deducted again
      const afterVariant = variantsDb.get(varA);
      assert.strictEqual(afterVariant.stockQuantity, initialStock);
      assert.strictEqual(afterVariant.reservedQuantity, initialReserved);

      // INVARIANT CHECK: No new COMMIT_SALE transaction recorded for this PAID order dispatch
      const invTxs = Array.from(inventoryTransactionsDb.values()).filter(
        tx => tx.orderId === orderPaidId,
      );
      assert.strictEqual(invTxs.length, 0);

      // Event ORDER_SHIPPED is still emitted
      const shippedEvent = emittedEvents.find(
        e => e.event === DomainEvent.ORDER_SHIPPED && e.payload.orderId === orderPaidId,
      );
      assert.ok(shippedEvent);
    });

    it('should reject dispatching a DRAFT order with ORDER_NOT_CONFIRMED', async () => {
      await assert.rejects(
        async () => {
          await service.dispatchOrder(ws1, orderDraftId, { carrier: CarrierProvider.CUSTOM });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.getResponse().code, 'ORDER_NOT_CONFIRMED');
          return true;
        },
      );
    });

    it('should enforce multi-tenancy isolation: cannot dispatch order in another workspace', async () => {
      await assert.rejects(
        async () => {
          // Attempt to dispatch orderCodId (ws1) using ws2 context
          await service.dispatchOrder(ws2, orderCodId, { carrier: CarrierProvider.CUSTOM });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.getResponse().code, 'ORDER_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('trackOrder and cancelOrderShipment', () => {
    it('should track dispatched order successfully', async () => {
      // First dispatch
      await service.dispatchOrder(ws1, orderCodId, { carrier: CarrierProvider.CUSTOM });

      const tracking = await service.trackOrder(ws1, orderCodId);
      assert.strictEqual(tracking.carrier, CarrierProvider.CUSTOM);
      assert.strictEqual(tracking.status, 'IN_TRANSIT');
      assert.strictEqual(tracking.timeline.length > 0, true);
    });

    it('should throw ORDER_NOT_SHIPPED when tracking undispatched order', async () => {
      await assert.rejects(
        async () => {
          await service.trackOrder(ws1, orderDraftId);
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.getResponse().code, 'ORDER_NOT_SHIPPED');
          return true;
        },
      );
    });

    it('should cancel shipment successfully', async () => {
      await service.dispatchOrder(ws1, orderCodId, { carrier: CarrierProvider.CUSTOM });
      const cancelled = await service.cancelOrderShipment(ws1, orderCodId);
      assert.strictEqual(cancelled, true);
    });
  });
});
