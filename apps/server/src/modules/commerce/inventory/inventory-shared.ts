import {
  InventoryTransactionType,
  type InventoryTransactionResponseDto,
} from '@sales-copilot/shared-contracts';

/**
 * Helper to format raw database InventoryTransaction into InventoryTransactionResponseDto.
 * Shared by StockMovementService (ledger writes) and InventoryQueryService (ledger reads).
 */
export function formatTransaction(invTx: any): InventoryTransactionResponseDto {
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
