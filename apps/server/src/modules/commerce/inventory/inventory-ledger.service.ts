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
  type InventoryTransactionResponseDto,
  type InventoryVariantItemDto,
  type ListInventoryTransactionsQueryOutput,
  type ListInventoryVariantsQueryOutput,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { Prisma } from '../../../infrastructure/database/generated/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface ReserveStockItem {
  variantId: string;
  quantity: number;
  productName?: string;
  variantName?: string;
  sku?: string;
}

export interface ReserveStockParams {
  workspaceId: string;
  items: ReserveStockItem[];
  orderId?: string;
  orderDisplayId?: number;
  orderNumber?: string;
  userId?: string;
  reason?: string;
  tx?: Prisma.TransactionClient;
}

export interface CommitStockItem {
  variantId: string;
  quantity: number;
  productName?: string;
  variantName?: string;
  sku?: string;
}

export interface CommitStockParams {
  workspaceId: string;
  items: CommitStockItem[];
  orderId?: string;
  orderDisplayId?: number;
  orderNumber?: string;
  isPreviouslyReserved?: boolean;
  userId?: string;
  reason?: string;
  tx?: Prisma.TransactionClient;
}

export interface ReleaseStockItem {
  variantId: string;
  quantity: number;
  sku?: string;
}

export interface ReleaseStockParams {
  workspaceId: string;
  items: ReleaseStockItem[];
  orderId?: string;
  orderDisplayId?: number;
  orderNumber?: string;
  userId?: string;
  reason?: string;
  tx?: Prisma.TransactionClient;
}

export interface RestockStockItem {
  variantId: string;
  quantity: number;
  productName?: string;
  variantName?: string;
  sku?: string;
}

export interface RestockStockParams {
  workspaceId: string;
  items: RestockStockItem[];
  orderId?: string;
  orderDisplayId?: number;
  orderNumber?: string;
  userId?: string;
  reason?: string;
  tx?: Prisma.TransactionClient;
}

export interface AdjustStockParams {
  workspaceId: string;
  variantId: string;
  productId?: string;
  dto: AdjustInventoryDto;
  userId?: string;
  tx?: Prisma.TransactionClient;
}

export interface StockLevelResult {
  variantId: string;
  sku: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
}

@Injectable()
export class InventoryLedgerService {
  private readonly logger = new Logger(InventoryLedgerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Helper to dispatch events safely (via transaction post-commit hook if available, otherwise immediate).
   */
  private dispatchInventoryEvents(events: any[]): void {
    if (events.length === 0) return;
    const currentCtx =
      typeof this.prisma?.getCurrentContext === 'function' ? this.prisma.getCurrentContext() : null;
    if (currentCtx) {
      currentCtx.addPostCommitHook(() => {
        for (const ev of events) {
          this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
        }
      });
    } else {
      for (const ev of events) {
        this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
      }
    }
  }

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
   * Atomically reserves inventory for a batch of line items.
   * - Sorts items by variantId ascending to prevent PostgreSQL 40P01 deadlocks.
   * - Enforces Available = Physical (stockQuantity) - Reserved (reservedQuantity) >= quantity.
   * - Writes immutable InventoryTransaction (RESERVATION) ledger records.
   */
  async reserveStock(params: {
    workspaceId: string;
    items: ReserveStockItem[];
    orderId?: string;
    orderDisplayId?: number;
    orderNumber?: string;
    userId?: string;
    reason?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<InventoryTransactionResponseDto[]> {
    const execute = async (
      client: Prisma.TransactionClient,
    ): Promise<InventoryTransactionResponseDto[]> => {
      const { workspaceId, items, orderId, orderDisplayId, orderNumber, userId, reason } = params;

      if (!items || items.length === 0) {
        return [];
      }

      // 1. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      const transactions: InventoryTransactionResponseDto[] = [];
      const events: any[] = [];

      for (const item of sortedItems) {
        if (item.quantity <= 0) continue;

        // 2. Atomic reservation with availability predicate
        const count = await client.$executeRaw`
          UPDATE "product_variants"
          SET 
            "reservedQuantity" = "reservedQuantity" + ${item.quantity},
            "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
            AND "workspaceId" = ${workspaceId}
            AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
        `;

        if (count === 0) {
          const variant = await client.productVariant.findFirst({
            where: { id: item.variantId, workspaceId },
          });

          if (!variant) {
            throw new NotFoundException({
              code: 'VARIANT_NOT_FOUND',
              message: `Product variant '${item.variantId}' not found in workspace`,
              details: { variantId: item.variantId, workspaceId },
            });
          }

          const availableStock = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient available stock for '${item.productName || variant.name}' (${item.sku || variant.sku})`,
            details: {
              variantId: item.variantId,
              sku: item.sku || variant.sku,
              requestedQuantity: item.quantity,
              availableStock,
            },
          });
        }

        // 3. Snapshot live variant after reservation
        const currentVariant = await client.productVariant.findFirstOrThrow({
          where: { id: item.variantId, workspaceId },
        });

        const txReason =
          reason ||
          (orderDisplayId
            ? `Reserved for Order #${orderDisplayId} (${orderNumber || ''})`
            : 'Stock reservation');

        // 4. Record immutable ledger record
        const invTx = await client.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: orderId || null,
            type: InventoryTransactionType.RESERVATION,
            quantity: item.quantity,
            previousStock: currentVariant.stockQuantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: currentVariant.reservedQuantity - item.quantity,
            newReserved: currentVariant.reservedQuantity,
            reason: txReason,
            performedByUserId: userId || null,
          },
        });

        transactions.push(this.formatTransaction(invTx));

        events.push({
          workspaceId,
          variantId: item.variantId,
          sku: currentVariant.sku,
          previousStock: currentVariant.stockQuantity,
          newStock: currentVariant.stockQuantity,
          stockQuantity: currentVariant.stockQuantity,
          previousReserved: currentVariant.reservedQuantity - item.quantity,
          newReserved: currentVariant.reservedQuantity,
          availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
          reason: txReason,
        });
      }

      this.dispatchInventoryEvents(events);
      return transactions;
    };

    if (params.tx) {
      return execute(params.tx);
    }
    return this.prisma.runInTransaction(async ctx => execute(ctx.tx));
  }

  /**
   * Atomically commits inventory sale upon full payment or order fulfillment.
   * - If previously reserved: decrements BOTH stockQuantity and reservedQuantity.
   * - If NOT previously reserved (e.g., instant POS draft sale): decrements stockQuantity directly after checking available stock.
   * - Writes immutable InventoryTransaction (COMMIT_SALE) ledger records.
   */
  async commitStock(params: {
    workspaceId: string;
    items: CommitStockItem[];
    orderId?: string;
    orderDisplayId?: number;
    orderNumber?: string;
    isPreviouslyReserved?: boolean;
    userId?: string;
    reason?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<InventoryTransactionResponseDto[]> {
    const execute = async (
      client: Prisma.TransactionClient,
    ): Promise<InventoryTransactionResponseDto[]> => {
      const {
        workspaceId,
        items,
        orderId,
        orderDisplayId,
        orderNumber,
        isPreviouslyReserved = false,
        userId,
        reason,
      } = params;

      if (!items || items.length === 0) {
        return [];
      }

      // 1. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      const transactions: InventoryTransactionResponseDto[] = [];
      const events: any[] = [];

      for (const item of sortedItems) {
        if (item.quantity <= 0) continue;

        let count: number;
        if (isPreviouslyReserved) {
          // Stock was already reserved: Atomically decrement both physical and reserved stock
          count = await client.$executeRaw`
            UPDATE "product_variants"
            SET 
              "stockQuantity" = "stockQuantity" - ${item.quantity},
              "reservedQuantity" = "reservedQuantity" - ${item.quantity},
              "updatedAt" = NOW()
            WHERE "id" = ${item.variantId}
              AND "workspaceId" = ${workspaceId}
              AND "stockQuantity" >= ${item.quantity}
              AND "reservedQuantity" >= ${item.quantity}
          `;
        } else {
          // Stock was not reserved: Verify available stock and decrement physical stock
          count = await client.$executeRaw`
            UPDATE "product_variants"
            SET 
              "stockQuantity" = "stockQuantity" - ${item.quantity},
              "updatedAt" = NOW()
            WHERE "id" = ${item.variantId}
              AND "workspaceId" = ${workspaceId}
              AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
          `;
        }

        if (count === 0) {
          const variant = await client.productVariant.findFirst({
            where: { id: item.variantId, workspaceId },
          });

          if (!variant) {
            throw new NotFoundException({
              code: 'VARIANT_NOT_FOUND',
              message: `Product variant '${item.variantId}' not found in workspace`,
              details: { variantId: item.variantId, workspaceId },
            });
          }

          const availableStock = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient available stock to commit sale for '${item.productName || variant.name}' (${item.sku || variant.sku})`,
            details: {
              variantId: item.variantId,
              sku: item.sku || variant.sku,
              requestedQuantity: item.quantity,
              availableStock,
            },
          });
        }

        const currentVariant = await client.productVariant.findFirstOrThrow({
          where: { id: item.variantId, workspaceId },
        });

        const txReason =
          reason ||
          (orderDisplayId
            ? `Commit sale for Order #${orderDisplayId} (${orderNumber || ''})`
            : 'Commit stock sale');

        const invTx = await client.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: orderId || null,
            type: InventoryTransactionType.COMMIT_SALE,
            quantity: item.quantity,
            previousStock: currentVariant.stockQuantity + item.quantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: isPreviouslyReserved
              ? currentVariant.reservedQuantity + item.quantity
              : currentVariant.reservedQuantity,
            newReserved: currentVariant.reservedQuantity,
            reason: txReason,
            performedByUserId: userId || null,
          },
        });

        transactions.push(this.formatTransaction(invTx));

        events.push({
          workspaceId,
          variantId: item.variantId,
          sku: currentVariant.sku,
          previousStock: currentVariant.stockQuantity + item.quantity,
          newStock: currentVariant.stockQuantity,
          stockQuantity: currentVariant.stockQuantity,
          previousReserved: isPreviouslyReserved
            ? currentVariant.reservedQuantity + item.quantity
            : currentVariant.reservedQuantity,
          newReserved: currentVariant.reservedQuantity,
          availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
          reason: txReason,
        });
      }

      this.dispatchInventoryEvents(events);
      return transactions;
    };

    if (params.tx) {
      return execute(params.tx);
    }
    return this.prisma.runInTransaction(async ctx => execute(ctx.tx));
  }

  /**
   * Atomically releases reserved inventory back to available stock upon order cancellation.
   * - Decrements reservedQuantity safely using GREATEST(0, reservedQuantity - quantity).
   * - Writes immutable InventoryTransaction (RELEASE_RESERVATION) ledger records.
   */
  async releaseStock(params: {
    workspaceId: string;
    items: ReleaseStockItem[];
    orderId?: string;
    orderDisplayId?: number;
    orderNumber?: string;
    userId?: string;
    reason?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<InventoryTransactionResponseDto[]> {
    const execute = async (
      client: Prisma.TransactionClient,
    ): Promise<InventoryTransactionResponseDto[]> => {
      const { workspaceId, items, orderId, orderDisplayId, orderNumber, userId, reason } = params;

      if (!items || items.length === 0) {
        return [];
      }

      // 1. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      const transactions: InventoryTransactionResponseDto[] = [];
      const events: any[] = [];

      for (const item of sortedItems) {
        if (item.quantity <= 0) continue;

        const variantBefore = await client.productVariant.findFirst({
          where: { id: item.variantId, workspaceId },
        });

        if (!variantBefore) {
          throw new NotFoundException({
            code: 'VARIANT_NOT_FOUND',
            message: `Product variant '${item.variantId}' not found in workspace`,
            details: { variantId: item.variantId, workspaceId },
          });
        }

        // Atomically decrement reservedQuantity
        await client.$executeRaw`
          UPDATE "product_variants"
          SET 
            "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity}),
            "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
            AND "workspaceId" = ${workspaceId}
        `;

        const previousReserved = variantBefore.reservedQuantity;
        const newReserved = Math.max(0, previousReserved - item.quantity);

        const txReason =
          reason ||
          (orderDisplayId
            ? `Released reservation for Order #${orderDisplayId} (${orderNumber || ''})`
            : 'Release stock reservation');

        const invTx = await client.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: orderId || null,
            type: InventoryTransactionType.RELEASE_RESERVATION,
            quantity: item.quantity,
            previousStock: variantBefore.stockQuantity,
            newStock: variantBefore.stockQuantity,
            previousReserved,
            newReserved,
            reason: txReason,
            performedByUserId: userId || null,
          },
        });

        transactions.push(this.formatTransaction(invTx));

        events.push({
          workspaceId,
          variantId: item.variantId,
          sku: variantBefore.sku,
          previousStock: variantBefore.stockQuantity,
          newStock: variantBefore.stockQuantity,
          stockQuantity: variantBefore.stockQuantity,
          previousReserved,
          newReserved,
          availableStock: variantBefore.stockQuantity - newReserved,
          reason: txReason,
        });
      }

      this.dispatchInventoryEvents(events);
      return transactions;
    };

    if (params.tx) {
      return execute(params.tx);
    }
    return this.prisma.runInTransaction(async ctx => execute(ctx.tx));
  }

  /**
   * Atomically restocks physical inventory upon order cancellation (for PAID / SHIPPING orders).
   * - Increments stockQuantity safely.
   * - Writes immutable InventoryTransaction (RETURN_RESTOCK) ledger records.
   */
  async restockStock(params: {
    workspaceId: string;
    items: RestockStockItem[];
    orderId?: string;
    orderDisplayId?: number;
    orderNumber?: string;
    userId?: string;
    reason?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<InventoryTransactionResponseDto[]> {
    const execute = async (
      client: Prisma.TransactionClient,
    ): Promise<InventoryTransactionResponseDto[]> => {
      const { workspaceId, items, orderId, orderDisplayId, orderNumber, userId, reason } = params;

      if (!items || items.length === 0) {
        return [];
      }

      // 1. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...items].sort((a, b) => a.variantId.localeCompare(b.variantId));
      const transactions: InventoryTransactionResponseDto[] = [];
      const events: any[] = [];

      for (const item of sortedItems) {
        if (item.quantity <= 0) continue;

        const variantBefore = await client.productVariant.findFirst({
          where: { id: item.variantId, workspaceId },
        });

        if (!variantBefore) {
          throw new NotFoundException({
            code: 'VARIANT_NOT_FOUND',
            message: `Product variant '${item.variantId}' not found in workspace`,
            details: { variantId: item.variantId, workspaceId },
          });
        }

        // Atomically increment stockQuantity
        await client.$executeRaw`
          UPDATE "product_variants"
          SET 
            "stockQuantity" = "stockQuantity" + ${item.quantity},
            "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
            AND "workspaceId" = ${workspaceId}
        `;

        const previousStock = variantBefore.stockQuantity;
        const newStock = previousStock + item.quantity;

        const txReason =
          reason ||
          (orderDisplayId
            ? `Restocked physical inventory for cancelled Order #${orderDisplayId} (${orderNumber || ''})`
            : 'Restock physical inventory');

        const invTx = await client.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: orderId || null,
            type: InventoryTransactionType.RETURN_RESTOCK,
            quantity: item.quantity,
            previousStock,
            newStock,
            previousReserved: variantBefore.reservedQuantity,
            newReserved: variantBefore.reservedQuantity,
            reason: txReason,
            performedByUserId: userId || null,
          },
        });

        transactions.push(this.formatTransaction(invTx));

        events.push({
          workspaceId,
          variantId: item.variantId,
          sku: variantBefore.sku,
          previousStock,
          newStock,
          stockQuantity: newStock,
          previousReserved: variantBefore.reservedQuantity,
          newReserved: variantBefore.reservedQuantity,
          availableStock: newStock - variantBefore.reservedQuantity,
          reason: txReason,
        });
      }

      this.dispatchInventoryEvents(events);
      return transactions;
    };

    if (params.tx) {
      return execute(params.tx);
    }
    return this.prisma.runInTransaction(async ctx => execute(ctx.tx));
  }

  /**
   * Manual inventory adjustment (STOCK_IN, STOCK_OUT, INVENTORY_AUDIT).
   * - Enforces CANNOT_REDUCE_BELOW_RESERVED guard.
   * - Writes immutable InventoryTransaction ledger records.
   */
  async adjustStock(params: {
    workspaceId: string;
    variantId: string;
    productId?: string;
    dto: AdjustInventoryDto;
    userId?: string;
    tx?: Prisma.TransactionClient;
  }): Promise<InventoryTransactionResponseDto> {
    const execute = async (
      client: Prisma.TransactionClient,
    ): Promise<InventoryTransactionResponseDto> => {
      const { workspaceId, variantId, productId, dto, userId } = params;

      const where: any = { id: variantId, workspaceId };
      if (productId) {
        where.productId = productId;
      }

      const variant = await client.productVariant.findFirst({ where });

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
        count = await client.$executeRaw`
          UPDATE "product_variants"
          SET "stockQuantity" = "stockQuantity" + ${dto.quantity}, "updatedAt" = NOW()
          WHERE "id" = ${variantId} AND "workspaceId" = ${workspaceId}
        `;
      } else if (dto.type === InventoryTransactionType.STOCK_OUT) {
        count = await client.$executeRaw`
          UPDATE "product_variants"
          SET "stockQuantity" = "stockQuantity" - ${dto.quantity}, "updatedAt" = NOW()
          WHERE "id" = ${variantId} AND "workspaceId" = ${workspaceId}
            AND ("stockQuantity" - ${dto.quantity}) >= "reservedQuantity"
        `;
      } else if (dto.type === InventoryTransactionType.INVENTORY_AUDIT) {
        count = await client.$executeRaw`
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
        if (dto.type === InventoryTransactionType.STOCK_IN) {
          throw new NotFoundException({
            code: 'VARIANT_NOT_FOUND',
            message: 'Product variant not found in this workspace',
            details: { variantId, productId, workspaceId },
          });
        }
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

      const currentVariant = await client.productVariant.findFirst({
        where: { id: variantId, workspaceId },
      });

      if (!currentVariant) {
        throw new NotFoundException({
          code: 'VARIANT_NOT_FOUND',
          message: 'Product variant not found in this workspace',
          details: { variantId, productId, workspaceId },
        });
      }
      const newStock = currentVariant.stockQuantity;
      const newReserved = currentVariant.reservedQuantity;

      const invTx = await client.inventoryTransaction.create({
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

      const formatted = this.formatTransaction(invTx);

      this.dispatchInventoryEvents([
        {
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
        },
      ]);

      return formatted;
    };

    if (params.tx) {
      return execute(params.tx);
    }
    return this.prisma.runInTransaction(async ctx => execute(ctx.tx));
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

    const items = transactions.map((t: any) => this.formatTransaction(t));

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

  /**
   * Helper to format raw database InventoryTransaction into InventoryTransactionResponseDto.
   */
  private formatTransaction(invTx: any): InventoryTransactionResponseDto {
    return {
      id: invTx.id,
      workspaceId: invTx.workspaceId,
      variantId: invTx.variantId,
      orderId: invTx.orderId || null,
      type: invTx.type as InventoryTransactionType,
      quantity: invTx.quantity,
      previousStock: invTx.previousStock,
      newStock: invTx.newStock,
      previousReserved: invTx.previousReserved,
      newReserved: invTx.newReserved,
      reason: invTx.reason || null,
      performedByUserId: invTx.performedByUserId || null,
      performedByUser: invTx.performedByUser || null,
      order: invTx.order || null,
      variant: invTx.variant
        ? {
            id: invTx.variant.id,
            sku: invTx.variant.sku,
            name: invTx.variant.name,
            productId: invTx.variant.productId,
            productName: invTx.variant.product?.name,
          }
        : null,
      createdAt: invTx.createdAt,
    };
  }
}
