import type {
  PrismaClient,
  Workspace,
  User,
  Contact,
  Product,
  ProductVariant,
  Conversation,
  Order,
} from '../../src/infrastructure/database';

export interface OrdersPaymentsSeedResult {
  orders: Order[];
}

export async function seedOrdersPayments(
  prisma: PrismaClient,
  workspace: Workspace,
  users: { superAdmin: User; admin: User; agent: User },
  contacts: Contact[],
  products: Product[],
  variants: ProductVariant[],
  conversations: Conversation[],
): Promise<OrdersPaymentsSeedResult> {
  console.log(
    '🛒 [07-Orders & Payments] Seeding 8 realistic orders, VietQR payments, and inventory ledger...',
  );

  const findContact = (identifier: string) => contacts.find(c => c.identifier === identifier)!;
  const findProduct = (sku: string) => products.find(p => p.sku === sku)!;
  const findVariant = (sku: string) => variants.find(v => v.sku === sku)!;

  const seededOrders: Order[] = [];

  // ===========================================================================
  // ORDER 1: ORD-20260901-0001 - COMPLETED, PAID (Nguyễn Văn An - Enterprise SaaS)
  // ===========================================================================
  const cust1 = findContact('CUST_VN_001');
  const prod1 = findProduct('SaaS-ENTERPRISE');
  const var1 = findVariant('SaaS-ENTERPRISE-50U');
  const conv1 = conversations[0];

  const order1 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260901-0001',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260901-0001',
      contactId: cust1.id,
      conversationId: conv1?.id,
      createdById: users.superAdmin.id,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'DELIVERED',
      subtotal: 12000000,
      discountAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 12000000,
      paidAmount: 12000000,
      currency: 'VND',
      customerNotes: 'Kích hoạt bản quyền qua email kỹ thuật: tech@toancau.vn',
      internalNotes: 'Hợp đồng số HD-2026/TC-SC ký ngày 01/09/2026.',
      recipientName: cust1.name,
      recipientPhone: cust1.phoneNumber,
      recipientAddress: '72 Lê Thánh Tôn',
      recipientWard: 'Phường Bến Nghé',
      recipientDistrict: 'Quận 1',
      recipientProvince: 'Thành phố Hồ Chí Minh',
      confirmedAt: new Date('2026-09-01T09:30:00Z'),
      paidAt: new Date('2026-09-01T10:15:00Z'),
      completedAt: new Date('2026-09-01T10:30:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order1.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order1.id,
      productId: prod1.id,
      variantId: var1.id,
      productName: prod1.name,
      variantName: var1.name,
      sku: var1.sku,
      unitPrice: 12000000,
      costPrice: 8000000,
      quantity: 1,
      totalPrice: 12000000,
    },
  });

  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_evt_ORD0001_success',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order1.id,
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 12000000,
      currency: 'VND',
      status: 'SUCCESS',
      transactionCode: 'MB_TXN_9876541',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'DH0001',
      qrUrl:
        'https://img.vietqr.io/image/970422-0988123456-compact2.png?amount=12000000&addInfo=DH0001&accountName=CONG%20TY%20SALES%20COPILOT',
      paidAt: new Date('2026-09-01T10:15:00Z'),
      idempotencyKey: 'sepay_evt_ORD0001_success',
      rawWebhookPayload: {
        gateway: 'sepay',
        transactionDate: '2026-09-01 10:15:22',
        accountNumber: '0988123456',
        subAccount: null,
        transferType: 'in',
        transferAmount: 12000000,
        accumulated: 12000000,
        code: null,
        transactionContent: 'DH0001 NGUYEN VAN AN CHUYEN KHOAN GEP ENTERPRISE',
        referenceNumber: 'FT262450098712',
        body: null,
      },
    },
  });
  seededOrders.push(order1);

  // ===========================================================================
  // ORDER 2: ORD-20260905-0002 - CONFIRMED, UNPAID, VietQR Pending (Trần Minh Tuấn)
  // ===========================================================================
  const cust2 = findContact('CUST_VN_002');
  const prod2 = findProduct('SONY-WH1000XM5');
  const var2 = findVariant('SONY-WH1000XM5-BLK');
  const conv2 = conversations[1];

  const order2 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260905-0002',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260905-0002',
      contactId: cust2.id,
      conversationId: conv2?.id,
      createdById: users.agent.id,
      status: 'CONFIRMED',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      subtotal: 7990000,
      discountAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 7990000,
      paidAmount: 0,
      currency: 'VND',
      customerNotes: 'Giao hỏa tốc trước 17h.',
      recipientName: cust2.name,
      recipientPhone: cust2.phoneNumber,
      recipientAddress: '18 Tam Trinh',
      recipientWard: 'Phường Mai Động',
      recipientDistrict: 'Quận Hoàng Mai',
      recipientProvince: 'Thành phố Hà Nội',
      confirmedAt: new Date('2026-09-05T14:10:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order2.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order2.id,
      productId: prod2.id,
      variantId: var2.id,
      productName: prod2.name,
      variantName: var2.name,
      sku: var2.sku,
      unitPrice: 7990000,
      costPrice: 6200000,
      quantity: 1,
      totalPrice: 7990000,
    },
  });

  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_qr_ORD0002_pending',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order2.id,
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 7990000,
      currency: 'VND',
      status: 'PENDING',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'DH0002',
      qrUrl:
        'https://img.vietqr.io/image/970422-0988123456-compact2.png?amount=7990000&addInfo=DH0002&accountName=CONG%20TY%20SALES%20COPILOT',
      idempotencyKey: 'sepay_qr_ORD0002_pending',
    },
  });

  // Stock Reservation
  await prisma.inventoryTransaction.create({
    data: {
      workspaceId: workspace.id,
      variantId: var2.id,
      orderId: order2.id,
      type: 'RESERVATION',
      quantity: 1,
      previousStock: var2.stockQuantity,
      newStock: var2.stockQuantity,
      previousReserved: 0,
      newReserved: 1,
      reason: 'Tạm giữ 1 chiếc tai nghe Sony Đen cho đơn hàng ORD-20260905-0002',
      performedByUserId: users.agent.id,
    },
  });
  seededOrders.push(order2);

  // ===========================================================================
  // ORDER 3: ORD-20260908-0003 - SHIPPING, PARTIALLY_PAID (Lê Thanh Hương - 20 Polos)
  // ===========================================================================
  const cust3 = findContact('CUST_VN_003');
  const prod3 = findProduct('POLO-CORP-2026');
  const var3 = findVariant('POLO-CORP-L-NAVY');
  const conv3 = conversations[2];

  const order3 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260908-0003',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260908-0003',
      contactId: cust3.id,
      conversationId: conv3?.id,
      createdById: users.agent.id,
      status: 'SHIPPING',
      paymentStatus: 'PARTIALLY_PAID',
      fulfillmentStatus: 'SHIPPED',
      subtotal: 5000000,
      discountAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 5000000,
      paidAmount: 2000000, // Deposit paid
      currency: 'VND',
      customerNotes: 'Đã cọc 2.000.000đ, còn lại 3.000.000đ thu COD.',
      recipientName: cust3.name,
      recipientPhone: cust3.phoneNumber,
      recipientAddress: '142 Nguyễn Thị Minh Khai',
      recipientWard: 'Phường 6',
      recipientDistrict: 'Quận 3',
      recipientProvince: 'Thành phố Hồ Chí Minh',
      confirmedAt: new Date('2026-09-08T11:00:00Z'),
      paidAt: new Date('2026-09-08T11:20:00Z'),
      shippedAt: new Date('2026-09-08T15:00:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order3.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order3.id,
      productId: prod3.id,
      variantId: var3.id,
      productName: prod3.name,
      variantName: var3.name,
      sku: var3.sku,
      unitPrice: 250000,
      costPrice: 150000,
      quantity: 20,
      totalPrice: 5000000,
    },
  });

  // Tx 1: Deposit via VietQR (Success)
  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_evt_ORD0003_deposit',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order3.id,
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 2000000,
      currency: 'VND',
      status: 'SUCCESS',
      transactionCode: 'MB_TXN_9876543',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'COC DH0003',
      paidAt: new Date('2026-09-08T11:20:00Z'),
      idempotencyKey: 'sepay_evt_ORD0003_deposit',
    },
  });

  // Tx 2: Pending COD remainder
  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'manual_cod_ORD0003_remain',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order3.id,
      paymentMethod: 'COD',
      gateway: 'MANUAL',
      amount: 3000000,
      currency: 'VND',
      status: 'PENDING',
      transferContent: 'COD DH0003',
      idempotencyKey: 'manual_cod_ORD0003_remain',
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      workspaceId: workspace.id,
      variantId: var3.id,
      orderId: order3.id,
      type: 'RESERVATION',
      quantity: 20,
      previousStock: var3.stockQuantity,
      newStock: var3.stockQuantity,
      previousReserved: 0,
      newReserved: 20,
      reason: 'Tạm giữ 20 áo polo L cho đơn hàng ORD-20260908-0003',
      performedByUserId: users.agent.id,
    },
  });
  seededOrders.push(order3);

  // ===========================================================================
  // ORDER 4: ORD-20260910-0004 - SHIPPING, UNPAID (Phạm Quốc Bảo - Logitech Mouse COD)
  // ===========================================================================
  const cust4 = findContact('CUST_VN_004');
  const prod4 = findProduct('LOGI-MX3S');
  const var4 = findVariant('LOGI-MX3S-GRPH');

  const order4 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260910-0004',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260910-0004',
      contactId: cust4.id,
      createdById: users.admin.id,
      status: 'SHIPPING',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'SHIPPED',
      subtotal: 2490000,
      discountAmount: 0,
      shippingFee: 30000,
      taxAmount: 0,
      totalAmount: 2520000,
      paidAmount: 0,
      currency: 'VND',
      recipientName: cust4.name,
      recipientPhone: cust4.phoneNumber,
      recipientAddress: '54 Liễu Giai',
      recipientWard: 'Phường Cống Vị',
      recipientDistrict: 'Quận Ba Đình',
      recipientProvince: 'Thành phố Hà Nội',
      confirmedAt: new Date('2026-09-10T09:00:00Z'),
      shippedAt: new Date('2026-09-10T14:30:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order4.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order4.id,
      productId: prod4.id,
      variantId: var4.id,
      productName: prod4.name,
      variantName: var4.name,
      sku: var4.sku,
      unitPrice: 2490000,
      costPrice: 1850000,
      quantity: 1,
      totalPrice: 2490000,
    },
  });

  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'manual_cod_ORD0004',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order4.id,
      paymentMethod: 'COD',
      gateway: 'MANUAL',
      amount: 2520000,
      currency: 'VND',
      status: 'PENDING',
      transferContent: 'COD DH0004',
      idempotencyKey: 'manual_cod_ORD0004',
    },
  });
  seededOrders.push(order4);

  // ===========================================================================
  // ORDER 5: ORD-20260912-0005 - DRAFT, UNPAID (Hoàng Thị Thuỳ Dương)
  // ===========================================================================
  const cust5 = findContact('CUST_VN_005');
  const prod5 = findProduct('BGN-CORP-500ML');
  const var5 = findVariant('BGN-CORP-BLK');
  const conv5 = conversations[4];

  const order5 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260912-0005',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260912-0005',
      contactId: cust5.id,
      conversationId: conv5?.id,
      createdById: users.agent.id,
      status: 'DRAFT',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'UNFULFILLED',
      subtotal: 360000,
      discountAmount: 0,
      shippingFee: 20000,
      taxAmount: 0,
      totalAmount: 380000,
      paidAmount: 0,
      currency: 'VND',
      customerNotes: 'Đơn nháp nhân viên đang tạo dở trong khi chat.',
      recipientName: cust5.name,
      recipientPhone: cust5.phoneNumber,
      recipientAddress: '25 Đặng Dung',
      recipientWard: 'Phường Tân Định',
      recipientDistrict: 'Quận 1',
      recipientProvince: 'Thành phố Hồ Chí Minh',
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order5.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order5.id,
      productId: prod5.id,
      variantId: var5.id,
      productName: prod5.name,
      variantName: var5.name,
      sku: var5.sku,
      unitPrice: 180000,
      costPrice: 95000,
      quantity: 2,
      totalPrice: 360000,
    },
  });
  seededOrders.push(order5);

  // ===========================================================================
  // ORDER 6: ORD-20260914-0006 - CANCELLED (Vũ Kim Ngân - Khách huỷ đơn)
  // ===========================================================================
  const cust6 = findContact('CUST_VN_006');
  const var2Silver = findVariant('SONY-WH1000XM5-SLV');

  const order6 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260914-0006',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260914-0006',
      contactId: cust6.id,
      createdById: users.agent.id,
      status: 'CANCELLED',
      paymentStatus: 'UNPAID',
      fulfillmentStatus: 'CANCELLED',
      subtotal: 7990000,
      discountAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 7990000,
      paidAmount: 0,
      currency: 'VND',
      cancelReason: 'Khách đổi ý muốn chuyển sang model màu đen nhám sau đợt công tác.',
      recipientName: cust6.name,
      recipientPhone: cust6.phoneNumber,
      recipientAddress: '10 Tràng Thi',
      recipientWard: 'Phường Hàng Trống',
      recipientDistrict: 'Quận Hoàn Kiếm',
      recipientProvince: 'Thành phố Hà Nội',
      confirmedAt: new Date('2026-09-14T10:00:00Z'),
      cancelledAt: new Date('2026-09-14T11:30:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order6.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order6.id,
      productId: prod2.id,
      variantId: var2Silver.id,
      productName: prod2.name,
      variantName: var2Silver.name,
      sku: var2Silver.sku,
      unitPrice: 7990000,
      costPrice: 6200000,
      quantity: 1,
      totalPrice: 7990000,
    },
  });

  // Release reservation transaction
  await prisma.inventoryTransaction.create({
    data: {
      workspaceId: workspace.id,
      variantId: var2Silver.id,
      orderId: order6.id,
      type: 'RELEASE_RESERVATION',
      quantity: 1,
      previousStock: var2Silver.stockQuantity,
      newStock: var2Silver.stockQuantity,
      previousReserved: 1,
      newReserved: 0,
      reason: 'Hoàn lại giữ chỗ 1 chiếc Sony Bạc do đơn hàng ORD-20260914-0006 bị huỷ',
      performedByUserId: users.agent.id,
    },
  });
  seededOrders.push(order6);

  // ===========================================================================
  // ORDER 7: ORD-20260916-0007 - PAID, PROCESSING (Đặng Hữu Nam - 10 Bình giữ nhiệt)
  // ===========================================================================
  const cust7 = findContact('CUST_VN_007');
  const conv6 = conversations[5];

  const order7 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260916-0007',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260916-0007',
      contactId: cust7.id,
      conversationId: conv6?.id,
      createdById: users.agent.id,
      status: 'PAID',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'PROCESSING',
      subtotal: 1800000,
      discountAmount: 0,
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 1800000,
      paidAmount: 1800000,
      currency: 'VND',
      customerNotes: 'Khắc logo FPT Software màu trắng lên bình đen nhám.',
      recipientName: cust7.name,
      recipientPhone: cust7.phoneNumber,
      recipientAddress: 'Toà nhà FPT, Phố Duy Tân',
      recipientWard: 'Phường Dịch Vọng Hậu',
      recipientDistrict: 'Quận Cầu Giấy',
      recipientProvince: 'Thành phố Hà Nội',
      confirmedAt: new Date('2026-09-16T14:00:00Z'),
      paidAt: new Date('2026-09-16T14:15:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order7.id } });
  await prisma.orderItem.create({
    data: {
      workspaceId: workspace.id,
      orderId: order7.id,
      productId: prod5.id,
      variantId: var5.id,
      productName: prod5.name,
      variantName: var5.name,
      sku: var5.sku,
      unitPrice: 180000,
      costPrice: 95000,
      quantity: 10,
      totalPrice: 1800000,
    },
  });

  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_evt_ORD0007_paid',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order7.id,
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 1800000,
      currency: 'VND',
      status: 'SUCCESS',
      transactionCode: 'MB_TXN_9876547',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'DH0007',
      paidAt: new Date('2026-09-16T14:15:00Z'),
      idempotencyKey: 'sepay_evt_ORD0007_paid',
    },
  });

  await prisma.inventoryTransaction.create({
    data: {
      workspaceId: workspace.id,
      variantId: var5.id,
      orderId: order7.id,
      type: 'COMMIT_SALE',
      quantity: 10,
      previousStock: var5.stockQuantity,
      newStock: var5.stockQuantity - 10,
      previousReserved: 10,
      newReserved: 0,
      reason: 'Xuất kho 10 bình giữ nhiệt đen nhám cho đơn hàng ORD-20260916-0007',
      performedByUserId: users.agent.id,
    },
  });
  seededOrders.push(order7);

  // ===========================================================================
  // ORDER 8: ORD-20260918-0008 - COMPLETED, PAID, Discount Applied (Bùi Thị Mai)
  // ===========================================================================
  const cust8 = findContact('CUST_VN_008');
  const var4Gray = findVariant('LOGI-MX3S-GRAY');

  const order8 = await prisma.order.upsert({
    where: {
      workspaceId_orderNumber: {
        workspaceId: workspace.id,
        orderNumber: 'ORD-20260918-0008',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderNumber: 'ORD-20260918-0008',
      contactId: cust8.id,
      createdById: users.superAdmin.id,
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      fulfillmentStatus: 'DELIVERED',
      subtotal: 12970000,
      discountAmount: 500000,
      discountType: 'FIXED_AMOUNT',
      discountReason: 'Chiết khấu khách VIP combo công nghệ bàn làm việc',
      shippingFee: 0,
      taxAmount: 0,
      totalAmount: 12470000,
      paidAmount: 12470000,
      currency: 'VND',
      recipientName: cust8.name,
      recipientPhone: cust8.phoneNumber,
      recipientAddress: '125 Chùa Bộc',
      recipientWard: 'Phường Quang Trung',
      recipientDistrict: 'Quận Đống Đa',
      recipientProvince: 'Thành phố Hà Nội',
      confirmedAt: new Date('2026-09-18T10:00:00Z'),
      paidAt: new Date('2026-09-18T10:15:00Z'),
      completedAt: new Date('2026-09-18T16:30:00Z'),
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order8.id } });
  await prisma.orderItem.createMany({
    data: [
      {
        workspaceId: workspace.id,
        orderId: order8.id,
        productId: prod4.id,
        variantId: var4Gray.id,
        productName: prod4.name,
        variantName: var4Gray.name,
        sku: var4Gray.sku,
        unitPrice: 2490000,
        costPrice: 1850000,
        quantity: 2,
        totalPrice: 4980000,
      },
      {
        workspaceId: workspace.id,
        orderId: order8.id,
        productId: prod2.id,
        variantId: var2.id,
        productName: prod2.name,
        variantName: var2.name,
        sku: var2.sku,
        unitPrice: 7990000,
        costPrice: 6200000,
        quantity: 1,
        totalPrice: 7990000,
      },
    ],
  });

  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_evt_ORD0008_paid',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order8.id,
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 12470000,
      currency: 'VND',
      status: 'SUCCESS',
      transactionCode: 'MB_TXN_9876548',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'DH0008',
      paidAt: new Date('2026-09-18T10:15:00Z'),
      idempotencyKey: 'sepay_evt_ORD0008_paid',
    },
  });
  seededOrders.push(order8);

  // ===========================================================================
  // UNMATCHED BANK TRANSACTION (Mô phỏng đối soát ngân hàng chờ xử lý)
  // ===========================================================================
  await prisma.paymentTransaction.upsert({
    where: {
      workspaceId_idempotencyKey: {
        workspaceId: workspace.id,
        idempotencyKey: 'sepay_unmatched_txn_sample',
      },
    },
    update: {},
    create: {
      workspaceId: workspace.id,
      orderId: order2.id, // Attached to order2 as pending mismatch
      paymentMethod: 'VIETQR',
      gateway: 'SEPAY',
      amount: 500000,
      currency: 'VND',
      status: 'PENDING',
      transactionCode: 'MB_UNMATCHED_099',
      accountNumber: '0988123456',
      bankCode: 'MB',
      transferContent: 'NGUYEN VAN B CHUYEN TIEN KHONG GHI MA DON',
      idempotencyKey: 'sepay_unmatched_txn_sample',
      rawWebhookPayload: {
        gateway: 'sepay',
        transactionDate: '2026-09-19 09:12:00',
        accountNumber: '0988123456',
        transferAmount: 500000,
        transactionContent: 'NGUYEN VAN B CHUYEN TIEN KHONG GHI MA DON',
      },
    },
  });

  console.log(
    `   ✔ ${seededOrders.length} Orders seeded across full lifecycle (DRAFT, CONFIRMED, PAID, SHIPPING, COMPLETED, CANCELLED)`,
  );
  console.log(
    `   ✔ Realistic VietQR & SePay transactions seeded (including Unmatched bank transaction for reconciliation)`,
  );
  console.log(
    `   ✔ Inventory ledger transactions (RESERVATION, COMMIT_SALE, RELEASE_RESERVATION) recorded`,
  );

  return { orders: seededOrders };
}
