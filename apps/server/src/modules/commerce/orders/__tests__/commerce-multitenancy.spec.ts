import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import { FulfillmentStatus, OrderStatus, PaymentStatus } from '@sales-copilot/shared-contracts';
import { InventoryLedgerService } from '../../inventory/inventory-ledger.service';
import { OrdersService } from '../orders.service';

describe('In-Chat Commerce Multi-Tenancy Isolation Suite', () => {
  let ordersService: OrdersService;
  let mockPrismaService: any;
  let mockEventEmitter: any;

  let ordersDb: Map<string, any>;
  let orderItemsDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let workspacesDb: Map<string, any>;

  const wsA = 'ws_alpha_tenant';
  const wsB = 'ws_beta_tenant';

  const orderAId = 'ord-alpha-1111-4111-8111-111111111111';
  const contactAId = 'contact-alpha-1';

  beforeEach(() => {
    ordersDb = new Map();
    orderItemsDb = new Map();
    contactsDb = new Map();
    workspacesDb = new Map();

    workspacesDb.set(wsA, { id: wsA, name: 'Alpha Corp' });
    workspacesDb.set(wsB, { id: wsB, name: 'Beta Corp' });

    contactsDb.set(contactAId, {
      id: contactAId,
      workspaceId: wsA,
      name: 'Khách hàng Alpha',
      phoneNumber: '0988111222',
    });

    // Seed Order belonging to Workspace A
    ordersDb.set(orderAId, {
      id: orderAId,
      displayId: 3001,
      orderNumber: 'ORD-ALPHA-3001',
      workspaceId: wsA,
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.UNPAID,
      fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
      subtotal: 500000,
      totalAmount: 500000,
      paidAmount: 0,
      contactId: contactAId,
      recipientName: 'Khách hàng Alpha',
      recipientPhone: '0988111222',
      recipientAddress: '10 Cầu Giấy',
      recipientWard: 'Dịch Vọng',
      recipientDistrict: 'Cầu Giấy',
      recipientProvince: 'Hà Nội',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    orderItemsDb.set('item-alpha-1', {
      id: 'item-alpha-1',
      workspaceId: wsA,
      orderId: orderAId,
      variantId: 'var-1',
      productName: 'Sản phẩm Alpha',
      variantName: 'Size M',
      sku: 'SKU-ALPHA-1',
      quantity: 1,
      unitPrice: 500000,
      totalPrice: 500000,
    });

    mockEventEmitter = { emit: () => {} };

    const clientMock: any = {
      order: {
        findFirst: async ({ where, include }: any) => {
          for (const o of ordersDb.values()) {
            if (where.workspaceId && o.workspaceId !== where.workspaceId) continue;
            if (where.id && o.id !== where.id) continue;
            const res = { ...o };
            if (include?.items) {
              res.items = Array.from(orderItemsDb.values()).filter(i => i.orderId === o.id);
            }
            return res;
          }
          return null;
        },
      },
      workspace: {
        findFirst: async ({ where }: any) => workspacesDb.get(where.id) || null,
      },
    };

    mockPrismaService = {
      order: clientMock.order,
      client: clientMock,
      getClient: () => clientMock,
      runInTransaction: async (cb: any) => cb({ tx: clientMock, addPostCommitHook: () => {} }),
    };

    const inventoryLedgerService = new InventoryLedgerService(
      mockPrismaService,
      mockEventEmitter as any,
    );
    ordersService = new OrdersService(
      mockPrismaService,
      mockEventEmitter as any,
      inventoryLedgerService,
      {} as any,
    );
  });

  it('should reject getOrderById when requesting order belonging to another workspace', async () => {
    await assert.rejects(
      async () => {
        await ordersService.getOrderById(wsB, orderAId);
      },
      (err: any) => {
        assert.strictEqual(err instanceof NotFoundException, true);
        assert.strictEqual(err.getResponse().code, 'ORDER_NOT_FOUND');
        return true;
      },
    );
  });
});
