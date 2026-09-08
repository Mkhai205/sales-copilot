import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { DomainEvent, InventoryTransactionType } from '@sales-copilot/shared-contracts';
import { ProductsService } from '../products.service';

describe('ProductsService (Catalog & Inventory Management)', () => {
  let service: ProductsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let clientMock: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let productsDb: Map<string, any>;
  let variantsDb: Map<string, any>;
  let inventoryTransactionsDb: Map<string, any>;

  const ws1 = 'ws_tenant_1';
  const ws2 = 'ws_tenant_2';
  const userId = 'usr_agent_1';

  beforeEach(() => {
    productsDb = new Map();
    variantsDb = new Map();
    inventoryTransactionsDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    clientMock = {
      product: {
        findFirst: async ({ where, include }: any) => {
          for (const p of productsDb.values()) {
            if (where.id && p.id !== where.id) continue;
            if (where.workspaceId && p.workspaceId !== where.workspaceId) continue;
            if (where.sku && p.sku !== where.sku) continue;
            if (where.slug && p.slug !== where.slug) continue;
            if (where.id?.not && p.id === where.id.not) continue;

            const res = { ...p };
            if (include?.variants) {
              res.variants = Array.from(variantsDb.values()).filter(v => v.productId === p.id);
            }
            return res;
          }
          return null;
        },
        findFirstOrThrow: async ({ where, include }: any) => {
          const res = await clientMock.product.findFirst({ where, include });
          if (!res) throw new Error('Product not found');
          return res;
        },
        findMany: async ({ where, skip, take, _orderBy }: any) => {
          let list = Array.from(productsDb.values()).filter(p => {
            if (where.workspaceId && p.workspaceId !== where.workspaceId) return false;
            if (where.isActive !== undefined && p.isActive !== where.isActive) return false;
            if (where.category) {
              const catSearch = where.category.equals.toLowerCase();
              if (!p.category || p.category.toLowerCase() !== catSearch) return false;
            }
            if (where.OR) {
              const term = (where.OR[0].name.contains || '').toLowerCase();
              const pVariants = Array.from(variantsDb.values()).filter(v => v.productId === p.id);
              const matchName = p.name?.toLowerCase().includes(term);
              const matchSku = p.sku?.toLowerCase().includes(term);
              const matchBarcode = p.barcode?.toLowerCase().includes(term);
              const matchVariant = pVariants.some(
                v =>
                  v.name?.toLowerCase().includes(term) ||
                  v.sku?.toLowerCase().includes(term) ||
                  v.barcode?.toLowerCase().includes(term),
              );
              if (!matchName && !matchSku && !matchBarcode && !matchVariant) return false;
            }
            if (where.variants?.some?.stockQuantity?.lte !== undefined) {
              const pVariants = Array.from(variantsDb.values()).filter(v => v.productId === p.id);
              const hasLow = pVariants.some(v => v.stockQuantity <= 5);
              if (!hasLow) return false;
            }
            return true;
          });

          if (skip !== undefined && take !== undefined) {
            list = list.slice(skip, skip + take);
          }

          return list.map(p => ({
            ...p,
            variants: Array.from(variantsDb.values()).filter(v => v.productId === p.id),
          }));
        },
        count: async ({ where }: any) => {
          const items = await clientMock.product.findMany({ where });
          return items.length;
        },
        create: async ({ data, include }: any) => {
          const id = `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = {
            id,
            workspaceId: data.workspaceId,
            name: data.name,
            slug: data.slug,
            description: data.description,
            category: data.category,
            basePrice: data.basePrice,
            costPrice: data.costPrice || 0,
            sku: data.sku,
            barcode: data.barcode,
            imageUrl: data.imageUrl,
            images: data.images || [],
            isActive: data.isActive ?? true,
            trackInventory: data.trackInventory ?? true,
            metadata: data.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          productsDb.set(id, record);

          const createdVariants: any[] = [];
          if (data.variants?.create) {
            for (const vData of data.variants.create) {
              const vId = `var_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
              const vRecord = {
                id: vId,
                productId: id,
                workspaceId: data.workspaceId,
                name: vData.name,
                sku: vData.sku,
                barcode: vData.barcode,
                price: vData.price,
                costPrice: vData.costPrice || 0,
                stockQuantity: vData.stockQuantity || 0,
                reservedQuantity: 0,
                attributes: vData.attributes || {},
                imageUrl: vData.imageUrl,
                isActive: vData.isActive ?? true,
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              variantsDb.set(vId, vRecord);
              createdVariants.push(vRecord);
            }
          }

          const res: any = { ...record };
          if (include?.variants) res.variants = createdVariants;
          return res;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [pId, p] of productsDb.entries()) {
            if (where.id && p.id !== where.id) continue;
            if (where.workspaceId && p.workspaceId !== where.workspaceId) continue;
            productsDb.set(pId, { ...p, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      productVariant: {
        findFirst: async ({ where }: any) => {
          for (const v of variantsDb.values()) {
            if (where.id && v.id !== where.id) continue;
            if (where.id?.not && v.id === where.id.not) continue;
            if (where.productId && v.productId !== where.productId) continue;
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            if (where.sku && v.sku !== where.sku) continue;
            if (where.barcode && v.barcode !== where.barcode) continue;
            return { ...v };
          }
          return null;
        },
        findFirstOrThrow: async ({ where }: any) => {
          const res = await clientMock.productVariant.findFirst({ where });
          if (!res) throw new Error('Variant not found');
          return res;
        },
        updateMany: async ({ where, data }: any) => {
          let count = 0;
          for (const [vId, v] of variantsDb.entries()) {
            if (where.id && v.id !== where.id) continue;
            if (where.productId && v.productId !== where.productId) continue;
            if (where.workspaceId && v.workspaceId !== where.workspaceId) continue;
            variantsDb.set(vId, { ...v, ...data, updatedAt: new Date() });
            count++;
          }
          return { count };
        },
      },
      inventoryTransaction: {
        create: async ({ data }: any) => {
          const id = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const record = {
            id,
            ...data,
            createdAt: new Date(),
          };
          inventoryTransactionsDb.set(id, record);
          return record;
        },
      },
      $executeRaw: async (strings: any, ...values: any[]) => {
        const queryText = Array.isArray(strings) ? strings.join('?') : String(strings);
        if (queryText.includes('"stockQuantity" +')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          variant.stockQuantity += qty;
          variantsDb.set(varId, variant);
          return 1;
        } else if (queryText.includes('"stockQuantity" -')) {
          const [qty, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          if (variant.stockQuantity - qty < variant.reservedQuantity) return 0;
          variant.stockQuantity -= qty;
          variantsDb.set(varId, variant);
          return 1;
        } else if (queryText.includes('SET "stockQuantity" =')) {
          const [auditStock, varId, wsId] = values;
          const variant = variantsDb.get(varId);
          if (!variant || variant.workspaceId !== wsId) return 0;
          if (auditStock < variant.reservedQuantity) return 0;
          variant.stockQuantity = auditStock;
          variantsDb.set(varId, variant);
          return 1;
        }
        return 0;
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
      client: clientMock,
      runInTransaction: async (cb: any) => {
        const postHooks: Array<() => any> = [];
        const ctx = {
          tx: clientMock,
          addPostCommitHook: (hook: () => any) => postHooks.push(hook),
        };
        const result = await cb(ctx);
        for (const hook of postHooks) {
          await hook();
        }
        return result;
      },
    };

    service = new ProductsService(mockPrismaService, mockEventEmitter);
  });

  describe('createProduct', () => {
    it('should create product with variants and initial stock transaction', async () => {
      const product = await service.createProduct(
        ws1,
        {
          name: 'Áo Polo Pique Cotton',
          sku: 'POLO-01',
          basePrice: 280000,
          costPrice: 140000,
          category: 'Thời trang',
          variants: [
            {
              name: 'Size L / Đen',
              sku: 'POLO-01-L-BLK',
              price: 280000,
              costPrice: 140000,
              stockQuantity: 20,
              attributes: { size: 'L', color: 'Đen' },
            },
          ],
        },
        userId,
      );

      assert.strictEqual(product.workspaceId, ws1);
      assert.strictEqual(product.name, 'Áo Polo Pique Cotton');
      assert.strictEqual(product.sku, 'POLO-01');
      assert.strictEqual(product.variants?.length, 1);
      assert.strictEqual(product.totalStock, 20);
      assert.strictEqual(product.totalAvailable, 20);

      // Verify initial stock transaction created
      assert.strictEqual(inventoryTransactionsDb.size, 1);
      const invTx = Array.from(inventoryTransactionsDb.values())[0];
      assert.strictEqual(invTx.type, InventoryTransactionType.STOCK_IN);
      assert.strictEqual(invTx.quantity, 20);
      assert.strictEqual(invTx.performedByUserId, userId);

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, DomainEvent.INVENTORY_UPDATED);
      assert.strictEqual(emittedEvents[0].payload.availableStock, 20);
    });

    it('should throw ConflictException if SKU already exists in workspace', async () => {
      await service.createProduct(ws1, {
        name: 'Product A',
        sku: 'DUPLICATE-SKU',
        basePrice: 100000,
        variants: [{ name: 'V1', sku: 'V1-SKU', price: 100000 }],
      });

      await assert.rejects(
        async () => {
          await service.createProduct(ws1, {
            name: 'Product B',
            sku: 'DUPLICATE-SKU',
            basePrice: 150000,
            variants: [{ name: 'V2', sku: 'V2-SKU', price: 150000 }],
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'SKU_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same SKU in different workspaces (Tenant Isolation)', async () => {
      const p1 = await service.createProduct(ws1, {
        name: 'Product WS1',
        sku: 'SHARED-SKU',
        basePrice: 100000,
        variants: [{ name: 'V1', sku: 'V1-SKU', price: 100000 }],
      });

      const p2 = await service.createProduct(ws2, {
        name: 'Product WS2',
        sku: 'SHARED-SKU',
        basePrice: 200000,
        variants: [{ name: 'V2', sku: 'V2-SKU-2', price: 200000 }],
      });

      assert.strictEqual(p1.workspaceId, ws1);
      assert.strictEqual(p2.workspaceId, ws2);
    });

    it('should throw BadRequestException if variant SKUs within product are duplicated', async () => {
      await assert.rejects(
        async () => {
          await service.createProduct(ws1, {
            name: 'Product Dup',
            sku: 'DUP-P-SKU',
            basePrice: 100000,
            variants: [
              { name: 'V1', sku: 'SAME-VAR-SKU', price: 100000 },
              { name: 'V2', sku: 'SAME-VAR-SKU', price: 100000 },
            ],
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'DUPLICATE_VARIANT_SKUS');
          return true;
        },
      );
    });

    it('should throw ConflictException if variant SKU already exists in workspace', async () => {
      await service.createProduct(ws1, {
        name: 'Product 1',
        sku: 'P1-SKU',
        basePrice: 100000,
        variants: [{ name: 'V1', sku: 'EXISTING-VAR-SKU', price: 100000 }],
      });

      await assert.rejects(
        async () => {
          await service.createProduct(ws1, {
            name: 'Product 2',
            sku: 'P2-SKU',
            basePrice: 100000,
            variants: [{ name: 'V2', sku: 'EXISTING-VAR-SKU', price: 100000 }],
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'VARIANT_SKU_ALREADY_EXISTS');
          return true;
        },
      );
    });
  });

  describe('listProducts', () => {
    beforeEach(async () => {
      await service.createProduct(ws1, {
        name: 'Áo Polo Thể Thao',
        sku: 'POLO-SPORT',
        category: 'Nam',
        basePrice: 250000,
        variants: [{ name: 'M', sku: 'POLO-SPORT-M', price: 250000, stockQuantity: 3 }],
      });

      await service.createProduct(ws1, {
        name: 'Quần Jean Slimfit',
        sku: 'JEAN-SLIM',
        category: 'Nam',
        basePrice: 450000,
        variants: [{ name: '30', sku: 'JEAN-SLIM-30', price: 450000, stockQuantity: 25 }],
      });

      await service.createProduct(ws2, {
        name: 'Sản phẩm Tenant 2',
        sku: 'TENANT-2-PROD',
        basePrice: 500000,
        variants: [{ name: 'T2', sku: 'T2-VAR', price: 500000, stockQuantity: 10 }],
      });
    });

    it('should list products strictly scoped to workspace', async () => {
      const result = await service.listProducts(ws1, {
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      assert.strictEqual(result.items.length, 2);
      assert.strictEqual(result.meta.total, 2);
      assert.ok(result.items.every(p => p.workspaceId === ws1));
    });

    it('should filter products by search query (case-insensitive)', async () => {
      const result = await service.listProducts(ws1, {
        page: 1,
        limit: 10,
        search: 'jean',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].sku, 'JEAN-SLIM');
    });

    it('should filter products by lowStock flag', async () => {
      const result = await service.listProducts(ws1, {
        page: 1,
        limit: 10,
        lowStock: true,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });
      assert.strictEqual(result.items.length, 1);
      assert.strictEqual(result.items[0].sku, 'POLO-SPORT'); // stockQuantity 3 <= 5
    });
  });

  describe('adjustInventory', () => {
    let createdProd: any;
    let variantId: string;

    beforeEach(async () => {
      createdProd = await service.createProduct(ws1, {
        name: 'Sản phẩm kho',
        sku: 'STOCK-PROD',
        basePrice: 100000,
        variants: [
          {
            name: 'Biến thể 1',
            sku: 'VAR-1',
            price: 100000,
            stockQuantity: 10,
          },
        ],
      });
      variantId = createdProd.variants[0].id;
      // Clear initial creation events
      emittedEvents = [];
    });

    it('should increase stock on STOCK_IN', async () => {
      const res = await service.adjustInventory(
        ws1,
        createdProd.id,
        variantId,
        {
          type: InventoryTransactionType.STOCK_IN,
          quantity: 15,
          reason: 'Nhập thêm từ xưởng',
        },
        userId,
      );

      assert.strictEqual(res.previousStock, 10);
      assert.strictEqual(res.newStock, 25);
      assert.strictEqual(res.quantity, 15);

      // Verify domain event emitted
      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].payload.stockQuantity, 25);
    });

    it('should decrease stock on STOCK_OUT', async () => {
      const res = await service.adjustInventory(
        ws1,
        createdProd.id,
        variantId,
        {
          type: InventoryTransactionType.STOCK_OUT,
          quantity: 4,
          reason: 'Hàng lỗi xuất trả',
        },
        userId,
      );

      assert.strictEqual(res.previousStock, 10);
      assert.strictEqual(res.newStock, 6);
    });

    it('should prevent STOCK_OUT from reducing below reservedQuantity', async () => {
      // Simulate that 8 units are reserved
      const rawVariant = variantsDb.get(variantId);
      rawVariant.reservedQuantity = 8;
      variantsDb.set(variantId, rawVariant);

      // Attempting to deduct 5 units would leave 5 < 8
      await assert.rejects(
        async () => {
          await service.adjustInventory(ws1, createdProd.id, variantId, {
            type: InventoryTransactionType.STOCK_OUT,
            quantity: 5,
            reason: 'Xuất kho quá mức',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'CANNOT_REDUCE_BELOW_RESERVED');
          return true;
        },
      );
    });

    it('should prevent cross-tenant inventory manipulation', async () => {
      await assert.rejects(
        async () => {
          await service.adjustInventory(ws2, createdProd.id, variantId, {
            type: InventoryTransactionType.STOCK_IN,
            quantity: 10,
            reason: 'Hack attempt',
          });
        },
        (err: any) => {
          assert.strictEqual(err.response?.code, 'VARIANT_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
