import { createCreateDraftOrderTool } from '../create-draft-order.tool';
import { DiscountGuardService } from '../../../services/discount-guard.service';

describe('createDraftOrder Tool (T6)', () => {
  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';
  let mockPrisma: any;
  let mockOrdersService: any;
  let discountGuardService: DiscountGuardService;
  let createdOrders: any[];

  beforeEach(() => {
    discountGuardService = new DiscountGuardService();
    createdOrders = [];

    const variantsDb: any[] = [
      {
        id: 'var-polo-l',
        productId: 'prod-polo',
        name: 'Trắng / L',
        sku: 'POLO-WHT-L',
        price: 150000,
        stockQuantity: 23,
        reservedQuantity: 0,
        workspaceId,
        isActive: true,
        product: { id: 'prod-polo', name: 'Áo Polo', basePrice: 150000, isActive: true },
      },
      {
        id: 'var-low-stock',
        productId: 'prod-low',
        name: 'Đen / M',
        sku: 'LOW-BLK-M',
        price: 200000,
        stockQuantity: 2,
        reservedQuantity: 1,
        workspaceId,
        isActive: true,
        product: { id: 'prod-low', name: 'Áo Khoác', basePrice: 200000, isActive: true },
      },
      {
        id: 'var-other-ws',
        productId: 'prod-other',
        name: 'Khác',
        sku: 'OTHER',
        price: 100000,
        stockQuantity: 10,
        reservedQuantity: 0,
        workspaceId: 'ws-other',
        isActive: true,
        product: { id: 'prod-other', name: 'Hàng Khác', basePrice: 100000, isActive: true },
      },
    ];

    mockPrisma = {
      getClient: () => ({
        productVariant: {
          findMany: async ({ where }: any) => {
            return variantsDb.filter(
              v => where.id.in.includes(v.id) && v.workspaceId === where.workspaceId,
            );
          },
        },
        conversation: {
          findFirst: async ({ where }: any) => {
            if (where.id === conversationId && where.workspaceId === workspaceId) {
              return { id: conversationId, contactId: 'contact-existing' };
            }
            return null;
          },
          updateMany: async () => ({ count: 1 }),
        },
        contact: {
          findFirst: async () => null,
          create: async ({ data }: any) => ({ id: 'contact-new', ...data }),
        },
      }),
    };

    mockOrdersService = {
      createOrder: async (wsId: string, dto: any) => {
        const order = {
          id: 'ord-1042',
          orderNumber: 'ORD-20260917-1042',
          displayId: 1042,
          totalAmount: 180000,
          subtotal: 150000,
          discountAmount: dto.discountAmount || 0,
          shippingFee: dto.shippingFee || 30000,
          items: [
            {
              variantId: 'var-polo-l',
              productName: 'Áo Polo',
              variantName: 'Trắng / L',
              quantity: 1,
              unitPrice: 150000,
              totalPrice: 150000,
            },
          ],
          shippingAddress: dto.shippingAddress,
        };
        createdOrders.push(order);
        return order;
      },
    };
  });

  it('should successfully create a draft order with verified DB prices', async () => {
    const tool = createCreateDraftOrderTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      discountGuardService,
      prisma: mockPrisma,
      policy: { enabled: true, maxDiscountPercent: 10 },
    });

    const result = await tool.execute!(
      {
        items: [{ variantId: 'var-polo-l', quantity: 1 }],
        shippingAddress: {
          recipientName: 'Anh Nam',
          phoneNumber: '0988123456',
          province: 'Hà Nội',
          district: 'Hai Bà Trưng',
          ward: 'Đồng Tâm',
          streetAddress: '15 ngõ 45 Vọng',
        },
        shippingFee: 30000,
      },
      {} as any,
    );

    expect(result.orderId).toBe('ord-1042');
    expect(result.orderNumber).toBe('ORD-20260917-1042');
    expect(result.status).toBe('DRAFT');
    expect(result.items.length).toBe(1);
    expect(result.items[0].unitPrice).toBe(150000);
  });

  it('should reject when requested quantity exceeds available stock', async () => {
    const tool = createCreateDraftOrderTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      discountGuardService,
      prisma: mockPrisma,
    });

    // var-low-stock has stockQuantity: 2, reserved: 1 => available: 1. Requesting 5!
    const result = await tool.execute!(
      {
        items: [{ variantId: 'var-low-stock', quantity: 5 }],
      },
      {} as any,
    );

    expect(result.error).toBe('INSUFFICIENT_STOCK');
    expect(result.availableStock).toBe(1);
    expect(result.requestedQuantity).toBe(5);
  });

  it('should reject when discount exceeds policy limits (Double-Check Guard)', async () => {
    const tool = createCreateDraftOrderTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      discountGuardService,
      prisma: mockPrisma,
      policy: { enabled: true, maxDiscountPercent: 10, maxDiscountVnd: 20000 },
    });

    // Subtotal 150,000. 10% = 15,000. LLM attempts discountAmount: 30,000
    const result = await tool.execute!(
      {
        items: [{ variantId: 'var-polo-l', quantity: 1 }],
        discountAmount: 30000,
      },
      {} as any,
    );

    expect(result.error).toBe('DISCOUNT_LIMIT_EXCEEDED');
    expect(result.allowedDiscount).toBe(15000);
  });

  it('should enforce multi-tenancy and reject variants belonging to other workspaces', async () => {
    const tool = createCreateDraftOrderTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      discountGuardService,
      prisma: mockPrisma,
    });

    const result = await tool.execute!(
      {
        items: [{ variantId: 'var-other-ws', quantity: 1 }],
      },
      {} as any,
    );

    expect(result.error).toBe('VARIANT_NOT_FOUND');
    expect(result.missingVariantIds.includes('var-other-ws')).toBeTruthy();
  });
});
