import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus } from '@sales-copilot/shared-contracts';

/**
 * Validates that an order is in DRAFT status prior to updates.
 */
export function assertCanUpdate(order: { status: OrderStatus | string }): void {
  if (order.status !== OrderStatus.DRAFT) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_FOR_UPDATE',
      message: `Only DRAFT orders can be updated. Current status: ${order.status}`,
      details: { currentStatus: order.status },
    });
  }
}

/**
 * Validates that an order can be confirmed (must be DRAFT and have items).
 */
export function assertCanConfirm(order: {
  status: OrderStatus | string;
  items?: Array<unknown> | null;
}): void {
  if (order.status !== OrderStatus.DRAFT) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_TRANSITION',
      message: `Only DRAFT orders can be confirmed. Current status: ${order.status}`,
      details: { currentStatus: order.status, targetStatus: OrderStatus.CONFIRMED },
    });
  }

  if (!order.items || order.items.length === 0) {
    throw new BadRequestException({
      code: 'EMPTY_ORDER',
      message: 'Cannot confirm an order with no line items',
    });
  }
}

/**
 * Validates that an order can be cancelled.
 */
export function assertCanCancel(order: { id: string; status: OrderStatus | string }): void {
  if (order.status === OrderStatus.COMPLETED) {
    throw new ConflictException({
      code: 'ORDER_ALREADY_COMPLETED',
      message: 'Không thể hủy đơn hàng đã hoàn tất (COMPLETED).',
      details: { orderId: order.id, status: order.status },
    });
  }

  if (
    order.status !== OrderStatus.DRAFT &&
    order.status !== OrderStatus.CONFIRMED &&
    order.status !== OrderStatus.PAID &&
    order.status !== OrderStatus.SHIPPING
  ) {
    throw new ConflictException({
      code: 'ORDER_NOT_CANCELLABLE',
      message: `Cannot cancel order in status '${order.status}'. Only DRAFT, CONFIRMED, PAID, and SHIPPING orders can be cancelled.`,
      details: { orderId: order.id, status: order.status },
    });
  }
}

/**
 * Validates that an order can be completed.
 */
export function assertCanComplete(order: { id: string; status: OrderStatus | string }): void {
  if (order.status === OrderStatus.COMPLETED) {
    throw new ConflictException({
      code: 'ORDER_ALREADY_COMPLETED',
      message: 'Đơn hàng đã được hoàn tất trước đó.',
      details: { orderId: order.id, status: order.status },
    });
  }

  if (
    order.status !== OrderStatus.SHIPPING &&
    order.status !== OrderStatus.PAID &&
    order.status !== OrderStatus.CONFIRMED
  ) {
    throw new BadRequestException({
      code: 'INVALID_STATUS_FOR_COMPLETION',
      message: `Cannot complete order in status '${order.status}'. Only SHIPPING, PAID, or CONFIRMED orders can be completed.`,
      details: { currentStatus: order.status },
    });
  }
}
