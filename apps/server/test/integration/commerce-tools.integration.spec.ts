import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderStatus } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { InventoryLedgerService } from '../../src/modules/commerce/inventory/inventory-ledger.service';
import { OrdersService } from '../../src/modules/commerce/orders/orders.service';
import { ProductsService } from '../../src/modules/commerce/products/products.service';
import { ContactsService } from '../../src/modules/omnichannel/contacts/contacts.service';
import { DiscountGuardService } from '../../src/modules/intelligence/ai-agent/services/discount-guard.service';
import { CommerceToolRegistry } from '../../src/modules/intelligence/ai-agent/tools/commerce-tool.registry';

describe('Commerce Tools PostgreSQL Integration Tests (Real Database)', () => {
  let prismaService: PrismaService;
  let eventEmitter: EventEmitter2;
  let inventoryLedgerService: InventoryLedgerService;
  let ordersService: OrdersService;
  let productsService: ProductsService;
  let contactsService: ContactsService;
  let discountGuardService: DiscountGuardService;
  let registry: CommerceToolRegistry;

  const testRunId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  let testUserId: string;
  let testWorkspaceId: string;
  let foreignWorkspaceId: string;
  let testInboxId: string;
  let testConversationId: string;
  let testContactId: string;
  let variantInStockId: string;
  let variantOutOfStockId: string;
  let foreignVariantId: string;

  let sentMessages: any[];
  let deletedRedisKeys: string[];

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
    productsService = new ProductsService(prismaService, eventEmitter, inventoryLedgerService);
    contactsService = new ContactsService(prismaService, eventEmitter);
    discountGuardService = new DiscountGuardService();

    sentMessages = [];
    deletedRedisKeys = [];

    const mockVietQrService: any = {
      generateForOrder: async (wsId: string, orderId: string, opts: any) => {
        const o = await prismaService.client.order.findFirstOrThrow({
          where: { id: orderId, workspaceId: wsId },
        });
        return {
          orderId,
          orderNumber: o.orderNumber,
          displayId: o.displayId,
          amount: Number(o.totalAmount),
          qrUrl: `https://img.vietqr.io/image/MB-0988123456-compact2.png?amount=${Number(o.totalAmount)}&addInfo=${opts?.memo || 'DH' + o.displayId}`,
          qrPayload:
            '00020101021238570010A00000072701270006970422011309881234560208QRIBFTTA530370454061800005802VN5913SALES COPILOT6006HA NOI62100806DH1042630429B1',
          bankName: 'MBBank',
          accountNumber: '0988123456',
          accountName: 'SALES COPILOT',
          transferContent: opts?.memo || `DH${o.displayId}`,
        };
      },
    };

    const mockMessagesService: any = {
      create: async (wsId: string, convId: string, payload: any) => {
        const msg = { id: `msg-${Date.now()}-${Math.random()}`, wsId, convId, ...payload };
        sentMessages.push(msg);
        return msg;
      },
    };

    const mockRedis: any = {
      del: async (key: string) => {
        deletedRedisKeys.push(key);
      },
    };

    registry = new CommerceToolRegistry(
      prismaService,
      mockRedis,
      productsService,
      ordersService,
      inventoryLedgerService,
      mockVietQrService,
      contactsService,
      mockMessagesService,
      discountGuardService,
    );

    const client = prismaService.client;

    // 1. Create Base User
    const user = await client.user.create({
      data: {
        email: `tools-integ-${testRunId}@salescopilot.io`,
        name: `Tools Integ Agent ${testRunId}`,
        passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$dummyhashforintegrationtesting',
      },
    });
    testUserId = user.id;

    // 2. Create Target Workspace & Foreign Workspace (Multi-tenancy isolation)
    const ws = await client.workspace.create({
      data: {
        name: `Tools Integ WS ${testRunId}`,
        slug: `ws-tools-integ-${testRunId}`,
      },
    });
    testWorkspaceId = ws.id;

    const foreignWs = await client.workspace.create({
      data: {
        name: `Foreign WS ${testRunId}`,
        slug: `ws-foreign-tools-${testRunId}`,
      },
    });
    foreignWorkspaceId = foreignWs.id;

    // 3. Create Inbox
    const inbox = await client.inbox.create({
      data: {
        workspaceId: testWorkspaceId,
        name: `Webchat Inbox ${testRunId}`,
      },
    });
    testInboxId = inbox.id;

    // 4. Create Contact
    const contact = await client.contact.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Hoang Van Thuong',
        phoneNumber: '+84988776655',
        email: `thuong-${testRunId}@example.com`,
      },
    });
    testContactId = contact.id;

    // 5. Create Conversation
    const conv = await client.conversation.create({
      data: {
        workspaceId: testWorkspaceId,
        inboxId: testInboxId,
        contactId: testContactId,
        status: 'OPEN',
        priority: 'MEDIUM',
        isAiPaused: false,
      },
    });
    testConversationId = conv.id;

    // 6. Create Products & Variants in PostgreSQL
    const product = await client.product.create({
      data: {
        workspaceId: testWorkspaceId,
        name: 'Ao So Mi Oxford',
        slug: `ao-so-mi-${testRunId}`,
        sku: `OXFORD-${testRunId}`,
        basePrice: 300000,
        trackInventory: true,
        isActive: true,
      },
    });
    testProductId = product.id;

    // Variant 1: In stock (stock: 10, reserved: 2 -> availableStock = 8)
    const varInStock = await client.productVariant.create({
      data: {
        workspaceId: testWorkspaceId,
        productId: product.id,
        name: 'Trang / L (Con Hang)',
        sku: `OXFORD-WHT-L-${testRunId}`,
        price: 300000,
        costPrice: 150000,
        stockQuantity: 10,
        reservedQuantity: 2,
        isActive: true,
      },
    });
    variantInStockId = varInStock.id;

    // Variant 2: Out of stock (stock: 5, reserved: 5 -> availableStock = 0)
    const varOutOfStock = await client.productVariant.create({
      data: {
        workspaceId: testWorkspaceId,
        productId: product.id,
        name: 'Xanh / M (Het Hang)',
        sku: `OXFORD-BLU-M-${testRunId}`,
        price: 320000,
        costPrice: 160000,
        stockQuantity: 5,
        reservedQuantity: 5,
        isActive: true,
      },
    });
    variantOutOfStockId = varOutOfStock.id;

    // Foreign Variant in Foreign Workspace (Strict Multi-tenancy check)
    const foreignProduct = await client.product.create({
      data: {
        workspaceId: foreignWorkspaceId,
        name: 'Foreign Product',
        slug: `foreign-prod-${testRunId}`,
        sku: `FOREIGN-${testRunId}`,
        basePrice: 500000,
        trackInventory: true,
        isActive: true,
      },
    });

    const foreignVar = await client.productVariant.create({
      data: {
        workspaceId: foreignWorkspaceId,
        productId: foreignProduct.id,
        name: 'Foreign / XL',
        sku: `FOREIGN-XL-${testRunId}`,
        price: 500000,
        costPrice: 250000,
        stockQuantity: 10,
        reservedQuantity: 0,
        isActive: true,
      },
    });
    foreignVariantId = foreignVar.id;
  });

  afterAll(async () => {
    try {
      const client = prismaService.client;
      const wsIds = [testWorkspaceId, foreignWorkspaceId].filter(Boolean);

      if (wsIds.length > 0) {
        await client.message.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.conversation.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.inboxMember.deleteMany({ where: { inbox: { workspaceId: { in: wsIds } } } });
        await client.channel.deleteMany({ where: { workspaceId: { in: wsIds } } });
        await client.inbox.deleteMany({ where: { workspaceId: { in: wsIds } } });
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

  describe('checkInventory Tool — Real PostgreSQL Database', () => {
    it('Scenario #3: should return available stock > 0 and isInStock = true for in-stock variant', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.checkInventory as any).execute(
        { variantId: variantInStockId },
        {} as any,
      );

      expect(result.variantId).toBe(variantInStockId);
      expect(result.availableStock).toBe(8); // 10 stock - 2 reserved
      expect(result.isInStock).toBe(true);
      expect(result.name).toContain('Trang / L');
    });

    it('Scenario #4: should return availableStock = 0 and isInStock = false when stock is fully reserved', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.checkInventory as any).execute(
        { variantId: variantOutOfStockId },
        {} as any,
      );

      expect(result.variantId).toBe(variantOutOfStockId);
      expect(result.availableStock).toBe(0); // 5 stock - 5 reserved
      expect(result.isInStock).toBe(false);
    });

    it('should reject variant belonging to foreign workspace (Strict Multi-Tenancy)', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.checkInventory as any).execute(
        { variantId: foreignVariantId },
        {} as any,
      );

      expect(result.error).toBe('VARIANT_NOT_FOUND');
    });
  });

  let createdDraftOrderId: string;

  describe('createDraftOrder Tool — Real PostgreSQL Database', () => {
    it('Scenario #5: should create DRAFT order with verified DB pricing without modifying inventory', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
      });

      const result: any = await (tools.createDraftOrder as any).execute(
        {
          items: [{ variantId: variantInStockId, quantity: 2 }],
          shippingAddress: {
            recipientName: 'Hoang Van Thuong',
            phoneNumber: '0988776655',
            province: 'Thành phố Hà Nội',
            district: 'Quận Hai Bà Trưng',
            ward: 'Phường Đồng Tâm',
            streetAddress: 'Số 10 Lê Thanh Nghị',
          },
          shippingFee: 30000,
        },
        {} as any,
      );

      expect(result.orderId).toBeTruthy();
      createdDraftOrderId = result.orderId;
      expect(result.status).toBe(OrderStatus.DRAFT);
      expect(result.subtotal).toBe(600000); // 2 * 300,000đ (pricing fetched from DB)
      expect(result.totalAmount).toBe(630000); // 600,000 + 30,000 ship
      expect(result.items.length).toBe(1);
      expect(result.items[0].unitPrice).toBe(300000);

      // Verify PostgreSQL: Order created as DRAFT
      const orderInDb = await prismaService.client.order.findFirstOrThrow({
        where: { id: result.orderId, workspaceId: testWorkspaceId },
        include: { items: true },
      });
      expect(orderInDb.status).toBe(OrderStatus.DRAFT);
      expect(Number(orderInDb.totalAmount)).toBe(630000);
      expect(orderInDb.items.length).toBe(1);

      // Invariant check: Inventory stock & reservedQuantity must NOT be reserved in DRAFT state
      const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
        where: { id: variantInStockId, workspaceId: testWorkspaceId },
      });
      expect(variantInDb.stockQuantity).toBe(10);
      expect(variantInDb.reservedQuantity).toBe(2); // still 2, not incremented!
    });

    it('Scenario #6: should reject draft order when requested quantity exceeds available stock', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      // variantOutOfStock has 0 availableStock
      const result: any = await (tools.createDraftOrder as any).execute(
        {
          items: [{ variantId: variantOutOfStockId, quantity: 1 }],
        },
        {} as any,
      );

      expect(result.error).toBe('INSUFFICIENT_STOCK');
      expect(result.availableStock).toBe(0);
      expect(result.requestedQuantity).toBe(1);
    });

    it('Scenario #7: should reject draft order when discount exceeds policy limits', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
        policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
      });

      // Subtotal: 1 * 300,000 = 300,000. 10% = 30,000. Max VND = 50,000.
      // Trying to apply 100,000 discount
      const result: any = await (tools.createDraftOrder as any).execute(
        {
          items: [{ variantId: variantInStockId, quantity: 1 }],
          discountAmount: 100000,
        },
        {} as any,
      );

      expect(result.error).toBe('DISCOUNT_LIMIT_EXCEEDED');
      expect(result.allowedDiscount).toBe(30000);
    });

    it('should enforce multi-tenancy: reject variants from another workspace', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.createDraftOrder as any).execute(
        {
          items: [{ variantId: foreignVariantId, quantity: 1 }],
        },
        {} as any,
      );

      expect(result.error).toBe('VARIANT_NOT_FOUND');
    });
  });

  describe('confirmAndGenerateQR Tool — Real PostgreSQL Database', () => {
    it('Scenario #8: should confirm DRAFT order, atomically reserve stock, and generate VietQR payload', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      // Stock before confirm: stock 10, reserved 2. Order had quantity 2.
      const result: any = await (tools.confirmAndGenerateQR as any).execute(
        { orderId: createdDraftOrderId },
        {} as any,
      );

      expect(result.orderId).toBe(createdDraftOrderId);
      expect(result.totalAmount).toBe(630000);
      expect(result.bankName).toBe('MBBank');
      expect(result.qrImageUrl).toContain('img.vietqr.io');
      expect(result.qrPayload).toBeTruthy();

      // Verify PostgreSQL: Order transitioned to CONFIRMED
      const confirmedOrder = await prismaService.client.order.findFirstOrThrow({
        where: { id: createdDraftOrderId, workspaceId: testWorkspaceId },
      });
      expect(confirmedOrder.status).toBe(OrderStatus.CONFIRMED);
      expect(confirmedOrder.confirmedAt).toBeTruthy();

      // Verify PostgreSQL: stock reservation atomically incremented (reserved: 2 -> 4)
      const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
        where: { id: variantInStockId, workspaceId: testWorkspaceId },
      });
      expect(variantInDb.stockQuantity).toBe(10);
      expect(variantInDb.reservedQuantity).toBe(4);

      // Verify interactive QR card message was dispatched
      const qrCardMessage = sentMessages.find(m => m.metadata?.type === 'VIETQR_PAYMENT');
      expect(qrCardMessage).toBeTruthy();
      expect(qrCardMessage.metadata.qrData.orderId).toBe(createdDraftOrderId);
    });

    it('Scenario #9: should be idempotent and skip re-confirming already CONFIRMED order', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      // Call confirm again on the already CONFIRMED order
      const result: any = await (tools.confirmAndGenerateQR as any).execute(
        { orderId: createdDraftOrderId },
        {} as any,
      );

      expect(result.orderId).toBe(createdDraftOrderId);
      expect(result.qrImageUrl).toContain('img.vietqr.io');

      // Invariant check: reservedQuantity must NOT increment again (remains 4, not 6!)
      const variantInDb = await prismaService.client.productVariant.findFirstOrThrow({
        where: { id: variantInStockId, workspaceId: testWorkspaceId },
      });
      expect(variantInDb.reservedQuantity).toBe(4);
    });

    it('should reject confirming order that does not exist in workspace', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.confirmAndGenerateQR as any).execute(
        { orderId: 'non-existent-order-id' },
        {} as any,
      );

      expect(result.error).toBe('ORDER_NOT_FOUND');
    });
  });

  describe('updateContactInfo Tool — Real PostgreSQL Database', () => {
    it('Scenario #12: should normalize phone number to E.164 and persist update in PostgreSQL', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.updateContactInfo as any).execute(
        {
          name: 'Hoang Van Thuong (Updated)',
          phoneNumber: '0912345678',
          address: '45 Pho Hue, Hang Bai, Hoan Kiem, Ha Noi',
        },
        {} as any,
      );

      expect(result.updated).toBe(true);
      expect(result.name).toBe('Hoang Van Thuong (Updated)');
      expect(result.phoneNumber).toBe('+84912345678'); // E.164 normalized
      expect(result.address).toBe('45 Pho Hue, Hang Bai, Hoan Kiem, Ha Noi');

      // Verify in PostgreSQL database
      const contactInDb = await prismaService.client.contact.findFirstOrThrow({
        where: { id: testContactId, workspaceId: testWorkspaceId },
      });
      expect(contactInDb.name).toBe('Hoang Van Thuong (Updated)');
      expect(contactInDb.phoneNumber).toBe('+84912345678');
      expect((contactInDb.customAttributes as Record<string, any>)?.address).toBe(
        '45 Pho Hue, Hang Bai, Hoan Kiem, Ha Noi',
      );
    });

    it('Scenario #13: should reject and return error when phone number format is invalid', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      const result: any = await (tools.updateContactInfo as any).execute(
        {
          phoneNumber: '012345', // invalid phone format
        },
        {} as any,
      );

      expect(result.updated).toBe(false);
      expect(result.error).toBe('INVALID_PHONE_NUMBER');
      expect(result.message).toContain('Số điện thoại không hợp lệ');

      // Verify contact phone in PostgreSQL remains unchanged
      const contactInDb = await prismaService.client.contact.findFirstOrThrow({
        where: { id: testContactId, workspaceId: testWorkspaceId },
      });
      expect(contactInDb.phoneNumber).toBe('+84912345678');
    });
  });

  describe('escalateToHuman Tool — Real PostgreSQL Database', () => {
    it('Scenario #14: should escalate conversation, set isAiPaused = true in DB, and clear Redis debounce key', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: testConversationId,
      });

      // Verify conversation before escalation
      const convBefore = await prismaService.client.conversation.findFirstOrThrow({
        where: { id: testConversationId, workspaceId: testWorkspaceId },
      });
      expect(convBefore.isAiPaused).toBe(false);

      const result: any = await (tools.escalateToHuman as any).execute(
        { reason: 'Khách hàng yêu cầu hỗ trợ đổi trả áo bị rách chỉ' },
        {} as any,
      );

      expect(result.escalated).toBe(true);
      expect(result.reason).toBe('Khách hàng yêu cầu hỗ trợ đổi trả áo bị rách chỉ');

      // Verify in PostgreSQL: isAiPaused is now true
      const convAfter = await prismaService.client.conversation.findFirstOrThrow({
        where: { id: testConversationId, workspaceId: testWorkspaceId },
      });
      expect(convAfter.isAiPaused).toBe(true);

      // Verify messages dispatched (farewell message + internal note)
      const farewellMsg = sentMessages.find(m => m.metadata?.isEscalationFarewell);
      expect(farewellMsg).toBeTruthy();
      expect(farewellMsg.metadata.escalationReason).toContain('đổi trả áo');

      const escalationNote = sentMessages.find(m => m.metadata?.type === 'AI_ESCALATION_NOTE');
      expect(escalationNote).toBeTruthy();
      expect(escalationNote.isPrivate).toBe(true);

      // Verify Redis debounce key was purged
      expect(deletedRedisKeys.length).toBeGreaterThanOrEqual(1);
      expect(
        deletedRedisKeys.some(k => k.includes(`ai:debounce:${testConversationId}`)),
      ).toBeTruthy();
    });

    it('should return error when conversationId is missing', async () => {
      const tools = registry.buildTools({
        workspaceId: testWorkspaceId,
        conversationId: undefined,
      });

      const result: any = await (tools.escalateToHuman as any).execute(
        { reason: 'Vấn đề hỗ trợ' },
        {} as any,
      );

      expect(result.escalated).toBe(false);
      expect(result.error).toBe('MISSING_CONVERSATION_ID');
    });
  });
});
