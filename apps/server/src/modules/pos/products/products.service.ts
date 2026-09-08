import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DomainEvent,
  InventoryTransactionType,
  type AdjustInventoryDto,
  type CreateProductDto,
  type InventoryTransactionResponseDto,
  type ListProductsQueryOutput,
  type PaginationMeta,
  type ProductResponseDto,
  type ProductVariantResponseDto,
  type UpdateProductDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { generateSlug } from '../../workspaces/utils/slug.util';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * List products with fast indexed search, category filtering, low-stock filter, and pagination.
   */
  async listProducts(
    workspaceId: string,
    query: ListProductsQueryOutput,
  ): Promise<{ items: ProductResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.category) {
      where.category = { equals: query.category, mode: 'insensitive' };
    }

    if (query.search) {
      const searchTerm = query.search;
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { sku: { contains: searchTerm, mode: 'insensitive' } },
        { barcode: { contains: searchTerm, mode: 'insensitive' } },
        {
          variants: {
            some: {
              OR: [
                { name: { contains: searchTerm, mode: 'insensitive' } },
                { sku: { contains: searchTerm, mode: 'insensitive' } },
                { barcode: { contains: searchTerm, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    if (query.lowStock) {
      where.variants = {
        ...where.variants,
        some: {
          stockQuantity: { lte: 5 },
        },
      };
    }

    const orderBy: any = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [total, products] = await Promise.all([
      client.product.count({ where }),
      client.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          variants: true,
        },
      }),
    ]);

    const items = products.map((product: any) => this.formatProduct(product));

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + items.length < total,
      },
    };
  }

  /**
   * Retrieve a single product by ID strictly scoped to the workspace.
   */
  async getProductById(workspaceId: string, id: string): Promise<ProductResponseDto> {
    const client = this.prisma.getClient();
    const product = await client.product.findFirst({
      where: { id, workspaceId },
      include: { variants: true },
    });

    if (!product) {
      throw new NotFoundException({
        code: 'PRODUCT_NOT_FOUND',
        message: 'Product not found in this workspace',
        details: { id, workspaceId },
      });
    }

    return this.formatProduct(product);
  }

  /**
   * Create a new product and nested variants atomically within runInTransaction.
   */
  async createProduct(
    workspaceId: string,
    dto: CreateProductDto,
    userId?: string,
  ): Promise<ProductResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Check product and variant SKU uniqueness in workspace
      const existingSku = await tx.product.findFirst({
        where: { workspaceId, sku: dto.sku },
      });

      if (existingSku) {
        throw new ConflictException({
          code: 'SKU_ALREADY_EXISTS',
          message: `Product with SKU '${dto.sku}' already exists in this workspace`,
          details: { sku: dto.sku },
        });
      }

      const variantSkus = dto.variants.map(v => v.sku);
      if (new Set(variantSkus).size !== variantSkus.length) {
        throw new BadRequestException({
          code: 'DUPLICATE_VARIANT_SKUS',
          message: 'Variant SKUs within the same product must be unique',
        });
      }

      for (const v of dto.variants) {
        const existingVar = await tx.productVariant.findFirst({
          where: { workspaceId, sku: v.sku },
        });
        if (existingVar) {
          throw new ConflictException({
            code: 'VARIANT_SKU_ALREADY_EXISTS',
            message: `Product variant with SKU '${v.sku}' already exists in this workspace`,
            details: { sku: v.sku },
          });
        }
      }

      // 2. Generate slug with collision resolution
      const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);
      let slug = baseSlug;
      let counter = 1;
      while (await tx.product.findFirst({ where: { workspaceId, slug } })) {
        slug = `${baseSlug}-${counter++}`;
      }

      // 3. Create Product with nested Variants
      const product = await tx.product.create({
        data: {
          workspaceId,
          name: dto.name,
          slug,
          description: dto.description || null,
          category: dto.category || null,
          basePrice: dto.basePrice,
          costPrice: dto.costPrice || 0,
          sku: dto.sku,
          barcode: dto.barcode || null,
          imageUrl: dto.imageUrl || null,
          images: dto.images || [],
          isActive: true,
          trackInventory: dto.trackInventory ?? true,
          metadata: dto.metadata || {},
          variants: {
            create: dto.variants.map(v => ({
              workspaceId,
              name: v.name,
              sku: v.sku,
              barcode: v.barcode || null,
              price: v.price,
              costPrice: v.costPrice || 0,
              stockQuantity: v.stockQuantity || 0,
              reservedQuantity: 0,
              attributes: v.attributes || {},
              imageUrl: v.imageUrl || null,
              isActive: true,
            })),
          },
        },
        include: {
          variants: true,
        },
      });

      // 4. Record initial stock transactions for variants with stockQuantity > 0
      const stockInVariants: Array<{ id: string; sku: string; stock: number }> = [];
      for (const variant of product.variants) {
        if (variant.stockQuantity > 0) {
          await tx.inventoryTransaction.create({
            data: {
              workspaceId,
              variantId: variant.id,
              type: InventoryTransactionType.STOCK_IN,
              quantity: variant.stockQuantity,
              previousStock: 0,
              newStock: variant.stockQuantity,
              previousReserved: 0,
              newReserved: 0,
              reason: 'Khởi tạo tồn kho ban đầu khi tạo sản phẩm',
              performedByUserId: userId || null,
            },
          });
          stockInVariants.push({ id: variant.id, sku: variant.sku, stock: variant.stockQuantity });
        }
      }

      // 5. Post-commit hooks
      if (stockInVariants.length > 0) {
        ctx.addPostCommitHook(() => {
          for (const item of stockInVariants) {
            this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, {
              workspaceId,
              variantId: item.id,
              sku: item.sku,
              previousStock: 0,
              newStock: item.stock,
              previousReserved: 0,
              newReserved: 0,
              availableStock: item.stock,
              reason: 'Initial stock creation',
            });
          }
        });
      }

      return this.formatProduct(product);
    });
  }

  /**
   * Update product and its variants.
   */
  async updateProduct(
    workspaceId: string,
    id: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const existing = await tx.product.findFirst({
        where: { id, workspaceId },
        include: { variants: true },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found in this workspace',
          details: { id, workspaceId },
        });
      }

      if (dto.sku && dto.sku !== existing.sku) {
        const skuConflict = await tx.product.findFirst({
          where: { workspaceId, sku: dto.sku, id: { not: id } },
        });
        if (skuConflict) {
          throw new ConflictException({
            code: 'SKU_ALREADY_EXISTS',
            message: `Product with SKU '${dto.sku}' already exists in this workspace`,
            details: { sku: dto.sku },
          });
        }
      }

      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.slug !== undefined) updateData.slug = dto.slug;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.category !== undefined) updateData.category = dto.category;
      if (dto.basePrice !== undefined) updateData.basePrice = dto.basePrice;
      if (dto.costPrice !== undefined) updateData.costPrice = dto.costPrice;
      if (dto.sku !== undefined) updateData.sku = dto.sku;
      if (dto.barcode !== undefined) updateData.barcode = dto.barcode;
      if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
      if (dto.images !== undefined) updateData.images = dto.images;
      if (dto.trackInventory !== undefined) updateData.trackInventory = dto.trackInventory;
      if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
      if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

      // Handle variant updates if present
      if (dto.variants && dto.variants.length > 0) {
        for (const vDto of dto.variants) {
          if (vDto.id) {
            if (vDto.sku) {
              const conflict = await tx.productVariant.findFirst({
                where: { workspaceId, sku: vDto.sku, id: { not: vDto.id } },
              });
              if (conflict) {
                throw new ConflictException({
                  code: 'VARIANT_SKU_ALREADY_EXISTS',
                  message: `Biến thể với SKU '${vDto.sku}' đã tồn tại trong workspace này`,
                  details: { sku: vDto.sku },
                });
              }
            }

            await tx.productVariant.updateMany({
              where: { id: vDto.id, productId: id, workspaceId },
              data: {
                name: vDto.name,
                sku: vDto.sku,
                barcode: vDto.barcode,
                price: vDto.price,
                costPrice: vDto.costPrice,
                attributes: vDto.attributes,
                imageUrl: vDto.imageUrl,
                isActive: vDto.isActive,
              },
            });
          } else if (vDto.name && vDto.sku && vDto.price !== undefined) {
            const conflict = await tx.productVariant.findFirst({
              where: { workspaceId, sku: vDto.sku },
            });
            if (conflict) {
              throw new ConflictException({
                code: 'VARIANT_SKU_ALREADY_EXISTS',
                message: `Biến thể với SKU '${vDto.sku}' đã tồn tại trong workspace này`,
                details: { sku: vDto.sku },
              });
            }

            const newVar = await tx.productVariant.create({
              data: {
                workspaceId,
                productId: id,
                name: vDto.name,
                sku: vDto.sku,
                barcode: vDto.barcode || null,
                price: vDto.price,
                costPrice: vDto.costPrice || 0,
                stockQuantity: vDto.stockQuantity || 0,
                reservedQuantity: 0,
                attributes: vDto.attributes || {},
                imageUrl: vDto.imageUrl || null,
                isActive: vDto.isActive ?? true,
              },
            });

            if (newVar.stockQuantity > 0) {
              await tx.inventoryTransaction.create({
                data: {
                  workspaceId,
                  variantId: newVar.id,
                  type: InventoryTransactionType.STOCK_IN,
                  quantity: newVar.stockQuantity,
                  previousStock: 0,
                  newStock: newVar.stockQuantity,
                  previousReserved: 0,
                  newReserved: 0,
                  reason: 'Khởi tạo tồn kho cho biến thể mới bổ sung',
                },
              });
            }
          }
        }
      }

      await tx.product.updateMany({
        where: { id, workspaceId },
        data: updateData,
      });

      const updated = await tx.product.findFirstOrThrow({
        where: { id, workspaceId },
        include: { variants: true },
      });

      return this.formatProduct(updated);
    });
  }

  /**
   * Soft-delete product and its variants.
   */
  async deleteProduct(workspaceId: string, id: string): Promise<{ success: boolean }> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const existing = await tx.product.findFirst({
        where: { id, workspaceId },
      });

      if (!existing) {
        throw new NotFoundException({
          code: 'PRODUCT_NOT_FOUND',
          message: 'Product not found in this workspace',
          details: { id, workspaceId },
        });
      }

      await tx.productVariant.updateMany({
        where: { productId: id, workspaceId },
        data: { isActive: false },
      });

      await tx.product.updateMany({
        where: { id, workspaceId },
        data: { isActive: false },
      });

      return { success: true };
    });
  }

  /**
   * Manual inventory adjustment (STOCK_IN, STOCK_OUT, INVENTORY_AUDIT).
   * Verifies that stock deductions cannot breach reservedQuantity commitments.
   */
  async adjustInventory(
    workspaceId: string,
    productId: string,
    variantId: string,
    dto: AdjustInventoryDto,
    userId?: string,
  ): Promise<InventoryTransactionResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, productId, workspaceId },
      });

      if (!variant) {
        throw new NotFoundException({
          code: 'VARIANT_NOT_FOUND',
          message: 'Product variant not found in this workspace',
          details: { variantId, productId, workspaceId },
        });
      }

      const previousStock = variant.stockQuantity;
      const previousReserved = variant.reservedQuantity;
      let count: number;

      if (dto.type === InventoryTransactionType.STOCK_IN) {
        count = await tx.$executeRaw`
          UPDATE "product_variants"
          SET "stockQuantity" = "stockQuantity" + ${dto.quantity}, "updatedAt" = NOW()
          WHERE "id" = ${variantId} AND "workspaceId" = ${workspaceId}
        `;
      } else if (dto.type === InventoryTransactionType.STOCK_OUT) {
        count = await tx.$executeRaw`
          UPDATE "product_variants"
          SET "stockQuantity" = "stockQuantity" - ${dto.quantity}, "updatedAt" = NOW()
          WHERE "id" = ${variantId} AND "workspaceId" = ${workspaceId}
            AND ("stockQuantity" - ${dto.quantity}) >= "reservedQuantity"
        `;
      } else if (dto.type === InventoryTransactionType.INVENTORY_AUDIT) {
        count = await tx.$executeRaw`
          UPDATE "product_variants"
          SET "stockQuantity" = ${dto.quantity}, "updatedAt" = NOW()
          WHERE "id" = ${variantId} AND "workspaceId" = ${workspaceId}
            AND ${dto.quantity} >= "reservedQuantity"
        `;
      } else {
        throw new BadRequestException({
          code: 'INVALID_ADJUSTMENT_TYPE',
          message:
            'Manual inventory adjustment only supports STOCK_IN, STOCK_OUT, and INVENTORY_AUDIT',
        });
      }

      if (count === 0) {
        throw new BadRequestException({
          code: 'CANNOT_REDUCE_BELOW_RESERVED',
          message:
            'Tồn kho vật lý sau khi giảm không được thấp hơn lượng hàng đã giữ trước (reservedQuantity)',
          details: {
            currentStock: previousStock,
            reservedQuantity: previousReserved,
            requestedDeduction: dto.quantity,
            availableStock: previousStock - previousReserved,
          },
        });
      }

      const currentVariant = await tx.productVariant.findFirstOrThrow({
        where: { id: variantId, workspaceId },
      });
      const newStock = currentVariant.stockQuantity;
      const newReserved = currentVariant.reservedQuantity;

      // Record immutable ledger entry
      const invTx = await tx.inventoryTransaction.create({
        data: {
          workspaceId,
          variantId,
          type: dto.type,
          quantity: dto.quantity,
          previousStock,
          newStock,
          previousReserved,
          newReserved,
          reason: dto.reason,
          performedByUserId: userId || null,
        },
      });

      // Post-commit hook: Realtime and event emission
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, {
          workspaceId,
          variantId,
          sku: variant.sku,
          previousStock,
          newStock,
          stockQuantity: newStock,
          previousReserved,
          newReserved,
          availableStock: newStock - newReserved,
          reason: dto.reason,
        });
      });

      return {
        id: invTx.id,
        workspaceId: invTx.workspaceId,
        variantId: invTx.variantId,
        orderId: invTx.orderId,
        type: invTx.type as InventoryTransactionType,
        quantity: invTx.quantity,
        previousStock: invTx.previousStock,
        newStock: invTx.newStock,
        previousReserved: invTx.previousReserved,
        newReserved: invTx.newReserved,
        reason: invTx.reason,
        performedByUserId: invTx.performedByUserId,
        createdAt: invTx.createdAt,
      };
    });
  }

  /**
   * Helper to format a raw product with computed fields.
   */
  private formatProduct(product: any): ProductResponseDto {
    const variants: ProductVariantResponseDto[] = (product.variants || []).map((v: any) => ({
      id: v.id,
      workspaceId: v.workspaceId,
      productId: v.productId,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      price: Number(v.price),
      costPrice: Number(v.costPrice),
      stockQuantity: v.stockQuantity,
      reservedQuantity: v.reservedQuantity,
      availableStock: Math.max(0, v.stockQuantity - v.reservedQuantity),
      attributes: v.attributes || {},
      imageUrl: v.imageUrl,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }));

    const totalStock = variants.reduce((acc, v) => acc + v.stockQuantity, 0);
    const totalReserved = variants.reduce((acc, v) => acc + v.reservedQuantity, 0);
    const totalAvailable = Math.max(0, totalStock - totalReserved);

    return {
      id: product.id,
      workspaceId: product.workspaceId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      basePrice: Number(product.basePrice),
      costPrice: Number(product.costPrice),
      sku: product.sku,
      barcode: product.barcode,
      imageUrl: product.imageUrl,
      images: Array.isArray(product.images) ? product.images : [],
      isActive: product.isActive,
      trackInventory: product.trackInventory,
      totalStock,
      totalReserved,
      totalAvailable,
      metadata: product.metadata || {},
      variants,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }
}
