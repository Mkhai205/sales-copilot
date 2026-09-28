import {
  PaymentMethod,
  type OrderItemResponseDto,
  type OrderResponseDto,
} from '@sales-copilot/shared-contracts';

/**
 * Helper to format raw database Order into typed OrderResponseDto.
 * Shared by OrderWriterService, OrderLifecycleService and OrderQueryService
 * so every read/write path emits the exact same order shape.
 */
export function formatOrder(order: any): OrderResponseDto {
  const items: OrderItemResponseDto[] = (order.items || []).map((item: any) => ({
    id: item.id,
    workspaceId: item.workspaceId,
    orderId: item.orderId,
    productId: item.productId,
    variantId: item.variantId,
    productName: item.productName,
    variantName: item.variantName,
    sku: item.sku,
    unitPrice: Number(item.unitPrice),
    costPrice: Number(item.costPrice || 0),
    quantity: item.quantity,
    discountAmount: Number(item.discountAmount || 0),
    totalPrice: Number(item.totalPrice),
    metadata: item.metadata || {},
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }));

  const shippingAddress =
    order.recipientName || order.recipientPhone || order.recipientAddress
      ? {
          recipientName: order.recipientName || '',
          phoneNumber: order.recipientPhone || '',
          streetAddress: order.recipientAddress || '',
          ward: order.recipientWard || '',
          district: order.recipientDistrict || '',
          province: order.recipientProvince || '',
          shippingNotes: order.shippingNotes || null,
        }
      : null;

  return {
    id: order.id,
    displayId: order.displayId,
    orderNumber: order.orderNumber,
    workspaceId: order.workspaceId,
    conversationId: order.conversationId,
    contactId: order.contactId,
    createdById: order.createdById,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod:
      (order.paymentMethod as PaymentMethod) ||
      ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
      (order.paymentTransactions?.[0]?.paymentMethod as PaymentMethod) ||
      PaymentMethod.COD,
    fulfillmentStatus: order.fulfillmentStatus,
    subtotal: Number(order.subtotal),
    discountAmount: Number(order.discountAmount),
    discountType: order.discountType,
    discountReason: order.discountReason,
    shippingFee: Number(order.shippingFee),
    taxAmount: Number(order.taxAmount),
    totalAmount: Number(order.totalAmount),
    paidAmount: Number(order.paidAmount),
    currency: order.currency,
    customerNotes: order.customerNotes,
    internalNotes: order.internalNotes,
    cancelReason: order.cancelReason,
    confirmedAt: order.confirmedAt,
    paidAt: order.paidAt,
    shippedAt: order.shippedAt,
    completedAt: order.completedAt,
    cancelledAt: order.cancelledAt,
    metadata: order.metadata || {},
    recipientName: order.recipientName || null,
    recipientPhone: order.recipientPhone || null,
    recipientAddress: order.recipientAddress || null,
    recipientWard: order.recipientWard || null,
    recipientDistrict: order.recipientDistrict || null,
    recipientProvince: order.recipientProvince || null,
    shippingNotes: order.shippingNotes || null,
    items,
    shippingAddress,
    paymentTransactions: order.paymentTransactions || [],
    inventoryTransactions: order.inventoryTransactions || [],
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}
