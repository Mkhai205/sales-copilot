import { expectReject } from '../test-assertions';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  DiscountType,
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../src/infrastructure/database';
import { InventoryLedgerService } from '../../src/modules/commerce/inventory/inventory-ledger.service';
import { OrdersService } from '../../src/modules/commerce/orders/orders.service';

describe('Commerce & Inventory PostgreSQL Integration Tests (Real Database & Concurrency)', () => {
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let inventoryLedgerService: InventoryLedgerService;
  let ordersService: OrdersService;

  const testRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let testUserId: string;
  let testWorkspaceId: string;
  let foreignWorkspaceId: string;
  let testContactId: string;
  let testProductId: string;
  let variantAId: string;
  let variantBId: string; // Stock: 2 for concurrency stress testing

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required for integration tests');
    }

    const configService = new ConfigService({
      DATABASE_URL: databaseUrl,
      NODE_ENV: 'test',
    });

    prismaService = new PrismaService(configService);
    await prismaService.onModuleInit();

    eventEmitter = new EventEmitter2();
    inventoryLedgerService = new InventoryLedgerService(prismaService, eventEmitter);
    ordersService = new OrdersService(
      prismaService,
      eventEmitter,
      inventoryLedgerService,
      {} as any,
      undefined,
    );

    const client = prismaService.client;

    // 1. Create Base User
    const user = await client.user.create({
      data: {
        email: `commerce-integ-${testRunId}@salescopilot.io`,
        name: `Integ Agent ${testRunId}`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforintegrationtesting',
      },
    });
    testUserId = user.id;

    // 2. Create Target Workspace & Foreign Workspace
    const ws = await client.workspace.create({
      data: {
        name: `Commerce Integ WS ${testRunId}`,
        slug: `ws-comm-integ-${testRunId}`,
      },
    });
    testWorkspaceId = ws.id;

    const foreignWs = await client.workspace.create({
      data: {
        name: `Foreign Tenant ${testRunId}`,
        slug: `ws-foreign-integ-${testRunId}`,
      },
    });
    foreignWorkspaceId = foreignWs.id;

    // 3. Create Contact
    const contact = await client.contact.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Nguyen Van Buyer',
        phoneNumber: '0988111222',
        email: `buyer-${testRunId}@example.com`,
      },
    });
    testContactId = contact.id;

    // 4. Create Product & Variants in PostgreSQL
    const product = await client.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Ao Polo Premium',
        slug: `ao-polo-${testRunId}`,
        sku: `POLO-${testRunId}`,
        basePrice: 250000,
        trackInventory: true,
        isActive: true,
      },
    });
    testProductId = product.id;

    const varA = await client.productVariant.create({
      data: {
        workspaceId: testWorkspaceId,
        productId: product.id,
        name: 'Size M / Trang',
        sku: `POLO-M-WHT-${testRunId}`,
        price: 250000,
        costPrice: 120000,
        stockQuantity: 10,
        reservedQuantity: 0,
        isActive: true,
      },
    });
    variantAId = varA.id;

    const varB = await client.productVariant.create({
      data: {
        workspaceId: testWorkspaceId,
        productId: product.id,
        name: 'Size L / Gioi Han (Stock=2)',
        sku: `POLO-L-LTD-${testRunId}`,
        price: 300000,
        costPrice: 150000,
        stockQuantity: 2, // Exactly 2 units for real concurrency race test
        reservedQuantity: 0,
        isActive: true,
      },
    });
    variantBId = varB.id;
  });

  afterAll(async () => {
    try {
      const client = prismaService.client;

      // Clean up records in dependency order
      const wsIds = [testWorkspaceId, foreignWorkspaceId].filter(Boolean);
      if (wsIds.length > 0) {
        await client.inventoryTransaction.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.paymentTransaction.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.orderItem.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.order.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.productVariant.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.product.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.contact.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.workspace.deleteMany({ where: { id: { in: wsIds } } });
      }

      if (testUserId) {
        await client.user.deleteMany({ where: { id: testUserId } });
      }
    } finally {
      await prismaService.onModuleDestroy();
    }
  });

  let createdOrderId: string;

  it('1. should create order draft in PostgreSQL with 0 stock reservations', async () => {
    const order = await ordersService.createOrder(
      testWorkspaceId,
      {
        contactId: testContactId,
        items: [
          {
            productId: testProductId,
            variantId: variantAId,
            quantity: 3,
            unitPrice: 250000,
          },
        ],
        shippingFee: 30000,
        discountAmount: 50000,
        discountType: DiscountType.FIXED_AMOUNT,
      },
      testUserId,
    );

    expect(order.id).toBeTruthy();
    createdOrderId = order.id;
    expect(order.workspaceId).toBe(testWorkspaceId);
    expect(order.status).toBe(OrderStatus.DRAFT);
    expect(order.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(order.subtotal).toBe(750000); // 3 * 250k
    expect(order.totalAmount).toBe(730000); // 750k - 50k + 30k

    // Verify PostgreSQL: physical and reserved stock remain untouched in DRAFT
    const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variantInDb.stockQuantity).toBe(10);
    expect(variantInDb.reservedQuantity).toBe(0);
  });

  it('2. should confirm order, atomically incrementing reservedQuantity in PostgreSQL (Model A)', async () => {
    const confirmed = await ordersService.confirmOrder(testWorkspaceId, createdOrderId, testUserId);

    expect(confirmed.status).toBe(OrderStatus.CONFIRMED);
    expect(confirmed.confirmedAt).toBeTruthy();

    // Verify PostgreSQL: stockQuantity = 10, reservedQuantity = 3
    const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variantInDb.stockQuantity).toBe(10);
    expect(variantInDb.reservedQuantity).toBe(3);

    // Verify immutable inventory transaction in PostgreSQL
    const invTx = await prismaService.client.inventoryTransaction.findFirst({
      where: {
        workspaceId: testWorkspaceId,
        orderId: createdOrderId,
        type: InventoryTransactionType.RESERVATION,
      },
    });
    expect(invTx).toBeTruthy();
    expect(invTx.quantity).toBe(3);
    expect(invTx.previousReserved).toBe(0);
    expect(invTx.newReserved).toBe(3);
  });

  it('3. should enforce real PostgreSQL concurrency guard: 20 parallel threads competing for 2 items', async () => {
    // 1. Create 20 distinct DRAFT orders in DB competing for variantB (Stock: 2)
    const draftOrders = await Promise.all(
      Array.from({ length: 20 }).map((_, idx) =>
        ordersService.createOrder(
          testWorkspaceId,
          {
            contactId: testContactId,
            items: [
              {
                productId: testProductId,
                variantId: variantBId,
                quantity: 1,
                unitPrice: 300000,
              },
            ],
            customerNotes: `Concurrent draft ${idx + 1}`,
          },
          testUserId,
        ),
      ),
    );

    // 2. Fire 20 parallel confirm requests against PostgreSQL
    const results = await Promise.allSettled(
      draftOrders.map(order => ordersService.confirmOrder(testWorkspaceId, order.id, testUserId)),
    );

    const fulfilled = results.filter(r => r.status === 'fulfilled');
    const rejected = results.filter(r => r.status === 'rejected');

    // Exactly 2 succeeded on real PostgreSQL atomic row update
    expect(fulfilled.length).toBe(2);
    expect(rejected.length).toBe(18);

    for (const rej of rejected) {
      if (rej.status === 'rejected') {
        const err = rej.reason;
        expect(err instanceof ConflictException).toBeTruthy();
        expect(err.getResponse().code).toBe('INSUFFICIENT_STOCK');
      }
    }

    // 3. Invariant check on real PostgreSQL variant record
    const variantBInDb = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantBId, workspaceId: testWorkspaceId },
    });
    expect(variantBInDb.stockQuantity).toBe(2);
    expect(variantBInDb.reservedQuantity).toBe(2);
    expect(variantBInDb.stockQuantity - variantBInDb.reservedQuantity).toBe(0);

    // Exactly 2 RESERVATION ledger rows created for variantB
    const reservationLedgers = await prismaService.client.inventoryTransaction.findMany({
      where: {
        workspaceId: testWorkspaceId,
        variantId: variantBId,
        type: InventoryTransactionType.RESERVATION,
      },
    });
    expect(reservationLedgers.length).toBe(2);
  });

  it('4. should pay order, committing inventory sale in PostgreSQL (stock 10->7, reserved 3->0)', async () => {
    const paid = await ordersService.payOrder(
      testWorkspaceId,
      createdOrderId,
      {
        paymentMethod: PaymentMethod.CASH,
        amount: 730000,
      },
      testUserId,
    );

    expect(paid.status).toBe(OrderStatus.PAID);
    expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
    expect(paid.paidAmount).toBe(730000);

    // Verify PostgreSQL: physical stock reduced to 7, reserved cleared to 0
    const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variantInDb.stockQuantity).toBe(7);
    expect(variantInDb.reservedQuantity).toBe(0);

    // Verify COMMIT_SALE transaction recorded in PostgreSQL
    const commitTx = await prismaService.client.inventoryTransaction.findFirst({
      where: {
        workspaceId: testWorkspaceId,
        orderId: createdOrderId,
        type: InventoryTransactionType.COMMIT_SALE,
      },
    });
    expect(commitTx).toBeTruthy();
    expect(commitTx.quantity).toBe(3);
    expect(commitTx.previousStock).toBe(10);
    expect(commitTx.newStock).toBe(7);
  });

  it('5. should complete order without double-committing stock (Anti-Double-Commit Invariant)', async () => {
    const completed = await ordersService.completeOrder(
      testWorkspaceId,
      createdOrderId,
      { notes: 'Customer received package' },
      testUserId,
    );

    expect(completed.status).toBe(OrderStatus.COMPLETED);
    expect(completed.fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);

    // Stock in PostgreSQL must remain 7 (NOT decremented again to 4!)
    const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variantInDb.stockQuantity).toBe(7);
    expect(variantInDb.reservedQuantity).toBe(0);

    // Exactly 1 COMMIT_SALE transaction must exist across entire lifecycle
    const commitTxs = await prismaService.client.inventoryTransaction.findMany({
      where: {
        workspaceId: testWorkspaceId,
        orderId: createdOrderId,
        type: InventoryTransactionType.COMMIT_SALE,
      },
    });
    expect(commitTxs.length).toBe(1);
  });

  it('6. should cancel order and restore stock with RETURN_RESTOCK ledger row', async () => {
    // Create a new paid order to test return cancellation
    const orderToCancel = await ordersService.createOrder(
      testWorkspaceId,
      {
        contactId: testContactId,
        confirmImmediately: true,
        items: [
          { productId: testProductId, variantId: variantAId, quantity: 2, unitPrice: 250000 },
        ],
      },
      testUserId,
    );

    // Stock was 7, reserved 2 -> pay to commit sale -> stock 5, reserved 0
    await ordersService.payOrder(
      testWorkspaceId,
      orderToCancel.id,
      { paymentMethod: PaymentMethod.VIETQR, amount: 500000 },
      testUserId,
    );

    let variant = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variant.stockQuantity).toBe(5);

    // Cancel PAID order (Customer returns goods)
    const cancelled = await ordersService.cancelOrder(
      testWorkspaceId,
      orderToCancel.id,
      { cancelReason: 'Customer refund' },
      testUserId,
    );

    expect(cancelled.status).toBe(OrderStatus.CANCELLED);

    // Physical stock restored from 5 back to 7
    variant = await prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantAId, workspaceId: testWorkspaceId },
    });
    expect(variant.stockQuantity).toBe(7);

    // Sổ cái ghi nhận RETURN_RESTOCK
    const returnTx = await prismaService.client.inventoryTransaction.findFirst({
      where: {
        workspaceId: testWorkspaceId,
        orderId: orderToCancel.id,
        type: InventoryTransactionType.RETURN_RESTOCK,
      },
    });
    expect(returnTx).toBeTruthy();
    expect(returnTx.quantity).toBe(2);
    expect(returnTx.previousStock).toBe(5);
    expect(returnTx.newStock).toBe(7);
  });

  it('7. should enforce strict multi-tenancy: reject confirm or pay with wrong workspaceId', async () => {
    // Attempting to confirm createdOrderId using foreignWorkspaceId must fail
    await expectReject(
      async () => {
        await ordersService.confirmOrder(foreignWorkspaceId, createdOrderId, testUserId);
      },
      (err: any) => {
        expect(err instanceof NotFoundException).toBeTruthy();
        expect(err.getResponse().code).toBe('ORDER_NOT_FOUND');
        return true;
      },
    );
  });
});
