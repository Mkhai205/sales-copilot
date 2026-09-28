import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type InventoryTransactionResponseDto,
  type InventoryVariantItemDto,
  type ListInventoryTransactionsQueryOutput,
  type ListInventoryVariantsQueryOutput,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { formatTransaction } from './inventory-shared';

export interface StockLevelResult {
  variantId: string;
  sku: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
}

@Injectable()
export class InventoryQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fast lookup of 3-state stock levels for a product variant.
   */
  async getStock(
    workspaceId: string,
    variantId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StockLevelResult> {
    const client = tx || this.prisma.client;
    const variant = await client.productVariant.findFirst({
      where: { id: variantId, workspaceId },
    });

    if (!variant) {
      throw new NotFoundException({
        code: 'VARIANT_NOT_FOUND',
        message: `VARIANT_NOT_FOUND: Product variant '${variantId}' not found in workspace`,
        details: { variantId, workspaceId },
      });
    }

    return {
      variantId: variant.id,
      sku: variant.sku,
      stockQuantity: variant.stockQuantity,
      reservedQuantity: variant.reservedQuantity,
      availableStock: Math.max(0, variant.stockQuantity - variant.reservedQuantity),
    };
  }

  /**
   * List inventory transactions with multi-tenant workspace isolation, variant/type filters, and pagination.
   */
  async listTransactions(
    workspaceId: string,
    query: ListInventoryTransactionsQueryOutput,
  ): Promise<{ items: InventoryTransactionResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.client;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };
    if (query.variantId) {
      where.variantId = query.variantId;
    }
    if (query.productId) {
      where.variant = { productId: query.productId };
    }
    if (query.orderId) {
      where.orderId = query.orderId;
    }
    if (query.type) {
      where.type = query.type;
    }

    const [total, transactions] = await Promise.all([
      client.inventoryTransaction.count({ where }),
      client.inventoryTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          performedByUser: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              email: true,
            },
          },
          order: {
            select: {
              id: true,
              orderNumber: true,
              displayId: true,
            },
          },
          variant: {
            select: {
              id: true,
              sku: true,
              name: true,
              productId: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const items = transactions.map((t: any) => formatTransaction(t));

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
   * Flat variant listing for warehouse inventory operations with stock calculation, lowStock/outOfStock filters, and searching.
   */
  async listInventoryVariants(
    workspaceId: string,
    query: ListInventoryVariantsQueryOutput,
  ): Promise<{ items: InventoryVariantItemDto[]; meta: PaginationMeta }> {
    const client = this.prisma.client;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      workspaceId,
      isActive: true,
      product: { isActive: true },
    };

    if (query.search) {
      const term = query.search;
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.outOfStock) {
      where.stockQuantity = { lte: 0 };
    }

    if (query.lowStock) {
      where.stockQuantity = { lte: 10 };
    }

    const orderBy: any = {};
    if (query.sortBy === 'sku' || query.sortBy === 'name' || query.sortBy === 'stockQuantity') {
      orderBy[query.sortBy] = query.sortOrder || 'desc';
    } else {
      orderBy.updatedAt = 'desc';
    }

    const [total, variants] = await Promise.all([
      client.productVariant.count({ where }),
      client.productVariant.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              imageUrl: true,
              images: true,
            },
          },
        },
      }),
    ]);

    const items: InventoryVariantItemDto[] = variants.map((v: any) => ({
      id: v.id,
      workspaceId: v.workspaceId,
      productId: v.productId,
      productName: v.product?.name || 'Sản phẩm',
      productSku: v.product?.sku || '',
      productImageUrl:
        v.imageUrl ||
        v.product?.imageUrl ||
        (Array.isArray(v.product?.images) ? v.product.images[0] : null) ||
        null,
      name: v.name,
      sku: v.sku,
      barcode: v.barcode,
      price: Number(v.price),
      costPrice: Number(v.costPrice || 0),
      stockQuantity: v.stockQuantity,
      reservedQuantity: v.reservedQuantity,
      availableStock: Math.max(0, v.stockQuantity - v.reservedQuantity),
      attributes: v.attributes || {},
      isActive: v.isActive,
      updatedAt: v.updatedAt,
    }));

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
   * Fast inventory summary KPI metrics for the workspace.
   */
  async getInventorySummary(workspaceId: string): Promise<{
    totalSkus: number;
    totalPhysicalStock: number;
    totalReservedStock: number;
    totalAvailableStock: number;
    lowStockSkus: number;
    outOfStockSkus: number;
  }> {
    const client = this.prisma.client;
    const variants = await client.productVariant.findMany({
      where: { workspaceId, isActive: true, product: { isActive: true } },
      select: {
        stockQuantity: true,
        reservedQuantity: true,
      },
    });

    let totalPhysicalStock = 0;
    let totalReservedStock = 0;
    let lowStockSkus = 0;
    let outOfStockSkus = 0;

    for (const v of variants) {
      totalPhysicalStock += v.stockQuantity;
      totalReservedStock += v.reservedQuantity;
      const available = v.stockQuantity - v.reservedQuantity;
      if (available <= 0) {
        outOfStockSkus++;
      } else if (available <= 5) {
        lowStockSkus++;
      }
    }

    return {
      totalSkus: variants.length,
      totalPhysicalStock,
      totalReservedStock,
      totalAvailableStock: Math.max(0, totalPhysicalStock - totalReservedStock),
      lowStockSkus,
      outOfStockSkus,
    };
  }
}
