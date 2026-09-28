import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ListOrdersQueryOutput,
  type OrderResponseDto,
  type PaginationMeta,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { formatOrder } from './orders-shared';

/**
 * Select projection for the hot orders list path: covers every field
 * `formatOrder` maps plus the payment-transaction fields the DTO/FE consume
 * (id, paymentMethod, gateway, status, amount, transactionCode, paidAt, createdAt).
 * Excludes `paymentTransactions.rawWebhookPayload` and other unmapped columns,
 * and omits `inventoryTransactions` (never included on the list path).
 */
const ORDER_LIST_SELECT = {
  id: true,
  displayId: true,
  orderNumber: true,
  workspaceId: true,
  conversationId: true,
  contactId: true,
  createdById: true,
  status: true,
  paymentStatus: true,
  paymentMethod: true,
  fulfillmentStatus: true,
  subtotal: true,
  discountAmount: true,
  discountType: true,
  discountReason: true,
  shippingFee: true,
  taxAmount: true,
  totalAmount: true,
  paidAmount: true,
  currency: true,
  customerNotes: true,
  internalNotes: true,
  cancelReason: true,
  confirmedAt: true,
  paidAt: true,
  shippedAt: true,
  completedAt: true,
  cancelledAt: true,
  metadata: true,
  recipientName: true,
  recipientPhone: true,
  recipientAddress: true,
  recipientWard: true,
  recipientDistrict: true,
  recipientProvince: true,
  shippingNotes: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      workspaceId: true,
      orderId: true,
      productId: true,
      variantId: true,
      productName: true,
      variantName: true,
      sku: true,
      unitPrice: true,
      costPrice: true,
      quantity: true,
      discountAmount: true,
      totalPrice: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  paymentTransactions: {
    select: {
      id: true,
      paymentMethod: true,
      gateway: true,
      amount: true,
      status: true,
      transactionCode: true,
      paidAt: true,
      createdAt: true,
    },
  },
};

@Injectable()
export class OrderQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves paginated orders with filtering.
   */
  async listOrders(
    workspaceId: string,
    query: ListOrdersQueryOutput,
  ): Promise<{ items: OrderResponseDto[]; meta: PaginationMeta }> {
    const client = this.prisma.getClient();
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { workspaceId };

    if (query.conversationId) where.conversationId = query.conversationId;
    if (query.contactId) where.contactId = query.contactId;
    if (query.status) where.status = query.status;
    if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
    if (query.fulfillmentStatus) where.fulfillmentStatus = query.fulfillmentStatus;

    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customerNotes: { contains: query.search, mode: 'insensitive' } },
        { recipientName: { contains: query.search, mode: 'insensitive' } },
        { recipientPhone: { contains: query.search, mode: 'insensitive' } },
        { contact: { name: { contains: query.search, mode: 'insensitive' } } },
        { contact: { phoneNumber: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const orderBy: any = {};
    if (query.sortBy) {
      orderBy[query.sortBy] = query.sortOrder || 'desc';
    } else {
      orderBy.createdAt = 'desc';
    }

    const [total, orders] = await Promise.all([
      client.order.count({ where }),
      client.order.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: ORDER_LIST_SELECT,
      }),
    ]);

    const items = orders.map((o: any) => formatOrder(o));

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
   * Retrieves single order by UUID, orderNumber, or displayId strictly scoped to workspace.
   */
  async getOrderById(workspaceId: string, id: string): Promise<OrderResponseDto> {
    const client = this.prisma.getClient();
    const where: any = { workspaceId };
    if (/^\d+$/.test(id)) {
      where.OR = [{ id }, { displayId: parseInt(id, 10) }];
    } else if (id.startsWith('ORD-')) {
      where.OR = [{ id }, { orderNumber: id }];
    } else {
      where.id = id;
    }

    const order = await client.order.findFirst({
      where,
      include: {
        items: true,
        paymentTransactions: true,
        inventoryTransactions: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found in this workspace',
        details: { id, workspaceId },
      });
    }

    return formatOrder(order);
  }
}
