import { OrderStatus } from '@sales-copilot/shared-contracts';
import { CommerceToolRegistry } from '../commerce-tool.registry';
import { DiscountGuardService } from '../../services/discount-guard.service';

describe('CommerceToolRegistry & 2 AM Customer Journey', () => {
  const workspaceA = 'ws-store-alpha';
  const workspaceB = 'ws-store-beta';
  const conversationId = 'conv-2am-midnight';

  let registry: CommerceToolRegistry;
  let mockPrisma: any;
  let mockRedis: any;
  let mockProductsService: any;
  let mockOrdersService: any;
  let mockInventoryService: any;
  let mockVietQrService: any;
  let mockContactsService: any;
  let mockMessagesService: any;

  // In-memory mock database
  let productsDb: any[];
  let variantsDb: any[];
  let ordersDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let messagesDb: any[];

  beforeEach(() => {
    ordersDb = new Map();
    contactsDb = new Map();
    messagesDb = [];

    // Products belonging to Workspace A
    productsDb = [
      {
        id: 'prod-polo-alpha',
        name: 'Áo Polo Cotton',
        basePrice: 150000,
        imageUrl: 'https://example.com/polo.jpg',
        workspaceId: workspaceA,
        isActive: true,
      },
      // Product belonging to Workspace B (cross-tenant)
      {
        id: 'prod-polo-beta',
        name: 'Áo Polo Lụa Cao Cấp',
        basePrice: 500000,
        imageUrl: 'https://example.com/silk-polo.jpg',
        workspaceId: workspaceB,
        isActive: true,
      },
    ];

    variantsDb = [
      {
        id: 'var-polo-l-alpha',
        productId: 'prod-polo-alpha',
        name: 'Trắng / L',
        sku: 'POLO-WHT-L',
        price: 150000,
        stockQuantity: 23,
        reservedQuantity: 0,
        availableStock: 23,
        workspaceId: workspaceA,
        isActive: true,
        product: productsDb[0],
      },
      {
        id: 'var-polo-beta',
        productId: 'prod-polo-beta',
        name: 'Đen / M',
        sku: 'BETA-BLK-M',
        price: 500000,
        stockQuantity: 10,
        reservedQuantity: 0,
        availableStock: 10,
        workspaceId: workspaceB,
        isActive: true,
        product: productsDb[1],
      },
    ];

    mockPrisma = {
      getClient: () => ({
        productVariant: {
          findFirst: async ({ where }: any) => {
            return (
              variantsDb.find(v => v.id === where.id && v.workspaceId === where.workspaceId) || null
            );
          },
          findMany: async ({ where }: any) => {
            return variantsDb.filter(
              v => where.id.in.includes(v.id) && v.workspaceId === where.workspaceId,
            );
          },
        },
        order: {
          findFirst: async ({ where }: any) => {
            const o = ordersDb.get(where.id);
            if (o && o.workspaceId === where.workspaceId) return o;
            return null;
          },
        },
        conversation: {
          findFirst: async ({ where }: any) => {
            if (where.id === conversationId && where.workspaceId === workspaceA) {
              return { id: conversationId, contactId: 'contact-nam' };
            }
            return null;
          },
          updateMany: async () => ({ count: 1 }),
        },
        contact: {
          findFirst: async ({ where }: any) => {
            for (const c of contactsDb.values()) {
              if (c.workspaceId === where.workspaceId && c.phoneNumber === where.phoneNumber) {
                return c;
              }
            }
            return null;
          },
          create: async ({ data }: any) => {
            const id = 'contact-' + Date.now();
            const c = { id, ...data };
            contactsDb.set(id, c);
            return c;
          },
        },
      }),
    };

    mockRedis = {
      del: async () => {},
    };

    mockProductsService = {
      listProducts: async (wsId: string, params: any) => {
        const items = productsDb
          .filter(p => p.workspaceId === wsId && p.isActive)
          .filter(p => !params.search || p.name.toLowerCase().includes(params.search.toLowerCase()))
          .map(p => ({
            ...p,
            variants: variantsDb.filter(v => v.productId === p.id && v.isActive),
          }));
        return { items, meta: { total: items.length } };
      },
      getProductById: async (wsId: string, id: string) => {
        const p = productsDb.find(prod => prod.id === id && prod.workspaceId === wsId);
        if (!p) throw new Error('Not found');
        return {
          ...p,
          variants: variantsDb.filter(v => v.productId === p.id && v.isActive),
        };
      },
    };

    mockInventoryService = {
      getStock: async (wsId: string, variantId: string) => {
        const v = variantsDb.find(
          varItem => varItem.id === variantId && varItem.workspaceId === wsId,
        );
        if (!v) throw new Error('Not found');
        return {
          variantId: v.id,
          sku: v.sku,
          stockQuantity: v.stockQuantity,
          reservedQuantity: v.reservedQuantity,
          availableStock: v.stockQuantity - v.reservedQuantity,
        };
      },
    };

    mockOrdersService = {
      createOrder: async (wsId: string, dto: any) => {
        const orderId = 'ord-1042';
        const order = {
          id: orderId,
          orderNumber: 'ORD-20260917-1042',
          displayId: 1042,
          workspaceId: wsId,
          status: OrderStatus.DRAFT,
          subtotal: 150000,
          discountAmount: dto.discountAmount || 0,
          shippingFee: dto.shippingFee || 30000,
          totalAmount: 180000,
          items: [
            {
              variantId: 'var-polo-l-alpha',
              productName: 'Áo Polo Cotton',
              variantName: 'Trắng / L',
              quantity: 1,
              unitPrice: 150000,
              totalPrice: 150000,
            },
          ],
          shippingAddress: dto.shippingAddress,
        };
        ordersDb.set(orderId, order);
        return order;
      },
      confirmOrder: async (wsId: string, orderId: string) => {
        const order = ordersDb.get(orderId);
        if (!order || order.workspaceId !== wsId) throw new Error('Order not found');
        order.status = OrderStatus.CONFIRMED;
        return order;
      },
    };

    mockVietQrService = {
      generateForOrder: async (_wsId: string, orderId: string, opts: any) => {
        const order = ordersDb.get(orderId);
        return {
          orderId,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          amount: order.totalAmount,
          qrUrl: 'https://img.vietqr.io/image/MB-0988123456-compact2.png',
          qrPayload:
            '00020101021238570010A00000072701270006970422011309881234560208QRIBFTTA530370454061800005802VN5913SALES COPILOT6006HA NOI62100806DH1042630429B1',
          bankName: 'MBBank',
          accountNumber: '0988123456',
          accountName: 'SALES COPILOT',
          transferContent: opts?.memo || 'DH1042',
        };
      },
    };

    mockContactsService = {
      update: async (wsId: string, contactId: string, payload: any) => {
        const c = contactsDb.get(contactId) || { id: contactId, workspaceId: wsId };
        const updated = { ...c, ...payload };
        contactsDb.set(contactId, updated);
        return updated;
      },
    };

    mockMessagesService = {
      create: async (wsId: string, convId: string, payload: any) => {
        const msg = { id: 'msg-' + Date.now(), wsId, convId, ...payload };
        messagesDb.push(msg);
        return msg;
      },
    };

    registry = new CommerceToolRegistry(
      mockPrisma,
      mockRedis,
      mockProductsService,
      mockOrdersService,
      mockInventoryService,
      mockVietQrService,
      mockContactsService,
      mockMessagesService,
      new DiscountGuardService(),
    );
  });

  it('should build all 9 tools and strictly isolate multi-tenancy (no workspaceId in parameters)', () => {
    const tools = registry.buildTools({
      workspaceId: workspaceA,
      conversationId,
      policy: { enabled: true, maxDiscountPercent: 10 },
    });

    // 1. Exactly 9 tools built
    const toolNames = Object.keys(tools);
    expect(toolNames.length).toBe(9);
    expect(toolNames.includes('searchProducts')).toBeTruthy();
    expect(toolNames.includes('getProductDetails')).toBeTruthy();
    expect(toolNames.includes('checkInventory')).toBeTruthy();
    expect(toolNames.includes('extractShippingInfo')).toBeTruthy();
    expect(toolNames.includes('evaluateDiscount')).toBeTruthy();
    expect(toolNames.includes('createDraftOrder')).toBeTruthy();
    expect(toolNames.includes('confirmAndGenerateQR')).toBeTruthy();
    expect(toolNames.includes('updateContactInfo')).toBeTruthy();
    expect(toolNames.includes('escalateToHuman')).toBeTruthy();

    // 2. Strict Multi-tenancy check: none of the tool schemas should leak workspaceId
    for (const name of toolNames) {
      const toolObj: any = tools[name];
      const shape = toolObj?.inputSchema?._def?.shape();
      if (shape) {
        expect(shape.workspaceId).toBe(undefined);
      }
    }
  });

  it('should enforce cross-tenant data isolation: Workspace A cannot view or order Workspace B products', async () => {
    const toolsA = registry.buildTools({ workspaceId: workspaceA });

    // Try to search or create order for beta variant from workspace A
    const searchResult: any = await (toolsA.searchProducts as any).execute(
      { query: 'Lụa' },
      {} as any,
    );
    expect(searchResult.length).toBe(0);

    const orderResult: any = await (toolsA.createDraftOrder as any).execute(
      { items: [{ variantId: 'var-polo-beta', quantity: 1 }] },
      {} as any,
    );
    expect(orderResult.error).toBe('VARIANT_NOT_FOUND');
  });

  it('should complete the 2 AM End-to-End User Journey smoothly', async () => {
    const tools = registry.buildTools({
      workspaceId: workspaceA,
      conversationId,
      policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 50000 },
    });

    // Step 1: Customer asks: "Áo polo trắng size L còn ko shop?"
    const searchRes: any = await (tools.searchProducts as any).execute(
      { query: 'áo polo' },
      {} as any,
    );
    expect(searchRes.length).toBe(1);
    expect(searchRes[0].name).toBe('Áo Polo Cotton');
    expect(searchRes[0].variants[0].name).toBe('Trắng / L');
    expect(searchRes[0].variants[0].price).toBe(150000);
    expect(searchRes[0].variants[0].availableStock).toBe(23);

    // Step 2: Customer sends address: "15 ngõ 45 Vọng, Đồng Tâm, HBT, HN. SĐT 0988123456"
    const extractRes: any = await (tools.extractShippingInfo as any).execute(
      { text: '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội. SĐT 0988123456' },
      {} as any,
    );
    expect(extractRes.phoneNumber).toBe('0988123456');
    expect(extractRes.province).toBe('Thành phố Hà Nội');
    expect(extractRes.district).toBe('Quận Hai Bà Trưng');
    expect(extractRes.ward).toBe('Phường Đồng Tâm');

    // Step 3: AI updates contact info
    const contactRes: any = await (tools.updateContactInfo as any).execute(
      {
        phoneNumber: extractRes.phoneNumber,
        address: '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội',
      },
      {} as any,
    );
    expect(contactRes.updated).toBe(true);
    expect(contactRes.phoneNumber).toBe('+84988123456');

    // Step 4: AI creates Draft Order (#DH1042, total 180k = 150k + 30k ship)
    const orderRes: any = await (tools.createDraftOrder as any).execute(
      {
        items: [{ variantId: searchRes[0].variants[0].variantId, quantity: 1 }],
        shippingAddress: {
          recipientName: 'Anh Nam',
          phoneNumber: extractRes.phoneNumber,
          province: extractRes.province,
          district: extractRes.district,
          ward: extractRes.ward,
          streetAddress: '15 ngõ 45 Vọng',
        },
        shippingFee: 30000,
      },
      {} as any,
    );
    expect(orderRes.orderId).toBe('ord-1042');
    expect(orderRes.displayId).toBe(1042);
    expect(orderRes.status).toBe('DRAFT');
    expect(orderRes.totalAmount).toBe(180000);

    // Step 5: AI confirms order and generates VietQR
    const qrRes: any = await (tools.confirmAndGenerateQR as any).execute(
      { orderId: orderRes.orderId },
      {} as any,
    );
    expect(qrRes.orderId).toBe('ord-1042');
    expect(qrRes.displayId).toBe(1042);
    expect(qrRes.transferContent).toBe('DH1042');
    expect(qrRes.qrImageUrl.includes('img.vietqr.io')).toBeTruthy();

    // Check that order status transitioned to CONFIRMED
    const updatedOrder = ordersDb.get('ord-1042');
    expect(updatedOrder.status).toBe(OrderStatus.CONFIRMED);

    // Check that VietQR interactive card message was posted to conversation
    const qrMessage = messagesDb.find(m => m.metadata?.type === 'VIETQR_PAYMENT');
    expect(qrMessage).toBeTruthy();
    expect(qrMessage.metadata.qrData.amount).toBe(180000);
  });
});
