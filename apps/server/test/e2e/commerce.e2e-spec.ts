import request from 'supertest';
import {
  createTestApp,
  seedTestData,
  cleanupTestData,
  loginAsAgent,
  TestAppContext,
  SeedTestContext,
} from './helpers';
import {
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';

describe('E2E Scenario — Commerce Order Closing, Inventory Reservation & Logistics Fulfillment', () => {
  let ctx: TestAppContext;
  let seedCtx: SeedTestContext;
  let agentToken: string;
  let testProductId: string;
  let testVariantId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    seedCtx = await seedTestData(ctx.prisma);

    const loginResult = await loginAsAgent(ctx.httpServer, {
      email: seedCtx.agentUser.email,
      password: seedCtx.agentPassword,
    });
    agentToken = loginResult.accessToken;

    // Seed Product & ProductVariant with stockQuantity = 10, reservedQuantity = 0
    const prisma = ctx.prisma.client;
    const product = await prisma.product.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        name: 'Tai nghe Bluetooth Không Dây',
        slug: `tai-nghe-${seedCtx.testRunId}`,
        sku: `PROD-BT-${seedCtx.testRunId}`,
        basePrice: 200000,
        trackInventory: true,
        isActive: true,
      },
    });
    testProductId = product.id;

    const variant = await prisma.productVariant.create({
      data: {
        workspaceId: seedCtx.workspace.id,
        productId: product.id,
        name: 'Màu Đen Nhám',
        sku: `SKU-BT-BLACK-${seedCtx.testRunId}`,
        price: 200000,
        costPrice: 100000,
        stockQuantity: 10,
        reservedQuantity: 0,
        isActive: true,
      },
    });
    testVariantId = variant.id;
  });

  afterAll(async () => {
    if (seedCtx && ctx?.prisma) {
      await cleanupTestData(ctx.prisma, seedCtx);
    }
    if (ctx) {
      await ctx.close();
    }
  });

  let createdOrderId: string;

  it('1. should create order in DRAFT status with 0 inventory reservations', async () => {
    const createRes = await request(ctx.httpServer)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        contactId: seedCtx.contact.id,
        items: [
          {
            productId: testProductId,
            variantId: testVariantId,
            quantity: 2,
            unitPrice: 200000,
          },
        ],
        shippingAddress: {
          recipientName: 'Nguyễn Văn Commerce',
          phoneNumber: '0988223344',
          streetAddress: '123 Đường Kim Mã',
          ward: 'Kim Mã',
          district: 'Ba Đình',
          province: 'Hà Nội',
        },
      });

    expect(createRes.status).toBe(201);
    const order = createRes.body.data;
    expect(order).toBeDefined();
    expect(order.id).toBeDefined();
    createdOrderId = order.id;

    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(order.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(order.fulfillmentStatus).toBe(FulfillmentStatus.UNFULFILLED);
    expect(order.subtotal).toBe(400000);
    expect(order.totalAmount).toBe(400000);
    expect(order.items).toHaveLength(1);

    // Verify database: stock is intact, no reservation yet
    const variant = await ctx.prisma.client.productVariant.findFirstOrThrow({
      where: { id: testVariantId, workspaceId: seedCtx.workspace.id },
    });
    expect(variant.stockQuantity).toBe(10);
    expect(variant.reservedQuantity).toBe(0);
  });

  it('2. should confirm order, transitioning to CONFIRMED and reserving 2 units (Model A)', async () => {
    const confirmRes = await request(ctx.httpServer)
      .post(`/api/v1/orders/${createdOrderId}/confirm`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({});

    expect(confirmRes.status).toBe(200);
    const order = confirmRes.body.data;
    expect(order.status).toBe(OrderStatus.CONFIRMED);
    expect(order.confirmedAt).toBeDefined();

    // Verify database: stock is 10, reserved is 2
    const variant = await ctx.prisma.client.productVariant.findFirstOrThrow({
      where: { id: testVariantId, workspaceId: seedCtx.workspace.id },
    });
    expect(variant.stockQuantity).toBe(10);
    expect(variant.reservedQuantity).toBe(2);

    // Verify immutable inventory transaction recorded
    const invTx = await ctx.prisma.client.inventoryTransaction.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        orderId: createdOrderId,
        type: InventoryTransactionType.RESERVATION,
      },
    });
    expect(invTx).toBeDefined();
    expect(invTx?.quantity).toBe(2);
  });

  it('3. should record payment (PAID), committing inventory sale (stock 10->8, reserved 2->0)', async () => {
    const payRes = await request(ctx.httpServer)
      .post(`/api/v1/orders/${createdOrderId}/pay`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({
        paymentMethod: PaymentMethod.VIETQR,
        amount: 400000,
        transactionCode: `TX-VIETQR-${seedCtx.testRunId}`,
      });

    expect(payRes.status).toBe(200);
    const order = payRes.body.data;
    expect(order.status).toBe(OrderStatus.PAID);
    expect(order.paymentStatus).toBe(PaymentStatus.PAID);
    expect(order.paidAmount).toBe(400000);

    // Verify database: stock reduced to 8, reserved released to 0
    const variant = await ctx.prisma.client.productVariant.findFirstOrThrow({
      where: { id: testVariantId, workspaceId: seedCtx.workspace.id },
    });
    expect(variant.stockQuantity).toBe(8);
    expect(variant.reservedQuantity).toBe(0);

    // Verify COMMIT_SALE transaction recorded
    const commitTx = await ctx.prisma.client.inventoryTransaction.findFirst({
      where: {
        workspaceId: seedCtx.workspace.id,
        orderId: createdOrderId,
        type: InventoryTransactionType.COMMIT_SALE,
      },
    });
    expect(commitTx).toBeDefined();
    expect(commitTx?.quantity).toBe(2);
  });

  it('4. should complete order and transition fulfillmentStatus to DELIVERED', async () => {
    const completeRes = await request(ctx.httpServer)
      .post(`/api/v1/orders/${createdOrderId}/complete`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', seedCtx.workspace.id)
      .send({});

    expect(completeRes.status).toBe(200);
    const order = completeRes.body.data;
    expect(order.status).toBe(OrderStatus.COMPLETED);
    expect(order.fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);

    // CRITICAL ANTI-DOUBLE-COMMIT INVARIANT:
    // Stock must remain 8, reserved must remain 0 (NOT deducted a second time to 6!)
    const variant = await ctx.prisma.client.productVariant.findFirstOrThrow({
      where: { id: testVariantId, workspaceId: seedCtx.workspace.id },
    });
    expect(variant.stockQuantity).toBe(8);
    expect(variant.reservedQuantity).toBe(0);

    // Verify only ONE commit transaction exists across the entire lifecycle
    const commitTxs = await ctx.prisma.client.inventoryTransaction.findMany({
      where: {
        workspaceId: seedCtx.workspace.id,
        orderId: createdOrderId,
        type: InventoryTransactionType.COMMIT_SALE,
      },
    });
    expect(commitTxs).toHaveLength(1);
  });

  it('5. should enforce tenant isolation: reject operations from an unauthorized workspace', async () => {
    const randomWorkspaceId = '00000000-0000-0000-0000-000000000000';

    const getRes = await request(ctx.httpServer)
      .get(`/api/v1/orders/${createdOrderId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .set('X-Workspace-Id', randomWorkspaceId);

    // Should return 403 (Workspace membership denied) or 404 (Not found)
    expect([403, 404]).toContain(getRes.status);
  });
});
