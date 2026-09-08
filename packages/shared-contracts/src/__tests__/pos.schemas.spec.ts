import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  PaymentMethod,
  PaymentGateway,
  CarrierProvider,
  CarrierNetwork,
  InventoryTransactionType,
  createProductSchema,
  updateProductSchema,
  listProductsQuerySchema,
  createOrderSchema,
  cancelOrderSchema,
  manualPayOrderSchema,
  listOrdersQuerySchema,
  adjustInventorySchema,
  shippingAddressInputSchema,
  VIETNAMESE_PHONE_REGEX,
  AddressTrie,
  getProvinces,
  searchProvinces,
  parseAddressHierarchy,
  normalizeVietnamesePhone,
  isValidVietnamesePhone,
  detectCarrierNetwork,
} from '../index';

describe('POS Shared Contracts & Schemas', () => {
  describe('Enums Integrity', () => {
    it('should have correct OrderStatus enum values', () => {
      assert.strictEqual(OrderStatus.DRAFT, 'DRAFT');
      assert.strictEqual(OrderStatus.CONFIRMED, 'CONFIRMED');
      assert.strictEqual(OrderStatus.PAID, 'PAID');
      assert.strictEqual(OrderStatus.SHIPPING, 'SHIPPING');
      assert.strictEqual(OrderStatus.COMPLETED, 'COMPLETED');
      assert.strictEqual(OrderStatus.CANCELLED, 'CANCELLED');
    });

    it('should have correct PaymentStatus enum values', () => {
      assert.strictEqual(PaymentStatus.UNPAID, 'UNPAID');
      assert.strictEqual(PaymentStatus.PARTIALLY_PAID, 'PARTIALLY_PAID');
      assert.strictEqual(PaymentStatus.PAID, 'PAID');
      assert.strictEqual(PaymentStatus.REFUNDED, 'REFUNDED');
    });

    it('should have correct InventoryTransactionType enum values', () => {
      assert.strictEqual(InventoryTransactionType.STOCK_IN, 'STOCK_IN');
      assert.strictEqual(InventoryTransactionType.STOCK_OUT, 'STOCK_OUT');
      assert.strictEqual(InventoryTransactionType.RESERVATION, 'RESERVATION');
      assert.strictEqual(InventoryTransactionType.RELEASE_RESERVATION, 'RELEASE_RESERVATION');
      assert.strictEqual(InventoryTransactionType.COMMIT_SALE, 'COMMIT_SALE');
      assert.strictEqual(InventoryTransactionType.RETURN_RESTOCK, 'RETURN_RESTOCK');
      assert.strictEqual(InventoryTransactionType.INVENTORY_AUDIT, 'INVENTORY_AUDIT');
    });

    it('should have correct FulfillmentStatus, PaymentGateway, PaymentMethod, and CarrierNetwork enum values', () => {
      assert.strictEqual(FulfillmentStatus.UNFULFILLED, 'UNFULFILLED');
      assert.strictEqual(PaymentGateway.MANUAL, 'MANUAL');
      assert.strictEqual(PaymentMethod.VIETQR, 'VIETQR');
      assert.strictEqual(CarrierNetwork.VIETTEL, 'VIETTEL');
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

    it('should reject product creation without any variants', () => {
      const payload = {
        name: 'Áo Thun Cotton',
        sku: 'TEE-COTTON-01',
        basePrice: 199000,
        variants: [],
      };

      const result = createProductSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
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
            price: 0,
            stockQuantity: -5,
          },
        ],
      };

      const result = createProductSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should parse listProductsQuerySchema query parameters with boolean coercion', () => {
      const query = {
        page: '2',
        limit: '15',
        search: 'áo polo',
        isActive: 'true',
        lowStock: 'false',
        sortBy: 'basePrice',
        sortOrder: 'asc',
      };

      const result = listProductsQuerySchema.safeParse(query);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.page, 2);
        assert.strictEqual(result.data.limit, 15);
        assert.strictEqual(result.data.search, 'áo polo');
        assert.strictEqual(result.data.isActive, true);
        assert.strictEqual(result.data.lowStock, false);
        assert.strictEqual(result.data.sortBy, 'basePrice');
      }
    });

    it('should validate updateProductSchema partial update', () => {
      const update = {
        name: 'Áo Polo Thêu Logo Mới',
        basePrice: 220000,
        isActive: true,
      };

      const result = updateProductSchema.safeParse(update);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, 'Áo Polo Thêu Logo Mới');
      }
    });
  });

  describe('Order Schemas', () => {
    const validContactId = '11111111-1111-4111-8111-111111111111';
    const validProductId = '22222222-2222-4222-8222-222222222222';
    const validVariantId = '33333333-3333-4333-8333-333333333333';

    it('should enforce status strictly as DRAFT on order creation', () => {
      const payload = {
        contactId: validContactId,
        items: [
          {
            productId: validProductId,
            variantId: validVariantId,
            quantity: 2,
            unitPrice: 250000,
          },
        ],
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.status, OrderStatus.DRAFT);
      }
    });

    it('should reject order creation if client tries to inject CONFIRMED or PAID status', () => {
      const payload = {
        contactId: validContactId,
        status: 'PAID',
        items: [
          {
            productId: validProductId,
            variantId: validVariantId,
            quantity: 1,
            unitPrice: 100000,
          },
        ],
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should reject order creation if items array is empty', () => {
      const payload = {
        contactId: validContactId,
        items: [],
      };

      const result = createOrderSchema.safeParse(payload);
      assert.strictEqual(result.success, false);
    });

    it('should validate cancelOrderSchema with min 3 chars reason', () => {
      assert.strictEqual(cancelOrderSchema.safeParse({ cancelReason: 'OK' }).success, false);
      assert.strictEqual(
        cancelOrderSchema.safeParse({ cancelReason: 'Khách đổi ý muốn lấy mẫu khác' }).success,
        true,
      );
    });

    it('should validate manualPayOrderSchema', () => {
      const result = manualPayOrderSchema.safeParse({
        paymentMethod: PaymentMethod.CASH,
        amount: 540000,
        notes: 'Khách thanh toán tiền mặt tại quầy',
      });

      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.amount, 540000);
        assert.strictEqual(result.data.paymentMethod, PaymentMethod.CASH);
      }
    });

    it('should validate listOrdersQuerySchema defaults and filters', () => {
      const query = {
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        sortBy: 'totalAmount',
        sortOrder: 'asc',
      };

      const result = listOrdersQuerySchema.safeParse(query);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.status, OrderStatus.CONFIRMED);
        assert.strictEqual(result.data.paymentStatus, PaymentStatus.PAID);
        assert.strictEqual(result.data.sortBy, 'totalAmount');
      }
    });
  });

  describe('Shipping & Phone Number Validation', () => {
    it('should validate authentic Vietnamese phone numbers', () => {
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0988121234'), true);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0901234567'), true);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('+84912345678'), true);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0389998877'), true);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0771234567'), true);
    });

    it('should reject invalid phone numbers', () => {
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('123456'), false);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0123456789'), false); // Old 11-digit prefix
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('09881212345'), false); // Too long
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('abcdefghij'), false);
      assert.strictEqual(VIETNAMESE_PHONE_REGEX.test('0|12345678'), false); // Literal pipe character
    });

    it('should validate complete shippingAddressInputSchema', () => {
      const payload = {
        recipientName: 'Nguyễn Văn An',
        phoneNumber: '0988121234',
        streetAddress: 'Số 45 ngõ 120 Trường Chinh',
        ward: 'Phường Phương Mai',
        district: 'Quận Đống Đa',
        province: 'Thành phố Hà Nội',
        shippingCarrier: CarrierProvider.GHTK,
        carrierMetadata: { ghnDistrictId: 1450 },
      };

      const result = shippingAddressInputSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });
  });

  describe('Inventory Schemas', () => {
    it('should validate adjustInventorySchema', () => {
      const payload = {
        type: InventoryTransactionType.STOCK_IN,
        quantity: 100,
        reason: 'Nhập hàng đợt 1 từ xưởng',
      };

      const result = adjustInventorySchema.safeParse(payload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.quantity, 100);
        assert.strictEqual(result.data.type, InventoryTransactionType.STOCK_IN);
      }
    });

    it('should reject non-positive quantity in inventory adjustment', () => {
      assert.strictEqual(
        adjustInventorySchema.safeParse({
          type: InventoryTransactionType.STOCK_IN,
          quantity: 0,
          reason: 'test',
        }).success,
        false,
      );

      assert.strictEqual(
        adjustInventorySchema.safeParse({
          type: InventoryTransactionType.STOCK_OUT,
          quantity: -10,
          reason: 'test',
        }).success,
        false,
      );
    });
  });

  describe('Administrative Units & Address Trie', () => {
    it('should load all 63 Vietnamese provinces', () => {
      const provinces = getProvinces();
      assert.strictEqual(provinces.length, 63);
    });

    it('should search provinces by name with diacritics removal', () => {
      const resultHanoi = searchProvinces('ha noi');
      assert.ok(resultHanoi.some(p => p.name.includes('Hà Nội')));

      const resultDanang = searchProvinces('da nang');
      assert.ok(resultDanang.some(p => p.name.includes('Đà Nẵng')));
    });

    it('should perform Trie prefix search correctly', () => {
      const trie = new AddressTrie<string>();
      trie.insert('Thành phố Hà Nội', 'HN');
      trie.insert('Tỉnh Hà Giang', 'HG');
      trie.insert('Tỉnh Hà Nam', 'HNA');
      trie.insert('Tỉnh Hà Tĩnh', 'HT');

      const matches = trie.searchPrefix('ha');
      assert.strictEqual(matches.length, 4);

      const matchesHanoi = trie.searchPrefix('ha noi');
      assert.strictEqual(matchesHanoi.length, 1);
      assert.strictEqual(matchesHanoi[0], 'HN');
    });

    it('should parse address hierarchy from text and extract clean streetAddress', () => {
      const parsed = parseAddressHierarchy(
        'Số 45 ngõ 120 Trường Chinh, Phường Phương Mai, Quận Đống Đa, Hà Nội',
      );
      assert.ok(parsed.province?.includes('Hà Nội'));
      assert.ok(parsed.district?.includes('Đống Đa'));
      assert.ok(parsed.ward?.includes('Phương Mai'));
      assert.strictEqual(parsed.streetAddress, 'Số 45 ngõ 120 Trường Chinh');
    });

    it('should correctly disambiguate addresses where street name coincides with a province name', () => {
      // "Số 1 Hà Nội" in HCMC should resolve to HCMC, not Hà Nội
      const parsedHcmc = parseAddressHierarchy(
        'Số 1 Hà Nội, Phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
      );
      assert.ok(
        parsedHcmc.province?.includes('Hồ Chí Minh'),
        `Expected HCMC, got: ${parsedHcmc.province}`,
      );
      assert.ok(
        parsedHcmc.district?.includes('Quận 1'),
        `Expected Quận 1, got: ${parsedHcmc.district}`,
      );
      assert.ok(
        parsedHcmc.ward?.includes('Bến Nghé'),
        `Expected Bến Nghé, got: ${parsedHcmc.ward}`,
      );
      assert.strictEqual(parsedHcmc.streetAddress, 'Số 1 Hà Nội');

      // "Phố Huế" in Hà Nội should resolve to Hà Nội, not Thừa Thiên Huế
      const parsedHanoi = parseAddressHierarchy(
        '123 Phố Huế, Phường Hàng Bông, Quận Hoàn Kiếm, Thành phố Hà Nội',
      );
      assert.ok(
        parsedHanoi.province?.includes('Hà Nội'),
        `Expected Hà Nội, got: ${parsedHanoi.province}`,
      );
      assert.ok(
        parsedHanoi.district?.includes('Hoàn Kiếm'),
        `Expected Hoàn Kiếm, got: ${parsedHanoi.district}`,
      );
      assert.ok(
        parsedHanoi.ward?.includes('Hàng Bông'),
        `Expected Hàng Bông, got: ${parsedHanoi.ward}`,
      );
      assert.strictEqual(parsedHanoi.streetAddress, '123 Phố Huế');
    });
  });

  describe('Vietnamese Telco Detection & Phone Normalization', () => {
    it('should normalize various phone formats correctly', () => {
      assert.strictEqual(normalizeVietnamesePhone('+84988123456'), '0988123456');
      assert.strictEqual(normalizeVietnamesePhone('84988123456'), '0988123456');
      assert.strictEqual(normalizeVietnamesePhone('0988 123 456'), '0988123456');
      assert.strictEqual(normalizeVietnamesePhone('0988-123-456'), '0988123456');
      assert.strictEqual(normalizeVietnamesePhone('(0988) 123.456'), '0988123456');
    });

    it('should validate standard Vietnamese mobile numbers', () => {
      assert.strictEqual(isValidVietnamesePhone('0988123456'), true);
      assert.strictEqual(isValidVietnamesePhone('+84988123456'), true);
      assert.strictEqual(isValidVietnamesePhone('0123456789'), false); // 01 is not a mobile prefix
      assert.strictEqual(isValidVietnamesePhone('098812345'), false); // 9 digits
      assert.strictEqual(isValidVietnamesePhone('09881234567'), false); // 11 digits
    });

    it('should detect carrier networks accurately', () => {
      assert.strictEqual(detectCarrierNetwork('0988123456'), CarrierNetwork.VIETTEL);
      assert.strictEqual(detectCarrierNetwork('0861234567'), CarrierNetwork.VIETTEL);
      assert.strictEqual(detectCarrierNetwork('0351234567'), CarrierNetwork.VIETTEL);

      assert.strictEqual(detectCarrierNetwork('0912345678'), CarrierNetwork.VINAPHONE);
      assert.strictEqual(detectCarrierNetwork('0881234567'), CarrierNetwork.VINAPHONE);
      assert.strictEqual(detectCarrierNetwork('0821234567'), CarrierNetwork.VINAPHONE);

      assert.strictEqual(detectCarrierNetwork('0901234567'), CarrierNetwork.MOBIFONE);
      assert.strictEqual(detectCarrierNetwork('0791234567'), CarrierNetwork.MOBIFONE);

      assert.strictEqual(detectCarrierNetwork('0921234567'), CarrierNetwork.VIETNAMOBILE);
      assert.strictEqual(detectCarrierNetwork('0561234567'), CarrierNetwork.VIETNAMOBILE);

      assert.strictEqual(detectCarrierNetwork('0991234567'), CarrierNetwork.GMOBILE);
      assert.strictEqual(detectCarrierNetwork('0591234567'), CarrierNetwork.GMOBILE);

      assert.strictEqual(detectCarrierNetwork('0871234567'), CarrierNetwork.ITEL);
      assert.strictEqual(detectCarrierNetwork('0551234567'), CarrierNetwork.WINTEL);

      assert.strictEqual(detectCarrierNetwork('0243123456'), CarrierNetwork.OTHER);
    });
  });
});
