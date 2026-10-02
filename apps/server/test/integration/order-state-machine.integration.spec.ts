import { expectReject } from '../test-assertions';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConflictException } from '@nestjs/common';
import {
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { StockMovementService } from '../../src/modules/commerce/inventory/stock-movement.service';
import { OrderLifecycleService } from '../../src/modules/commerce/orders/order-lifecycle.service';
import { OrderWriterService } from '../../src/modules/commerce/orders/order-writer.service';

/**
 * State machine tests against real PostgreSQL. The mocked unit specs verify
 * that services call Prisma with the right arguments; this file verifies the
 * behaviors only a real database can prove: raw SQL predicates
 * (availability / reserved guards), transactional rollback on rejection,
 * and paid-amount accumulation across chained transitions.
 */
describe('Order & inventory state machine (real PostgreSQL)', () => {
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let stockMovementService: StockMovementService;
  let orderWriterService: OrderWriterService;
  let orderLifecycleService: OrderLifecycleService;

  const testRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let testUserId: string;
  let testWorkspaceId: string;
  let testContactId: string;
  let testProductId: string;

  const UNIT_PRICE = 250_000;

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
    stockMovementService = new StockMovementService(prismaService, eventEmitter);
    orderWriterService = new OrderWriterService(prismaService, eventEmitter, stockMovementService);
    orderLifecycleService = new OrderLifecycleService(
      prismaService,
      eventEmitter,
      stockMovementService,
      undefined,
    );

    const client = prismaService.client;

    const user = await client.user.create({
      data: {
        email: `state-machine-integ-${testRunId}@salescopilot.io`,
        name: `State Machine Integ ${testRunId}`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforintegrationtesting',
      },
    });
    testUserId = user.id;

    const ws = await client.workspace.create({
      data: {
        name: `State Machine Integ WS ${testRunId}`,
        slug: `ws-state-machine-${testRunId}`,
      },
    });
    testWorkspaceId = ws.id;

    const contact = await client.contact.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'State Machine Buyer',
        phoneNumber: '0988333444',
        email: `state-machine-${testRunId}@example.com`,
      },
    });
    testContactId = contact.id;

    const product = await client.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'State Machine Test Product',
        slug: `state-machine-product-${testRunId}`,
        sku: `SM-${testRunId}`,
        basePrice: UNIT_PRICE,
        trackInventory: true,
        isActive: true,
      },
    });
    testProductId = product.id;
  });

  afterAll(async () => {
    try {
      const client = prismaService.client;
      await client.inventoryTransaction.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.paymentTransaction.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.orderItem.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.order.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.productVariant.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.product.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.contact.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await client.workspace.deleteMany({ where: { id: testWorkspaceId } });
      await client.user.deleteMany({ where: { id: testUserId } });
    } finally {
      await prismaService.onModuleDestroy();
    }
  });

  /** Fresh variant per test so stock arithmetic is self-contained. */
  async function seedVariant(stock: number): Promise<string> {
    const variant = await prismaService.client.productVariant.create({
      data: {
        workspaceId: testWorkspaceId,
        productId: testProductId,
        name: `Variant stock=${stock} ${testRunId}-${Math.random().toString(36).slice(2, 6)}`,
        sku: `SM-VAR-${testRunId}-${Math.random().toString(36).slice(2, 8)}`,
        price: UNIT_PRICE,
        costPrice: 100_000,
        stockQuantity: stock,
        reservedQuantity: 0,
        isActive: true,
      },
    });
    return variant.id;
  }

  async function getVariant(variantId: string) {
    return prismaService.client.productVariant.findFirstOrThrow({
      where: { id: variantId, workspaceId: testWorkspaceId },
    });
  }

  function createDraft(
    variantId: string,
    quantity: number,
    dto?: { paymentMethod?: PaymentMethod },
  ) {
    return orderWriterService.createOrder(
      testWorkspaceId,
      {
        contactId: testContactId,
        items: [{ productId: testProductId, variantId, quantity, unitPrice: UNIT_PRICE }],
        ...dto,
      },
      testUserId,
    );
  }

  async function countLedgers(orderId: string, type: InventoryTransactionType): Promise<number> {
    return prismaService.client.inventoryTransaction.count({
      where: { workspaceId: testWorkspaceId, orderId, type },
    });
  }

  describe('confirmOrder', () => {
    it('rejects confirming a non-DRAFT order and leaves the reservation untouched', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 2);

      await orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId);
      await expectReject(
        () => orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId),
        (err: any) => {
          expect(err.response?.code).toBe('INVALID_STATUS_TRANSITION');
          return true;
        },
      );

      const variant = await getVariant(variantId);
      expect(variant.reservedQuantity).toBe(2);
    });

    it('rolls back the whole transaction on insufficient stock: order stays DRAFT, nothing reserved', async () => {
      const variantId = await seedVariant(3);
      const order = await createDraft(variantId, 5);

      await expectReject(
        () => orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId),
        (err: any) => {
          expect(err).toBeInstanceOf(ConflictException);
          expect(err.response?.code).toBe('INSUFFICIENT_STOCK');
          return true;
        },
      );

      const reread = await prismaService.client.order.findFirstOrThrow({
        where: { id: order.id, workspaceId: testWorkspaceId },
      });
      expect(reread.status).toBe(OrderStatus.DRAFT);
      expect((await getVariant(variantId)).reservedQuantity).toBe(0);
      expect(await countLedgers(order.id, InventoryTransactionType.RESERVATION)).toBe(0);
    });

    it('rejects confirming an order without line items (EMPTY_ORDER)', async () => {
      const order = await orderWriterService.createOrder(
        testWorkspaceId,
        { contactId: testContactId, items: [] },
        testUserId,
      );

      await expectReject(
        () => orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId),
        (err: any) => {
          expect(err.response?.code).toBe('EMPTY_ORDER');
          return true;
        },
      );
    });
  });

  describe('payOrder (deposit → settlement chain on one order)', () => {
    const TOTAL = UNIT_PRICE * 4; // 1,000,000
    let variantId: string;
    let orderId: string;

    beforeAll(async () => {
      variantId = await seedVariant(10);
      const order = await createDraft(variantId, 4);
      orderId = order.id;
    });

    it('partial payment on a DRAFT order reserves stock and keeps the order CONFIRMED', async () => {
      const paid = await orderLifecycleService.payOrder(
        testWorkspaceId,
        orderId,
        { paymentMethod: PaymentMethod.CASH, amount: 400_000, transactionCode: 'DEPOSIT-1' },
        testUserId,
      );

      expect(paid.status).toBe(OrderStatus.CONFIRMED);
      expect(paid.paymentStatus).toBe(PaymentStatus.PARTIALLY_PAID);
      expect(paid.paidAmount).toBe(400_000);

      const variant = await getVariant(variantId);
      expect(variant.reservedQuantity).toBe(4);
      expect(variant.stockQuantity).toBe(10);
    });

    it('a subsequent partial payment accumulates paidAmount without reserving stock twice', async () => {
      const paid = await orderLifecycleService.payOrder(
        testWorkspaceId,
        orderId,
        { paymentMethod: PaymentMethod.CASH, amount: 300_000, transactionCode: 'DEPOSIT-2' },
        testUserId,
      );

      expect(paid.status).toBe(OrderStatus.CONFIRMED);
      expect(paid.paidAmount).toBe(700_000);
      expect((await getVariant(variantId)).reservedQuantity).toBe(4);
      expect(await countLedgers(orderId, InventoryTransactionType.RESERVATION)).toBe(1);
    });

    it('paying the remaining balance transitions to PAID and commits the reserved stock', async () => {
      const paid = await orderLifecycleService.payOrder(
        testWorkspaceId,
        orderId,
        { paymentMethod: PaymentMethod.CASH, amount: 300_000, transactionCode: 'DEPOSIT-3' },
        testUserId,
      );

      expect(paid.status).toBe(OrderStatus.PAID);
      expect(paid.paymentStatus).toBe(PaymentStatus.PAID);
      expect(paid.paidAmount).toBe(TOTAL);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(6);
      expect(variant.reservedQuantity).toBe(0);

      const commit = await prismaService.client.inventoryTransaction.findFirstOrThrow({
        where: {
          workspaceId: testWorkspaceId,
          orderId,
          type: InventoryTransactionType.COMMIT_SALE,
        },
      });
      expect(commit.quantity).toBe(4);
      expect(commit.previousStock).toBe(10);
      expect(commit.newStock).toBe(6);
    });

    it('rejects a further manual payment on a PAID order even with a fresh transaction code', async () => {
      // Distinct code → distinct idempotency key → the status guard is what rejects
      await expectReject(
        () =>
          orderLifecycleService.payOrder(
            testWorkspaceId,
            orderId,
            { paymentMethod: PaymentMethod.CASH, amount: 100_000, transactionCode: 'AFTER-PAID' },
            testUserId,
          ),
        (err: any) => {
          expect(err.response?.code).toBe('INVALID_STATUS_FOR_PAYMENT');
          return true;
        },
      );
    });
  });

  describe('payOrder (full payment straight from DRAFT)', () => {
    it('commits stock directly without a prior reservation (POS-style instant sale)', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 2);

      const paid = await orderLifecycleService.payOrder(
        testWorkspaceId,
        order.id,
        { paymentMethod: PaymentMethod.CASH, amount: UNIT_PRICE * 2 },
        testUserId,
      );

      expect(paid.status).toBe(OrderStatus.PAID);
      expect(paid.paymentStatus).toBe(PaymentStatus.PAID);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(8);
      expect(variant.reservedQuantity).toBe(0);

      const commit = await prismaService.client.inventoryTransaction.findFirstOrThrow({
        where: {
          workspaceId: testWorkspaceId,
          orderId: order.id,
          type: InventoryTransactionType.COMMIT_SALE,
        },
      });
      expect(commit.previousReserved).toBe(0);
      expect(commit.newReserved).toBe(0);
    });
  });

  describe('cancelOrder', () => {
    it('cancelling a CONFIRMED order releases the reservation and leaves physical stock untouched', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 3);
      await orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId);

      const cancelled = await orderLifecycleService.cancelOrder(
        testWorkspaceId,
        order.id,
        { cancelReason: 'Customer changed mind' },
        testUserId,
      );

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.paymentStatus).toBe(PaymentStatus.UNPAID);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(10);
      expect(variant.reservedQuantity).toBe(0);

      expect(await countLedgers(order.id, InventoryTransactionType.RELEASE_RESERVATION)).toBe(1);
      expect(await countLedgers(order.id, InventoryTransactionType.RETURN_RESTOCK)).toBe(0);
      const refunds = await prismaService.client.paymentTransaction.count({
        where: { workspaceId: testWorkspaceId, orderId: order.id, amount: { lt: 0 } },
      });
      expect(refunds).toBe(0);
    });

    it('cancelling a PAID order records a refund transaction and marks paymentStatus REFUNDED', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 1);
      await orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId);
      await orderLifecycleService.payOrder(
        testWorkspaceId,
        order.id,
        { paymentMethod: PaymentMethod.CASH, amount: UNIT_PRICE },
        testUserId,
      );

      const cancelled = await orderLifecycleService.cancelOrder(
        testWorkspaceId,
        order.id,
        { cancelReason: 'Customer refund' },
        testUserId,
      );

      expect(cancelled.status).toBe(OrderStatus.CANCELLED);
      expect(cancelled.paymentStatus).toBe(PaymentStatus.REFUNDED);

      const refund = await prismaService.client.paymentTransaction.findFirstOrThrow({
        where: { workspaceId: testWorkspaceId, orderId: order.id, amount: { lt: 0 } },
      });
      expect(Number(refund.amount)).toBe(-UNIT_PRICE);
      expect(refund.idempotencyKey).toBe(`refund:${order.id}`);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(10);
      expect(await countLedgers(order.id, InventoryTransactionType.RETURN_RESTOCK)).toBe(1);
    });

    it('a CANCELLED order cannot be cancelled again (ORDER_NOT_CANCELLABLE)', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 1);
      await orderLifecycleService.cancelOrder(
        testWorkspaceId,
        order.id,
        { cancelReason: 'First cancel' },
        testUserId,
      );

      await expectReject(
        () =>
          orderLifecycleService.cancelOrder(
            testWorkspaceId,
            order.id,
            { cancelReason: 'Second cancel' },
            testUserId,
          ),
        (err: any) => {
          expect(err.response?.code).toBe('ORDER_NOT_CANCELLABLE');
          return true;
        },
      );
    });
  });

  describe('completeOrder', () => {
    it('completing a CONFIRMED order commits the sale exactly once', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 2);
      await orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId);

      const completed = await orderLifecycleService.completeOrder(
        testWorkspaceId,
        order.id,
        { notes: 'Handed to customer' },
        testUserId,
      );

      expect(completed.status).toBe(OrderStatus.COMPLETED);
      expect(completed.fulfillmentStatus).toBe(FulfillmentStatus.DELIVERED);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(8);
      expect(variant.reservedQuantity).toBe(0);
      expect(await countLedgers(order.id, InventoryTransactionType.COMMIT_SALE)).toBe(1);
    });

    it('auto-reconciles the remaining balance for an underpaid COD order', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 1, { paymentMethod: PaymentMethod.COD });
      await orderLifecycleService.payOrder(
        testWorkspaceId,
        order.id,
        { paymentMethod: PaymentMethod.COD, amount: 200_000, transactionCode: 'COD-DEPOSIT' },
        testUserId,
      );

      const completed = await orderLifecycleService.completeOrder(
        testWorkspaceId,
        order.id,
        { notes: 'Collected on delivery' },
        testUserId,
      );

      expect(completed.status).toBe(OrderStatus.COMPLETED);
      expect(completed.paymentStatus).toBe(PaymentStatus.PAID);
      expect(completed.paidAmount).toBe(UNIT_PRICE);

      const codTx = await prismaService.client.paymentTransaction.findFirstOrThrow({
        where: { workspaceId: testWorkspaceId, idempotencyKey: `cod:${order.id}` },
      });
      expect(Number(codTx.amount)).toBe(UNIT_PRICE - 200_000);

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(9);
      expect(variant.reservedQuantity).toBe(0);
    });

    it('rejects completing a DRAFT order without touching stock', async () => {
      const variantId = await seedVariant(10);
      const order = await createDraft(variantId, 2);

      await expectReject(
        () => orderLifecycleService.completeOrder(testWorkspaceId, order.id, {}, testUserId),
        (err: any) => {
          expect(err.response?.code).toBe('INVALID_STATUS_FOR_COMPLETION');
          return true;
        },
      );

      const variant = await getVariant(variantId);
      expect(variant.stockQuantity).toBe(10);
      expect(variant.reservedQuantity).toBe(0);
    });
  });

  describe('adjustStock (manual adjustments vs reservations)', () => {
    let variantId: string;

    beforeAll(async () => {
      // One variant shared by the chain below: reserve 4, then adjust around it
      variantId = await seedVariant(10);
      const order = await createDraft(variantId, 4);
      await orderLifecycleService.confirmOrder(testWorkspaceId, order.id, testUserId);
    });

    it('STOCK_OUT cannot reduce physical stock below the reserved quantity', async () => {
      // 10 stock - 8 out = 2 physical < 4 reserved → must be rejected
      await expectReject(
        () =>
          stockMovementService.adjustStock({
            workspaceId: testWorkspaceId,
            variantId,
            dto: { type: InventoryTransactionType.STOCK_OUT, quantity: 8, reason: 'Shrinkage' },
          }),
        (err: any) => {
          expect(err.response?.code).toBe('CANNOT_REDUCE_BELOW_RESERVED');
          return true;
        },
      );

      expect((await getVariant(variantId)).stockQuantity).toBe(10);
    });

    it('STOCK_OUT succeeds when the remaining physical stock still covers reservations', async () => {
      await stockMovementService.adjustStock({
        workspaceId: testWorkspaceId,
        variantId,
        dto: { type: InventoryTransactionType.STOCK_OUT, quantity: 3, reason: 'Damaged goods' },
      });

      expect((await getVariant(variantId)).stockQuantity).toBe(7);
    });

    it('INVENTORY_AUDIT sets the physical stock to the counted value but never below reservations', async () => {
      await stockMovementService.adjustStock({
        workspaceId: testWorkspaceId,
        variantId,
        dto: {
          type: InventoryTransactionType.INVENTORY_AUDIT,
          quantity: 12,
          reason: 'Cycle count',
        },
      });
      expect((await getVariant(variantId)).stockQuantity).toBe(12);

      // 2 counted < 4 reserved → rejected, count ignored
      await expectReject(
        () =>
          stockMovementService.adjustStock({
            workspaceId: testWorkspaceId,
            variantId,
            dto: {
              type: InventoryTransactionType.INVENTORY_AUDIT,
              quantity: 2,
              reason: 'Bad count',
            },
          }),
        (err: any) => {
          expect(err.response?.code).toBe('CANNOT_REDUCE_BELOW_RESERVED');
          return true;
        },
      );
      expect((await getVariant(variantId)).stockQuantity).toBe(12);
    });
  });
});
