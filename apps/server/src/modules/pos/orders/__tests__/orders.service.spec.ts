import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  DiscountType,
  DomainEvent,
  InventoryTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { OrdersService } from '../orders.service';

describe('OrdersService (Order Lifecycle & Anti-Overselling Engine)', () => {
  let service: OrdersService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let contactsDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let productsDb: Map<string, any>;
  let variantsDb: Map<string, any>;
  let ordersDb: Map<string, any>;
  let orderItemsDb: Map<string, any>;
  let shippingAddressesDb: Map<string, any>;
  let paymentTransactionsDb: Map<string, any>;
  let inventoryTransactionsDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const userId = 'usr_agent_1';

  const contact1 = '11111111-1111-4111-8111-111111111111';
  const contactWs2 = '22222222-2222-4222-8222-222222222222';
  const conversation1 = '33333333-3333-4333-8333-333333333333';

  const prod1 = 'prod_1111-1111-4111-8111-111111111111';
  const varA = 'var_aaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const varB = 'var_bbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  beforeEach(() => {
    contactsDb = new Map();
    conversationsDb = new Map();
    productsDb = new Map();
    variantsDb = new Map();
    ordersDb = new Map();
    orderItemsDb = new Map();
    shippingAddressesDb = new Map();
    paymentTransactionsDb = new Map();
    inventoryTransactionsDb = new Map();
    emittedEvents = [];

    // Seed Contact
    contactsDb.set(contact1, {
      id: contact1,
      workspaceId: ws1,
      name: 'Nguyễn Văn An',
      phoneNumber: '0988121234',
    });

    contactsDb.set(contactWs2, {
      id: contactWs2,
      workspaceId: ws2,
      name: 'Trần Thị Tenant 2',
      phoneNumber: '0901234567',
    });

    // Seed Conversation
    conversationsDb.set(conversation1, {
      id: conversation1,
      workspaceId: ws1,
      contactId: contact1,
      displayId: 101,
    });

    // Seed Product & Variants
    productsDb.set(prod1, {
      id: prod1,
      workspaceId: ws1,
      name: 'Áo Sơ Mi Oxford',
      sku: 'SOMI-OXFORD',
      basePrice: 350000,
    });

    variantsDb.set(varA, {
      id: varA,
      productId: prod1,
      workspaceId: ws1,
      name: 'Size M / Trắng',
      sku: 'OXFORD-M-WHT',
      price: 350000,
      costPrice: 180000,
      stockQuantity: 10,
      reservedQuantity: 0,
    });

    variantsDb.set(varB, {
      id: varB,
      productId: prod1,
      workspaceId: ws1,
      name: 'Size L / Xanh',
      sku: 'OXFORD-L-BLU',
      price: 350000,
      costPrice: 180000,
      stockQuantity: 1, // Only 1 unit available for concurrency testing
      reservedQuantity: 0,
    });

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    clientMock = {
      contact: {
        findFirst: async ({ where }: any) => {
          for (const c of contactsDb.values()) {
            if (where.id && c.id !== where.id) continue;
            if (where.workspaceId && c.workspaceId !== where.workspaceId) continue;
            return { ...c };
          }
          return null;
        },
      },
      conversation: {
        findFirst: async ({ where }: any) => {
          for (const conv of conversationsDb.values()) {
            if (where.id && conv.id !== where.id) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            return { ...conv };
          }
          return null;
        },
      },
      productVariant: {
        findFirst: async ({ where, include }: any) => {
          for (const v of variantsDb.values()) {
            if (where.id && v.id !== where.id) continue;
            if (where.productId && v.productId !== where.productId) continue;
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;

            const res = { ...v };
            if (include?.product) {
              res.product = productsDb.get(v.productId);
            }
            return res;
          }
          return null;
        },
        findFirstOrThrow: async ({ where }: any) => {
          const res = await clientMock.productVariant.findFirst({ where });
          if (!res) throw new Error('Variant not found');
          return res;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [id, v] of variantsDb.entries()) {
            if (where.id && v.id !== where.id) continue;
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            variantsDb.set(id, { ...v, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      order: {
        findFirst: async ({ where, include }: any) => {
          for (const o of ordersDb.values()) {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            if (where.id && o.id !== where.id) continue;
            if (where.orderNumber && o.orderNumber !== where.orderNumber) continue;
            if (where.displayId !== undefined && o.displayId !== where.displayId) continue;
            if (where.OR && Array.isArray(where.OR)) {
              const matches = where.OR.some((cond: any) => {
                if (cond.id && o.id === cond.id) return true;
                if (cond.orderNumber && o.orderNumber === cond.orderNumber) return true;
                if (cond.displayId !== undefined && o.displayId === cond.displayId) return true;
                return false;
              });
              if (!matches) continue;
            }

            const res = { ...o };
            if (include?.items) {
              res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === o.id);
            }
            if (include?.shippingAddress) {
              res.shippingAddress = shippingAddressesDb.get(o.id) || null;
            }
            if (include?.paymentTransactions) {
              res.paymentTransactions = Array.from(paymentTransactionsDb.values()).filter(
                p => p.orderId === o.id,
              );
            }
            return res;
          }
          return null;
        },
        findFirstOrThrow: async ({ where, include }: any) => {
          const res = await clientMock.order.findFirst({ where, include });
          if (!res) throw new Error('Order not found');
          return res;
        },
        findMany: async ({ where, skip, take, _orderBy }: any) => {
          let list = Array.from(ordersDb.values()).filter(o => {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) return false;
            if (where.conversationId && o.conversationId !== where.conversationId) return false;
            if (where.contactId && o.contactId !== where.contactId) return false;
            if (where.status && o.status !== where.status) return false;
            if (where.paymentStatus && o.paymentStatus !== where.paymentStatus) return false;
            return true;
          });

          if (skip !== undefined && take !== undefined) {
            list = list.slice(skip, skip + take);
          }

          return list.map(o => ({
            ...o,
            items: Array.from(orderItemsDb.values()).filter(i => i.orderId === o.id),
            shippingAddress: shippingAddressesDb.get(o.id) || null,
            paymentTransactions: Array.from(paymentTransactionsDb.values()).filter(
              p => p.orderId === o.id,
            ),
          }));
        },
        count: async ({ where }: any) => {
          const items = await clientMock.order.findMany({ where });
          return items.length;
        },
        create: async ({ data }: any) => {
          const id = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const displayId = ordersDb.size + 1001;
          const record = {
            id,
            displayId,
            orderNumber: data.orderNumber,
            workspaceId: data.workspaceId,
            conversationId: data.conversationId,
            contactId: data.contactId,
            leadId: data.leadId,
            opportunityId: data.opportunityId,
            createdById: data.createdById,
            status: data.status,
            paymentStatus: data.paymentStatus,
            fulfillmentStatus: data.fulfillmentStatus,
            subtotal: data.subtotal,
            discountAmount: data.discountAmount,
            discountType: data.discountType,
            discountReason: data.discountReason,
            shippingFee: data.shippingFee,
            taxAmount: data.taxAmount,
            totalAmount: data.totalAmount,
            paidAmount: data.paidAmount,
            currency: data.currency,
            customerNotes: data.customerNotes,
            internalNotes: data.internalNotes,
            metadata: data.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          ordersDb.set(id, record);

          if (data.items?.create) {
            for (const item of data.items.create) {
              const itemId = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              orderItemsDb.set(itemId, {
                id: itemId,
                orderId: id,
                ...item,
                createdAt: new Date(),
                updatedAt: new Date(),
              });
            }
          }

          return record;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [id, o] of ordersDb.entries()) {
            if (where.id && o.id !== where.id) continue;
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            ordersDb.set(id, { ...o, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      orderItem: {
        deleteMany: async ({ where }: any) => {
          let count = 0;
          for (const [id, item] of Array.from(orderItemsDb.entries())) {
            if (where.orderId && item.orderId !== where.orderId) continue;
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            orderItemsDb.delete(id);
            count++;
          }
          return { count };
        },
        createMany: async ({ data }: any) => {
          for (const item of data) {
            const id = `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            orderItemsDb.set(id, { id, ...item, createdAt: new Date(), updatedAt: new Date() });
          }
          return { count: data.length };
        },
      },
      shippingAddress: {
        create: async ({ data }: any) => {
          const id = `sa_${Date.now()}`;
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          shippingAddressesDb.set(data.orderId, record);
          return record;
        },
        deleteMany: async ({ where }: any) => {
          let count = 0;
          if (where.orderId && shippingAddressesDb.has(where.orderId)) {
            shippingAddressesDb.delete(where.orderId);
            count++;
          }
          return { count };
        },
      },
      paymentTransaction: {
        create: async ({ data }: any) => {
          const id = `ptx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          paymentTransactionsDb.set(id, record);
          return record;
        },
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = { id, ...data, createdAt: new Date() };
          inventoryTransactionsDb.set(id, record);
          return record;
        },
      },
      $executeRaw: async (strings: any, ...values: any[]) => {
        const queryText = Array.isArray(strings) ? strings.join('?') : String(strings);

        if (queryText.includes('"reservedQuantity" = "reservedQuantity" +')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          const available = variant.stockQuantity - variant.reservedQuantity;
          if (available >= qty) {
            variant.reservedQuantity += qty;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (
          queryText.includes('"stockQuantity" -') &&
          queryText.includes('"reservedQuantity" -')
        ) {
          const [qtyStock, qtyReserved, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          if (variant.stockQuantity >= qtyStock && variant.reservedQuantity >= qtyReserved) {
            variant.stockQuantity -= qtyStock;
            variant.reservedQuantity -= qtyReserved;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (
          queryText.includes('"stockQuantity" -') &&
          !queryText.includes('"reservedQuantity" -')
        ) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          const available = variant.stockQuantity - variant.reservedQuantity;
          if (available >= qty) {
            variant.stockQuantity -= qty;
            variantsDb.set(varId, variant);
            return 1;
          }
          return 0;
        } else if (queryText.includes('GREATEST(0, "reservedQuantity" -')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          variant.reservedQuantity = Math.max(0, variant.reservedQuantity - qty);
          variantsDb.set(varId, variant);
          return 1;
        }

        return 0;
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      client: clientMock,
      runInTransaction: async (cb: any) => {
        const postHooks: Array<() => any> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (hook: () => any) => postHooks.push(hook),
        };
        const result = await cb(ctx);
        for (const hook of postHooks) {
          await hook();
        }
        return result;
      },
    };

    service = new OrdersService(mockPrismaService, mockEventEmitter);
  });

  describe('createOrder', () => {
    it('should create order draft with financial totals and item snapshots', async () => {
      const order = await service.createOrder(
        ws1,
        {
          contactId: contact1,
          conversationId: conversation1,
          items: [
            {
              productId: prod1,
              variantId: varA,
              quantity: 2,
              unitPrice: 350000,
              discountAmount: 20000,
            },
          ],
          discountAmount: 50000,
          shippingFee: 30000,
          shippingAddress: {
            recipientName: 'Nguyễn Văn An',
            phoneNumber: '0988121234',
            streetAddress: 'Số 45 ngõ 120 Trường Chinh',
            ward: 'Phương Mai',
            district: 'Đống Đa',
            province: 'Hà Nội',
          },
        },
        userId,
      );

      assert.strictEqual(order.workspaceId, ws1);
      assert.strictEqual(order.status, OrderStatus.DRAFT);
      assert.strictEqual(order.paymentStatus, PaymentStatus.UNPAID);
      assert.strictEqual(order.subtotal, 700000); // 2 * 350000
      assert.strictEqual(order.discountAmount, 50000);
      assert.strictEqual(order.shippingFee, 30000);
      assert.strictEqual(order.totalAmount, 680000); // 700000 - 50000 + 30000
      assert.ok(order.orderNumber.startsWith('ORD-'));
      assert.strictEqual(order.items?.length, 1);
      assert.strictEqual(order.items?.[0].productName, 'Áo Sơ Mi Oxford');
      assert.strictEqual(order.items?.[0].variantName, 'Size M / Trắng');

      // Verify physical and reserved stock remain untouched in DRAFT
      const v = variantsDb.get(varA);
      assert.strictEqual(v.stockQuantity, 10);
      assert.strictEqual(v.reservedQuantity, 0);

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.ORDER_CREATED);
    });

    it('should reject order creation with invalid contact in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.createOrder(ws1, {
            contactId: 'non-existent-contact',
            items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CONTACT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('confirmOrder & Anti-Overselling Concurrency Guard', () => {
    let draftOrder1: any;
    let draftOrder2: any;

    beforeEach(async () => {
      draftOrder1 = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varB, quantity: 1, unitPrice: 350000 }],
      });

      draftOrder2 = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varB, quantity: 1, unitPrice: 350000 }],
      });

      emittedEvents = [];
    });

    it('should successfully confirm order and increment reservedQuantity (Model A)', async () => {
      const confirmed = await service.confirmOrder(ws1, draftOrder1.id, userId);

      assert.strictEqual(confirmed.status, OrderStatus.CONFIRMED);
      assert.ok(confirmed.confirmedAt);

      // Physical stock remains unchanged; reservedQuantity increments to 1
      const v = variantsDb.get(varB);
      assert.strictEqual(v.stockQuantity, 1);
      assert.strictEqual(v.reservedQuantity, 1);

      // Verify inventory transaction ledger recorded RESERVATION
      assert.strictEqual(inventoryTransactionsDb.size, 1);
      const invTx = Array.from(inventoryTransactionsDb.values())[0];
      assert.strictEqual(invTx.type, InventoryTransactionType.RESERVATION);
      assert.strictEqual(invTx.quantity, 1);
      assert.strictEqual(invTx.previousReserved, 0);
      assert.strictEqual(invTx.newReserved, 1);

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.ORDER_CONFIRMED);
    });

    it('should block race-condition oversell when 2 concurrent orders compete for 1 unit', async () => {
      // Confirm first order -> succeeds, consumes the 1 available unit
      await service.confirmOrder(ws1, draftOrder1.id, userId);

      // Attempting to confirm second order must fail with INSUFFICIENT_STOCK
      await assert.rejects(
        async () => {
          await service.confirmOrder(ws1, draftOrder2.id, userId);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INSUFFICIENT_STOCK');
          assert.strictEqual(err.response?.details?.availableStock, 0);
          return true;
        },
      );

      // Verify variant reservedQuantity never exceeded physical stock
      const v = variantsDb.get(varB);
      assert.strictEqual(v.stockQuantity, 1);
      assert.strictEqual(v.reservedQuantity, 1);
    });

    it('should simulate 10 concurrent requests for 1 unit yielding exactly 1 success and 9 rejections', async () => {
      // Create 10 draft orders competing for varB (stock: 1)
      const orders = await Promise.all(
        Array.from({ length: 10 }).map(() =>
          service.createOrder(ws1, {
            contactId: contact1,
            items: [{ productId: prod1, variantId: varB, quantity: 1, unitPrice: 350000 }],
          }),
        ),
      );

      // Attempt parallel confirmation
      const results = await Promise.allSettled(
        orders.map(o => service.confirmOrder(ws1, o.id, userId)),
      );

      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      assert.strictEqual(fulfilled.length, 1);
      assert.strictEqual(rejected.length, 9);

      // Variant inventory invariant holds: reserved = 1 <= stock = 1
      const v = variantsDb.get(varB);
      assert.strictEqual(v.stockQuantity, 1);
      assert.strictEqual(v.reservedQuantity, 1);
    });
  });

  describe('cancelOrder', () => {
    it('should release reserved inventory when cancelling a CONFIRMED order', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 3, unitPrice: 350000 }],
      });

      await service.confirmOrder(ws1, order.id, userId);

      // Verify reservedQuantity is 3
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 3);

      emittedEvents = [];

      // Cancel order
      const cancelled = await service.cancelOrder(
        ws1,
        order.id,
        { cancelReason: 'Khách không có nhu cầu nữa' },
        userId,
      );

      assert.strictEqual(cancelled.status, OrderStatus.CANCELLED);
      assert.strictEqual(cancelled.cancelReason, 'Khách không có nhu cầu nữa');

      // Reserved quantity must be restored to 0
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 0);

      // Ledger must contain RELEASE_RESERVATION
      const releaseTx = Array.from(inventoryTransactionsDb.values()).find(
        tx => tx.type === InventoryTransactionType.RELEASE_RESERVATION,
      );
      assert.ok(releaseTx);
      assert.strictEqual(releaseTx.quantity, 3);
      assert.strictEqual(releaseTx.previousReserved, 3);
      assert.strictEqual(releaseTx.newReserved, 0);

      // Domain events emitted: INVENTORY_UPDATED and ORDER_CANCELLED
      assert.strictEqual(emittedEvents.length, 2);
      const invEvent = emittedEvents.find(e => e.event === DomainEvent.INVENTORY_UPDATED);
      assert.ok(invEvent);
      assert.strictEqual(invEvent.payload.variantId, varA);
      assert.strictEqual(invEvent.payload.newReserved, 0);

      const cancelEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_CANCELLED);
      assert.ok(cancelEvent);
      assert.strictEqual(cancelEvent.payload.releasedStock, true);
    });

    it('should reject cancelling an already CANCELLED order', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
      });

      await service.cancelOrder(ws1, order.id, { cancelReason: 'First cancellation' });

      await assert.rejects(
        async () => {
          await service.cancelOrder(ws1, order.id, { cancelReason: 'Second cancellation' });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'ORDER_NOT_CANCELLABLE');
          return true;
        },
      );
    });
  });

  describe('payOrder', () => {
    it('should record payment and commit sale from CONFIRMED order', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 2, unitPrice: 350000 }],
      });

      await service.confirmOrder(ws1, order.id, userId);

      // Before pay: stock = 10, reserved = 2
      assert.strictEqual(variantsDb.get(varA).stockQuantity, 10);
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 2);

      emittedEvents = [];

      const paidOrder = await service.payOrder(
        ws1,
        order.id,
        {
          paymentMethod: PaymentMethod.CASH,
          amount: 700000,
          notes: 'Khách thanh toán tại quầy',
        },
        userId,
      );

      assert.strictEqual(paidOrder.status, OrderStatus.PAID);
      assert.strictEqual(paidOrder.paymentStatus, PaymentStatus.PAID);
      assert.strictEqual(paidOrder.paidAmount, 700000);

      // After COMMIT_SALE: stock reduced from 10 to 8, reserved reduced from 2 to 0
      assert.strictEqual(variantsDb.get(varA).stockQuantity, 8);
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 0);

      // Verify payment transaction created
      assert.strictEqual(paymentTransactionsDb.size, 1);

      // Verify domain events emitted: INVENTORY_UPDATED and ORDER_PAID
      assert.strictEqual(emittedEvents.length, 2);
      const invEv = emittedEvents.find(e => e.event === DomainEvent.INVENTORY_UPDATED);
      assert.ok(invEv);
      assert.strictEqual(invEv.payload.variantId, varA);
      assert.strictEqual(invEv.payload.newStock, 8);
      assert.strictEqual(invEv.payload.newReserved, 0);

      const paidEv = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
      assert.ok(paidEv);
    });

    it('should handle partial payment: transition to CONFIRMED + PARTIALLY_PAID and emit ORDER_PARTIALLY_PAID', async () => {
      // Create DRAFT order: 2 units * 350k = 700k
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 2, unitPrice: 350000 }],
      });

      emittedEvents = [];

      // Partial deposit of 300k (less than 700k)
      const partialRes = await service.payOrder(
        ws1,
        order.id,
        {
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: 300000,
          transactionCode: 'TX_DEPOSIT_01',
          notes: 'Đặt cọc 300k',
        },
        userId,
      );

      // Order should transition to CONFIRMED (not PAID), with PARTIALLY_PAID paymentStatus
      assert.strictEqual(partialRes.status, OrderStatus.CONFIRMED);
      assert.strictEqual(partialRes.paymentStatus, PaymentStatus.PARTIALLY_PAID);
      assert.strictEqual(partialRes.paidAmount, 300000);

      // Inventory should be reserved (stock remains 10, reserved becomes 2)
      assert.strictEqual(variantsDb.get(varA).stockQuantity, 10);
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 2);

      // Event emitted must be ORDER_PARTIALLY_PAID
      const partialEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PARTIALLY_PAID);
      assert.ok(partialEvent);
      assert.strictEqual(partialEvent.payload.paidAmount, 300000);
      assert.strictEqual(partialEvent.payload.remainingAmount, 400000);

      emittedEvents = [];

      // Second installment: paying the remaining 400k
      const finalRes = await service.payOrder(
        ws1,
        order.id,
        {
          paymentMethod: PaymentMethod.CASH,
          amount: 400000,
          notes: 'Thanh toán nốt số dư',
        },
        userId,
      );

      // Now order is fully paid: status PAID, paymentStatus PAID
      assert.strictEqual(finalRes.status, OrderStatus.PAID);
      assert.strictEqual(finalRes.paymentStatus, PaymentStatus.PAID);
      assert.strictEqual(finalRes.paidAmount, 700000);

      // Sale committed: stock 10 -> 8, reserved 2 -> 0
      assert.strictEqual(variantsDb.get(varA).stockQuantity, 8);
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 0);

      const paidEvent = emittedEvents.find(e => e.event === DomainEvent.ORDER_PAID);
      assert.ok(paidEvent);
    });

    it('should reject direct payment of DRAFT order if stock is insufficient', async () => {
      // varB has only 1 in stock
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varB, quantity: 2, unitPrice: 350000 }],
      });

      await assert.rejects(
        async () => {
          await service.payOrder(ws1, order.id, {
            paymentMethod: PaymentMethod.CASH,
            amount: 700000,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INSUFFICIENT_STOCK');
          return true;
        },
      );
    });

    it('should sort line items by variantId ascending to prevent deadlocks', async () => {
      // Create order with line items in reverse alphabetical order: varB then varA
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [
          { productId: prod1, variantId: varB, quantity: 1, unitPrice: 350000 },
          { productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 },
        ],
      });

      // Confirm order executes without deadlock or ordering error
      const confirmed = await service.confirmOrder(ws1, order.id, userId);
      assert.strictEqual(confirmed.status, OrderStatus.CONFIRMED);
      assert.strictEqual(variantsDb.get(varA).reservedQuantity, 1);
      assert.strictEqual(variantsDb.get(varB).reservedQuantity, 1);
    });
  });

  describe('getOrderById', () => {
    it('should retrieve order by UUID, orderNumber, and displayId strictly scoped to workspace', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
      });

      // 1. Lookup by UUID
      const byUuid = await service.getOrderById(ws1, order.id);
      assert.strictEqual(byUuid.id, order.id);

      // 2. Lookup by orderNumber
      const byOrderNum = await service.getOrderById(ws1, order.orderNumber);
      assert.strictEqual(byOrderNum.id, order.id);

      // 3. Lookup by displayId
      const byDisplayId = await service.getOrderById(ws1, String(order.displayId));
      assert.strictEqual(byDisplayId.id, order.id);

      // 4. Cross-tenant isolation check: Tenant 2 cannot access Tenant 1 order
      await assert.rejects(
        async () => {
          await service.getOrderById(ws2, order.id);
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'ORDER_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('updateOrder', () => {
    it('should update draft order line items, shipping fee, discount, and address', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
        shippingFee: 20000,
      });

      emittedEvents = [];

      const updated = await service.updateOrder(
        ws1,
        order.id,
        {
          items: [
            { productId: prod1, variantId: varA, quantity: 2, unitPrice: 350000 },
            { productId: prod1, variantId: varB, quantity: 1, unitPrice: 350000 },
          ],
          discountAmount: 100000,
          shippingFee: 30000,
          customerNotes: 'Giao hàng giờ hành chính',
          shippingAddress: {
            recipientName: 'Nguyễn Văn An Cập Nhật',
            phoneNumber: '0988121234',
            streetAddress: '15 Duy Tân',
            ward: 'Dịch Vọng Hậu',
            district: 'Cầu Giấy',
            province: 'Hà Nội',
          },
        },
        userId,
      );

      assert.strictEqual(updated.id, order.id);
      assert.strictEqual(updated.status, OrderStatus.DRAFT);
      assert.strictEqual(updated.subtotal, 1050000); // 2 * 350k + 1 * 350k
      assert.strictEqual(updated.discountAmount, 100000);
      assert.strictEqual(updated.shippingFee, 30000);
      assert.strictEqual(updated.totalAmount, 980000); // 1050000 - 100000 + 30000
      assert.strictEqual(updated.customerNotes, 'Giao hàng giờ hành chính');
      assert.strictEqual(updated.items?.length, 2);
      assert.strictEqual(updated.shippingAddress?.recipientName, 'Nguyễn Văn An Cập Nhật');
      assert.strictEqual(updated.shippingAddress?.streetAddress, '15 Duy Tân');

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.ORDER_UPDATED);
      assert.strictEqual(emittedEvents[0].payload.orderId, order.id);
    });

    it('should preserve and correctly recalculate percentage discount when items change and discountAmount is not passed', async () => {
      // Subtotal = 500k. 10% discount => discountAmount = 50,000, total = 450,000
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 500000 }],
        discountType: DiscountType.PERCENTAGE,
        discountAmount: 10,
        shippingFee: 0,
      });

      assert.strictEqual(order.subtotal, 500000);
      assert.strictEqual(order.discountAmount, 50000);
      assert.strictEqual(order.totalAmount, 450000);

      // Now update order: change items to 2 units (subtotal = 1,000,000), without passing discountAmount or discountType
      const updated = await service.updateOrder(
        ws1,
        order.id,
        {
          items: [{ productId: prod1, variantId: varA, quantity: 2, unitPrice: 500000 }],
        },
        userId,
      );

      // Should maintain 10% discount on new subtotal: 10% of 1,000,000 = 100,000
      assert.strictEqual(updated.subtotal, 1000000);
      assert.strictEqual(updated.discountAmount, 100000);
      assert.strictEqual(updated.totalAmount, 900000);
    });

    it('should correctly update order with a new percentage discount', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 500000 }],
        shippingFee: 0,
      });

      assert.strictEqual(order.subtotal, 500000);
      assert.strictEqual(order.discountAmount, 0);

      // Update with 20% discount
      const updated = await service.updateOrder(
        ws1,
        order.id,
        {
          discountType: DiscountType.PERCENTAGE,
          discountAmount: 20,
        },
        userId,
      );

      assert.strictEqual(updated.subtotal, 500000);
      assert.strictEqual(updated.discountAmount, 100000); // 20% of 500,000
      assert.strictEqual(updated.totalAmount, 400000);
    });

    it('should reject updating order if not in DRAFT status', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
      });

      await service.confirmOrder(ws1, order.id, userId);

      await assert.rejects(
        async () => {
          await service.updateOrder(ws1, order.id, {
            shippingFee: 50000,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'INVALID_STATUS_FOR_UPDATE');
          return true;
        },
      );
    });

    it('should reject updating order belonging to another workspace (multi-tenant guard)', async () => {
      const order = await service.createOrder(ws1, {
        contactId: contact1,
        items: [{ productId: prod1, variantId: varA, quantity: 1, unitPrice: 350000 }],
      });

      await assert.rejects(
        async () => {
          await service.updateOrder(ws2, order.id, {
            shippingFee: 50000,
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'ORDER_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
