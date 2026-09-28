import { OrderStatus } from '../../../infrastructure/database/generated/enums';
import type { CommitStockItem } from '../inventory/stock-movement.service';

/**
 * Orders already in fulfillment (SHIPPING) or completed must never regress status
 * or re-deduct stock when a late payment arrives — the payment is recorded only.
 * Shared by the auto matcher and manual match flows.
 */
export function isInFulfillmentOrCompleted(status: OrderStatus): boolean {
  return status === OrderStatus.SHIPPING || status === OrderStatus.COMPLETED;
}

interface LedgerSourceItem {
  variantId: string;
  quantity: number;
  productName?: string;
  variantName?: string;
  sku?: string;
}

/**
 * Maps order line items to the item shape expected by StockMovementService
 * (CommitStockItem and ReserveStockItem are structurally identical).
 */
export function toLedgerItems(items: LedgerSourceItem[] | null | undefined): CommitStockItem[] {
  return (items || []).map(item => ({
    variantId: item.variantId,
    quantity: item.quantity,
    productName: item.productName,
    variantName: item.variantName,
    sku: item.sku,
  }));
}

/**
 * Shared payment lock domain — same key as payOrder and the reconciliation processor
 * so payment mutations on one order are always serialized.
 */
export function buildPaymentLockKey(workspaceId: string, orderId: string): string {
  return `ws:${workspaceId}:order:${orderId}:payment`;
}
