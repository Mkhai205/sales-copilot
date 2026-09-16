import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  adjustInventorySchema,
  createProductSchema,
  InventoryTransactionType,
  listInventoryTransactionsQuerySchema,
  listInventoryVariantsQuerySchema,
  normalizeSku,
} from '@sales-copilot/shared-contracts';

describe('Epic 2.1: Inventory & Catalog Management Spec', () => {
  describe('SKU Normalization (normalizeSku)', () => {
    it('should convert accented characters to uppercase unaccented characters', () => {
      const result = normalizeSku('Áo Thun Đen Nam Size L');
      assert.strictEqual(result, 'AO-THUN-DEN-NAM-SIZE-L');
    });

    it('should strip special symbols and collapse multiple dashes', () => {
      const result = normalizeSku('POLO / Cotton @ 100% #1');
      assert.strictEqual(result, 'POLO-COTTON-100-1');
    });

    it('should handle Vietnamese đ/Đ characters', () => {
      const result = normalizeSku('Đầm Dạ Hội Đỏ');
      assert.strictEqual(result, 'DAM-DA-HOI-DO');
    });

    it('should return empty string for null/empty input', () => {
      assert.strictEqual(normalizeSku(''), '');
    });
  });

  describe('createProductSchema Validation', () => {
    it('should validate simple product without variants (defaulting to empty array)', () => {
      const valid = createProductSchema.safeParse({
        name: 'Kem chống nắng Anessa',
        sku: 'ANESSA-60ML',
        basePrice: 450000,
        costPrice: 280000,
      });

      assert.strictEqual(valid.success, true);
      if (valid.success) {
        assert.deepStrictEqual(valid.data.variants, []);
        assert.strictEqual(valid.data.sku, 'ANESSA-60ML');
      }
    });

    it('should validate product with variant matrix', () => {
      const valid = createProductSchema.safeParse({
        name: 'Áo Polo Pique',
        sku: 'POLO-01',
        basePrice: 290000,
        variants: [
          {
            name: 'Size S / Đen',
            sku: 'POLO-01-DEN-S',
            price: 290000,
            stockQuantity: 15,
            attributes: { size: 'S', color: 'Đen' },
          },
          {
            name: 'Size M / Đen',
            sku: 'POLO-01-DEN-M',
            price: 290000,
            stockQuantity: 20,
            attributes: { size: 'M', color: 'Đen' },
          },
        ],
      });

      assert.strictEqual(valid.success, true);
      if (valid.success) {
        assert.strictEqual(valid.data.variants.length, 2);
      }
    });

    it('should reject missing name or SKU', () => {
      const invalid = createProductSchema.safeParse({
        basePrice: 100000,
      });

      assert.strictEqual(invalid.success, false);
    });
  });

  describe('adjustInventorySchema Validation', () => {
    it('should allow INVENTORY_AUDIT with quantity = 0 (clearing out-of-stock)', () => {
      const valid = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.INVENTORY_AUDIT,
        quantity: 0,
        reason: 'Kiểm kê kho sạch hàng',
      });

      assert.strictEqual(valid.success, true);
    });

    it('should reject INVENTORY_AUDIT with negative quantity', () => {
      const invalid = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.INVENTORY_AUDIT,
        quantity: -5,
        reason: 'Lỗi kiểm kê âm',
      });

      assert.strictEqual(invalid.success, false);
    });

    it('should reject STOCK_IN with quantity <= 0', () => {
      const zeroQty = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.STOCK_IN,
        quantity: 0,
        reason: 'Nhập hàng',
      });
      assert.strictEqual(zeroQty.success, false);

      const negativeQty = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.STOCK_IN,
        quantity: -10,
        reason: 'Nhập hàng',
      });
      assert.strictEqual(negativeQty.success, false);
    });

    it('should reject STOCK_OUT with quantity <= 0', () => {
      const zeroQty = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.STOCK_OUT,
        quantity: 0,
        reason: 'Xuất hàng lỗi',
      });
      assert.strictEqual(zeroQty.success, false);
    });

    it('should validate STOCK_IN with positive quantity', () => {
      const valid = adjustInventorySchema.safeParse({
        type: InventoryTransactionType.STOCK_IN,
        quantity: 25,
        reason: 'Nhập thêm kiện hàng đợt 2',
      });
      assert.strictEqual(valid.success, true);
    });
  });

  describe('Inventory Query Schemas', () => {
    it('should validate listInventoryTransactionsQuerySchema defaults and filters', () => {
      const parsed = listInventoryTransactionsQuerySchema.parse({
        page: '2',
        limit: '15',
        type: 'STOCK_IN',
      });

      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.limit, 15);
      assert.strictEqual(parsed.type, InventoryTransactionType.STOCK_IN);
    });

    it('should validate listInventoryVariantsQuerySchema with lowStock boolean coercion', () => {
      const parsed = listInventoryVariantsQuerySchema.parse({
        search: 'POLO',
        lowStock: 'true',
        sortBy: 'sku',
        sortOrder: 'asc',
      });

      assert.strictEqual(parsed.search, 'POLO');
      assert.strictEqual(parsed.lowStock, true);
      assert.strictEqual(parsed.sortBy, 'sku');
      assert.strictEqual(parsed.sortOrder, 'asc');
    });
  });
});
