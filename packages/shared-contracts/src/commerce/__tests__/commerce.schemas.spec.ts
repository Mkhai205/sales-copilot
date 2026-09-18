import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  createOrderSchema,
  cancelOrderSchema,
  completeOrderSchema,
  manualPayOrderSchema,
  listOrdersQuerySchema,
  adjustInventorySchema,
  shippingAddressInputSchema,
  InventoryTransactionType,
  PaymentMethod,
  COMMERCE_RECONCILIATION_QUEUE,
} from '../index';

describe('Shared Contracts — Commerce Context Schemas', () => {
  describe('Queue & Job Contract Invariants', () => {
    it('should maintain queue and job names', () => {
      assert.strictEqual(COMMERCE_RECONCILIATION_QUEUE, 'commerce-reconciliation');
    });
  });

  describe('Product Schemas', () => {
    it('should validate valid product creation with nested variants', () => {
      const payload = {
        name: 'Áo Thun Cotton Compact',
        sku: 'TEE-COTTON-01',
        basePrice: 199000,
        costPrice: 90000,
        category: 'Thời trang nam',
        variants: [
          {
            name: 'Size L / Đen',
            sku: 'TEE-COTTON-01-L-BLK',
            price: 199000,
            costPrice: 90000,
            stockQuantity: 50,
            attributes: { size: 'L', color: 'Black' },
          },
        ],
      };

      const result = createProductSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, 'Áo Thun Cotton Compact');
        assert.strictEqual(result.data.trackInventory, true);
        assert.strictEqual(result.data.variants.length, 1);
        assert.strictEqual(result.data.variants[0].stockQuantity, 50);
      }
    });

    it('should default variants to empty array when omitted', () => {
      const payload = {
        name: 'Áo Thun Cotton',
        sku: 'TEE-COTTON-01',
        basePrice: 199000,
      };

      const result = createProductSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.deepStrictEqual(result.data.variants, []);
      }
    });

    it('should reject negative prices or negative stock quantities', () => {
      const payload = {
        name: 'Sản phẩm lỗi',
        sku: 'ERR-01',
        basePrice: -50000,
        variants: [
          {
            name: 'Variant 1',
            sku: 'ERR-01-V1',
            price: 100000,
            stockQuantity: -5,
          },
        ],
      };

      const result = createProductSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should validate partial updateProductSchema', () => {
      const payload = {
        name: 'Áo Thun Cổ Tròn Mới',
        basePrice: 220000,
        isActive: false,
      };

      const result = updateProductSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, 'Áo Thun Cổ Tròn Mới');
        assert.strictEqual(result.data.basePrice, 220000);
        assert.strictEqual(result.data.isActive, false);
      }
    });

    it('should parse query parameters in listProductsQuerySchema with defaults and coercion', () => {
      const query = {
        page: '2',
        limit: '50',
        search: 'áo thun',
        isActive: 'true',
        sortBy: 'name',
        sortOrder: 'asc',
      };

      const result = listProductsQuerySchema.safeParse(query);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.page, 2);
        assert.strictEqual(result.data.limit, 50);
        assert.strictEqual(result.data.search, 'áo thun');
        assert.strictEqual(result.data.isActive, true);
        assert.strictEqual(result.data.sortBy, 'name');
        assert.strictEqual(result.data.sortOrder, 'asc');
      }
    });
  });

  describe('Order Schemas', () => {
    const validUuid1 = '12345678-1234-1234-1234-123456789abc';
    const validUuid2 = '87654321-4321-4321-4321-cba987654321';

    it('should validate valid createOrderSchema with items and discounts', () => {
      const payload = {
        conversationId: validUuid1,
        contactId: validUuid1,
        paymentMethod: PaymentMethod.VIETQR,
        discountAmount: 20000,
        shippingFee: 30000,
        customerNotes: 'Giao giờ hành chính',
        items: [
          {
            productId: validUuid1,
            variantId: validUuid2,
            quantity: 2,
            unitPrice: 150000,
            metadata: { note: 'Đóng gói quà' },
          },
        ],
        shippingAddress: {
          recipientName: 'Nguyễn Văn A',
          phoneNumber: '0987654321',
          streetAddress: 'Số 10 Đường Lê Duẩn',
          province: 'Hà Nội',
          district: 'Quận Ba Đình',
          ward: 'Phường Điện Biên',
        },
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.items.length, 1);
        assert.strictEqual(result.data.items[0].quantity, 2);
        assert.strictEqual(result.data.discountAmount, 20000);
        assert.strictEqual(result.data.shippingAddress?.province, 'Hà Nội');
      }
    });

    it('should reject createOrderSchema with empty items array', () => {
      const payload = {
        conversationId: validUuid1,
        contactId: validUuid1,
        items: [],
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should reject createOrderSchema with invalid item quantity (<= 0)', () => {
      const payload = {
        conversationId: validUuid1,
        contactId: validUuid1,
        items: [
          {
            productId: validUuid1,
            variantId: validUuid2,
            quantity: 0,
            unitPrice: 100000,
          },
        ],
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should validate cancelOrderSchema requiring a non-empty reason of at least 3 chars', () => {
      const validPayload = { cancelReason: 'Khách hàng đổi ý muốn mua màu khác' };
      const validResult = cancelOrderSchema.safeParse(validPayload);
      assert.strictEqual(validResult.success, true);

      const invalidPayload = { cancelReason: '  no ' };
      const invalidResult = cancelOrderSchema.safeParse(invalidPayload);
      assert.strictEqual(invalidResult.success, false);
    });

    it('should validate completeOrderSchema with optional notes', () => {
      const validResult = completeOrderSchema.safeParse({ notes: 'Đã giao thành công' });
      assert.strictEqual(validResult.success, true);
      if (validResult.success) {
        assert.strictEqual(validResult.data?.notes, 'Đã giao thành công');
      }
    });

    it('should validate manualPayOrderSchema with paymentMethod and amount', () => {
      const payload = {
        paymentMethod: PaymentMethod.CASH,
        amount: 350000,
        transactionCode: 'CASH-REC-001',
        notes: 'Đã thu tiền mặt tận nơi',
      };

      const result = manualPayOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.paymentMethod, PaymentMethod.CASH);
        assert.strictEqual(result.data.amount, 350000);
        assert.strictEqual(result.data.transactionCode, 'CASH-REC-001');
      }
    });

    it('should parse listOrdersQuerySchema with defaults and coercion', () => {
      const query = {
        page: '3',
        limit: '10',
        paymentStatus: 'PAID',
        sortBy: 'totalAmount',
        sortOrder: 'desc',
      };

      const result = listOrdersQuerySchema.safeParse(query);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.page, 3);
        assert.strictEqual(result.data.limit, 10);
        assert.strictEqual(result.data.paymentStatus, 'PAID');
        assert.strictEqual(result.data.sortBy, 'totalAmount');
      }
    });
  });

  describe('Inventory Schemas', () => {
    const validUuid = '12345678-1234-1234-1234-123456789abc';

    it('should validate adjustInventorySchema with valid transaction type and positive quantity', () => {
      const payload = {
        productVariantId: validUuid,
        quantity: 100,
        type: InventoryTransactionType.STOCK_IN,
        referenceType: 'PO_IMPORT',
        referenceId: 'PO-2026-001',
        reason: 'Nhập hàng đợt 1 từ xưởng',
      };

      const result = adjustInventorySchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.quantity, 100);
        assert.strictEqual(result.data.type, InventoryTransactionType.STOCK_IN);
        assert.strictEqual(result.data.reason, 'Nhập hàng đợt 1 từ xưởng');
      }
    });

    it('should reject adjustInventorySchema with quantity <= 0', () => {
      const payload = {
        productVariantId: validUuid,
        quantity: 0,
        type: InventoryTransactionType.STOCK_IN,
      };

      const result = adjustInventorySchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should reject adjustInventorySchema with invalid transaction type', () => {
      const payload = {
        productVariantId: validUuid,
        quantity: 10,
        type: 'INVALID_TRANSACTION_TYPE',
      };

      const result = adjustInventorySchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });
  });

  describe('Shipping Address Schemas', () => {
    it('should validate valid shipping address input', () => {
      const payload = {
        recipientName: 'Trần Thị B',
        phoneNumber: '0901234567',
        streetAddress: '72 Lê Thánh Tôn, Bến Nghé',
        province: 'Thành phố Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
      };

      const result = shippingAddressInputSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.recipientName, 'Trần Thị B');
        assert.strictEqual(result.data.province, 'Thành phố Hồ Chí Minh');
      }
    });

    it('should reject shipping address with missing recipient name or streetAddress', () => {
      const payload = {
        phoneNumber: '0901234567',
        province: 'Thành phố Hồ Chí Minh',
      };

      const result = shippingAddressInputSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });
  });
});
