import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { NotFoundException } from '@nestjs/common';
import {
  CarrierProvider,
  DiscountType,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { CustomCarrierAdapter } from '../../shipping/adapters/custom.adapter';
import { GhnCarrierAdapter } from '../../shipping/adapters/ghn.adapter';
import { GhtkCarrierAdapter } from '../../shipping/adapters/ghtk.adapter';
import { ShippingService } from '../../shipping/shipping.service';
import { OrdersService } from '../orders.service';

describe('In-Chat POS Multi-Tenancy Isolation Suite', () => {
  let ordersService: OrdersService;
  let shippingService: ShippingService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let mockCredentialService: any;

  let ordersDb: Map<string, any>;
  let orderItemsDb: Map<string, any>;
  let shippingAddressesDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let workspacesDb: Map<string, any>;

  const wsA = 'ws_alpha_tenant';
  const wsB = 'ws_beta_tenant';
  const userId = 'usr_agent_tenant_b';

  const orderAId = 'ord-alpha-1111-4111-8111-111111111111';
  const contactAId = 'contact-alpha-1';

  beforeEach(() => {
    ordersDb = new Map();
    orderItemsDb = new Map();
    shippingAddressesDb = new Map();
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

    shippingAddressesDb.set(orderAId, {
      id: 'addr-alpha-1',
      workspaceId: wsA,
      orderId: orderAId,
      recipientName: 'Khách hàng Alpha',
      phoneNumber: '0988111222',
      streetAddress: '10 Cầu Giấy',
      ward: 'Dịch Vọng',
      district: 'Cầu Giấy',
      province: 'Hà Nội',
      shippingCarrier: CarrierProvider.CUSTOM,
      trackingCode: 'INTERNAL-3001-ALPHA',
    });

    mockEventEmitter = { emit: () => {} };
    mockCredentialService = { decrypt: () => ({}) };

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
            if (include?.shippingAddress) {
              res.shippingAddress = shippingAddressesDb.get(o.id) || null;
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

    ordersService = new OrdersService(mockPrismaService, mockEventEmitter as any);

    shippingService = new ShippingService(
      mockPrismaService,
      mockEventEmitter as any,
      mockCredentialService,
      new CustomCarrierAdapter(),
      new GhtkCarrierAdapter(),
      new GhnCarrierAdapter(),
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

  it('should reject getShippingLabelData for cross-tenant order', async () => {
    await assert.rejects(
      async () => {
        await ordersService.getShippingLabelData(wsB, orderAId);
      },
      (err: any) => {
        assert.strictEqual(err instanceof NotFoundException, true);
        assert.strictEqual(err.getResponse().code, 'ORDER_NOT_FOUND');
        return true;
      },
    );
  });

  it('should reject dispatchOrder for cross-tenant order in ShippingService', async () => {
    await assert.rejects(
      async () => {
        await shippingService.dispatchOrder(
          wsB,
          orderAId,
          { carrier: CarrierProvider.CUSTOM },
          userId,
        );
      },
      (err: any) => {
        assert.strictEqual(err instanceof NotFoundException, true);
        assert.strictEqual(err.getResponse().code, 'ORDER_NOT_FOUND');
        return true;
      },
    );
  });

  it('should reject trackOrder for cross-tenant order in ShippingService', async () => {
    await assert.rejects(
      async () => {
        await shippingService.trackOrder(wsB, orderAId);
      },
      (err: any) => {
        assert.strictEqual(err instanceof NotFoundException, true);
        assert.strictEqual(err.getResponse().code, 'ORDER_NOT_FOUND');
        return true;
      },
    );
  });

  it('should return false when cancelling shipment of cross-tenant order', async () => {
    const res = await shippingService.cancelOrderShipment(wsB, orderAId);
    assert.strictEqual(res, false);
  });
});
