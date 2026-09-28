import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DiscountType,
  DomainEvent,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  type CreateOrderDto,
  type OrderResponseDto,
  type UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { StockMovementService } from '../inventory/stock-movement.service';
import { calculateLineItemTotals, calculateOrderFinancialTotals } from './orders-calculator';
import { assertCanUpdate } from './order-status-guard';
import { formatOrder } from './orders-shared';

@Injectable()
export class OrderWriterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly stockMovementService: StockMovementService,
  ) {}

  /**
   * Creates a new order draft strictly scoped to workspace.
   * Status is forced to DRAFT. No inventory is reserved at this stage.
   */
  async createOrder(
    workspaceId: string,
    dto: CreateOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Verify Contact exists in workspace
      const contact = await tx.contact.findFirst({
        where: { id: dto.contactId, workspaceId },
      });

      if (!contact) {
        throw new NotFoundException({
          code: 'CONTACT_NOT_FOUND',
          message: 'Contact not found in this workspace',
          details: { contactId: dto.contactId, workspaceId },
        });
      }

      // 2. Verify Conversation if provided
      if (dto.conversationId) {
        const conv = await tx.conversation.findFirst({
          where: { id: dto.conversationId, workspaceId },
        });
        if (!conv) {
          throw new NotFoundException({
            code: 'CONVERSATION_NOT_FOUND',
            message: 'Conversation not found in this workspace',
            details: { conversationId: dto.conversationId, workspaceId },
          });
        }
      }

      // 3. Verify and snapshot all line items
      const lineItemSnapshots: Array<{
        productId: string;
        variantId: string;
        productName: string;
        variantName: string;
        sku: string;
        unitPrice: number;
        costPrice: number;
        quantity: number;
        discountAmount: number;
        totalPrice: number;
        metadata: any;
      }> = [];

      let subtotal = 0;
      let lineDiscountsTotal = 0;

      for (const item of dto.items) {
        const variant = await tx.productVariant.findFirst({
          where: { id: item.variantId, productId: item.productId, workspaceId },
          include: { product: true },
        });

        if (!variant) {
          throw new NotFoundException({
            code: 'VARIANT_NOT_FOUND',
            message: `Product variant '${item.variantId}' not found in this workspace`,
            details: { variantId: item.variantId, productId: item.productId, workspaceId },
          });
        }

        const itemCalc = calculateLineItemTotals({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
        });

        subtotal += itemCalc.subtotal;
        lineDiscountsTotal += itemCalc.discountAmount;

        lineItemSnapshots.push({
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          unitPrice: item.unitPrice,
          costPrice: Number(variant.costPrice || 0),
          quantity: item.quantity,
          discountAmount: itemCalc.discountAmount,
          totalPrice: itemCalc.totalPrice,
          metadata: item.metadata || {},
        });
      }

      // 4. Calculate Financials — line-item discounts are folded into the effective
      // order discount so totalAmount always reflects them.
      const financialTotals = calculateOrderFinancialTotals({
        subtotal,
        discountType: dto.discountType,
        discountAmount: dto.discountAmount,
        shippingFee: dto.shippingFee,
        lineDiscountsTotal,
      });
      const discountAmount = financialTotals.discountAmount;
      const shippingFee = financialTotals.shippingFee;
      const totalAmount = financialTotals.totalAmount;

      // Temporary orderNumber until displayId is assigned by PostgreSQL autoincrement
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const tempOrderNumber = `ORD-${datePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      const resolvedPaymentMethod =
        dto.paymentMethod ||
        ((dto.metadata as any)?.paymentMethod as PaymentMethod) ||
        PaymentMethod.COD;

      // 5. Create Order
      const createdOrder = await tx.order.create({
        data: {
          orderNumber: tempOrderNumber,
          workspaceId,
          conversationId: dto.conversationId || null,
          contactId: dto.contactId,
          createdById: userId || null,
          status: OrderStatus.DRAFT,
          paymentStatus: PaymentStatus.UNPAID,
          paymentMethod: resolvedPaymentMethod,
          fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
          subtotal,
          discountAmount,
          discountType: dto.discountType || DiscountType.FIXED_AMOUNT,
          discountReason: dto.discountReason || null,
          shippingFee,
          taxAmount: 0,
          totalAmount,
          paidAmount: 0,
          currency: 'VND',
          customerNotes: dto.customerNotes || null,
          internalNotes: dto.internalNotes || null,
          recipientName: dto.recipientName ?? dto.shippingAddress?.recipientName ?? null,
          recipientPhone: dto.recipientPhone ?? dto.shippingAddress?.phoneNumber ?? null,
          recipientAddress: dto.recipientAddress ?? dto.shippingAddress?.streetAddress ?? null,
          recipientWard: dto.recipientWard ?? dto.shippingAddress?.ward ?? null,
          recipientDistrict: dto.recipientDistrict ?? dto.shippingAddress?.district ?? null,
          recipientProvince: dto.recipientProvince ?? dto.shippingAddress?.province ?? null,
          shippingNotes: dto.shippingNotes ?? dto.shippingAddress?.shippingNotes ?? null,
          metadata: {
            ...(dto.metadata || {}),
            paymentMethod: resolvedPaymentMethod,
          },
          items: {
            create: lineItemSnapshots.map(li => ({
              workspaceId,
              productId: li.productId,
              variantId: li.variantId,
              productName: li.productName,
              variantName: li.variantName,
              sku: li.sku,
              unitPrice: li.unitPrice,
              costPrice: li.costPrice,
              quantity: li.quantity,
              discountAmount: li.discountAmount,
              totalPrice: li.totalPrice,
              metadata: li.metadata,
            })),
          },
        },
      });

      // 6. Assign friendly order number with displayId: ORD-YYYYMMDD-{displayId}
      const finalOrderNumber = `ORD-${datePrefix}-${createdOrder.displayId}`;
      await tx.order.updateMany({
        where: { id: createdOrder.id, workspaceId },
        data: { orderNumber: finalOrderNumber },
      });

      // 7. If confirmImmediately is requested, atomically reserve stock and set status to CONFIRMED
      if (dto.confirmImmediately) {
        const reserveItems = lineItemSnapshots.map(li => ({
          variantId: li.variantId,
          quantity: li.quantity,
          productName: li.productName,
          variantName: li.variantName,
          sku: li.sku,
        }));

        await this.stockMovementService.reserveStock({
          workspaceId,
          items: reserveItems,
          orderId: createdOrder.id,
          orderDisplayId: createdOrder.displayId,
          orderNumber: finalOrderNumber,
          userId,
          reason: `Atomic reservation on 1-click order #${createdOrder.displayId} (${finalOrderNumber})`,
          tx,
        });

        await tx.order.updateMany({
          where: { id: createdOrder.id, workspaceId },
          data: {
            status: OrderStatus.CONFIRMED,
            confirmedAt: new Date(),
          },
        });
      }

      // 8. Fetch complete order with relations
      const order = await tx.order.findFirstOrThrow({
        where: { id: createdOrder.id, workspaceId },
        include: {
          items: true,
          paymentTransactions: true,
        },
      });

      const formatted = formatOrder(order);

      // 10. Post-commit hook: Realtime broadcast
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CREATED, {
          workspaceId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          conversationId: order.conversationId,
          order: formatted,
        });

        if (dto.confirmImmediately) {
          this.eventEmitter.emit(DomainEvent.ORDER_CONFIRMED, {
            workspaceId,
            orderId: order.id,
            orderNumber: order.orderNumber,
            displayId: order.displayId,
            conversationId: order.conversationId,
            confirmedAt: order.confirmedAt || new Date(),
            reservedItems: dto.items.map(i => ({ variantId: i.variantId, quantity: i.quantity })),
            order: formatted,
          });
        }
      });

      return formatted;
    });
  }

  /**
   * Updates an existing order draft strictly scoped to workspace.
   * Only orders in DRAFT status can be modified.
   */
  async updateOrder(
    workspaceId: string,
    orderId: string,
    dto: UpdateOrderDto,
    _userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Fetch current order with line items strictly scoped to workspaceId
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanUpdate(order);

      let subtotal = Number(order.subtotal);

      // order.discountAmount stores the EFFECTIVE discount (order-level + line-level, clamped).
      // Recover the order-level portion by subtracting the existing line-item discounts so the
      // calculator can re-fold with the (possibly new) line discounts without double counting.
      const existingLineDiscounts = (order.items || []).reduce(
        (sum, item) => sum + Number(item.discountAmount || 0),
        0,
      );
      let lineDiscountsTotal = existingLineDiscounts;

      // 2. Update line items if provided
      if (dto.items && dto.items.length > 0) {
        // Delete existing items
        await tx.orderItem.deleteMany({
          where: { orderId: order.id, workspaceId },
        });

        // Verify and snapshot new items
        const lineItemSnapshots: Array<{
          productId: string;
          variantId: string;
          productName: string;
          variantName: string;
          sku: string;
          unitPrice: number;
          costPrice: number;
          quantity: number;
          discountAmount: number;
          totalPrice: number;
          metadata: any;
        }> = [];

        subtotal = 0;
        lineDiscountsTotal = 0;

        for (const item of dto.items) {
          const variant = await tx.productVariant.findFirst({
            where: { id: item.variantId, productId: item.productId, workspaceId },
            include: { product: true },
          });

          if (!variant) {
            throw new NotFoundException({
              code: 'VARIANT_NOT_FOUND',
              message: `Product variant '${item.variantId}' not found in this workspace`,
              details: { variantId: item.variantId, productId: item.productId, workspaceId },
            });
          }

          const itemCalc = calculateLineItemTotals({
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountAmount: item.discountAmount,
          });

          subtotal += itemCalc.subtotal;
          lineDiscountsTotal += itemCalc.discountAmount;

          lineItemSnapshots.push({
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            variantName: variant.name,
            sku: variant.sku,
            unitPrice: item.unitPrice,
            costPrice: Number(variant.costPrice || 0),
            quantity: item.quantity,
            discountAmount: itemCalc.discountAmount,
            totalPrice: itemCalc.totalPrice,
            metadata: item.metadata || {},
          });
        }

        await tx.orderItem.createMany({
          data: lineItemSnapshots.map(li => ({
            workspaceId,
            orderId: order.id,
            productId: li.productId,
            variantId: li.variantId,
            productName: li.productName,
            variantName: li.variantName,
            sku: li.sku,
            unitPrice: li.unitPrice,
            costPrice: li.costPrice,
            quantity: li.quantity,
            discountAmount: li.discountAmount,
            totalPrice: li.totalPrice,
            metadata: li.metadata,
          })),
        });
      }

      // 3. Recalculate Financials — line-item discounts are folded into the effective
      // order discount so totalAmount always reflects them.
      const financialTotals = calculateOrderFinancialTotals({
        subtotal,
        discountType: dto.discountType !== undefined ? dto.discountType : order.discountType,
        discountAmount: dto.discountAmount,
        shippingFee: dto.shippingFee !== undefined ? dto.shippingFee : Number(order.shippingFee),
        existingDiscountAmount: Number(order.discountAmount) - existingLineDiscounts,
        existingSubtotal: Number(order.subtotal),
        lineDiscountsTotal,
      });
      const discountType = financialTotals.discountType;
      const discountAmount = financialTotals.discountAmount;
      const shippingFee = financialTotals.shippingFee;
      const totalAmount = financialTotals.totalAmount;

      // 4. Update Order Record
      const updateData: any = {
        subtotal,
        discountAmount,
        discountType,
        shippingFee,
        totalAmount,
        updatedAt: new Date(),
      };

      if (dto.recipientName !== undefined || dto.shippingAddress?.recipientName !== undefined) {
        updateData.recipientName =
          dto.recipientName !== undefined
            ? dto.recipientName
            : (dto.shippingAddress?.recipientName ?? null);
      }
      if (dto.recipientPhone !== undefined || dto.shippingAddress?.phoneNumber !== undefined) {
        updateData.recipientPhone =
          dto.recipientPhone !== undefined
            ? dto.recipientPhone
            : (dto.shippingAddress?.phoneNumber ?? null);
      }
      if (dto.recipientAddress !== undefined || dto.shippingAddress?.streetAddress !== undefined) {
        updateData.recipientAddress =
          dto.recipientAddress !== undefined
            ? dto.recipientAddress
            : (dto.shippingAddress?.streetAddress ?? null);
      }
      if (dto.recipientWard !== undefined || dto.shippingAddress?.ward !== undefined) {
        updateData.recipientWard =
          dto.recipientWard !== undefined ? dto.recipientWard : (dto.shippingAddress?.ward ?? null);
      }
      if (dto.recipientDistrict !== undefined || dto.shippingAddress?.district !== undefined) {
        updateData.recipientDistrict =
          dto.recipientDistrict !== undefined
            ? dto.recipientDistrict
            : (dto.shippingAddress?.district ?? null);
      }
      if (dto.recipientProvince !== undefined || dto.shippingAddress?.province !== undefined) {
        updateData.recipientProvince =
          dto.recipientProvince !== undefined
            ? dto.recipientProvince
            : (dto.shippingAddress?.province ?? null);
      }
      if (dto.shippingNotes !== undefined || dto.shippingAddress?.shippingNotes !== undefined) {
        updateData.shippingNotes =
          dto.shippingNotes !== undefined
            ? dto.shippingNotes
            : (dto.shippingAddress?.shippingNotes ?? null);
      }

      if (dto.discountReason !== undefined) updateData.discountReason = dto.discountReason;
      if (dto.customerNotes !== undefined) updateData.customerNotes = dto.customerNotes;
      if (dto.internalNotes !== undefined) updateData.internalNotes = dto.internalNotes;
      if (dto.paymentMethod !== undefined) {
        updateData.paymentMethod = dto.paymentMethod;
      }
      if (dto.paymentMethod !== undefined || dto.metadata !== undefined) {
        updateData.metadata = {
          ...((order.metadata as Record<string, unknown>) || {}),
          ...((dto.metadata as Record<string, unknown>) || {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod } : {}),
        };
      }

      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: updateData,
      });

      // 5. Fetch complete updated order
      const updatedOrder = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          paymentTransactions: true,
        },
      });

      const formatted = formatOrder(updatedOrder);

      // 7. Post-commit hook: Realtime broadcast
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_UPDATED, {
          workspaceId,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          displayId: updatedOrder.displayId,
          conversationId: updatedOrder.conversationId,
          order: formatted,
        });
      });

      return formatted;
    });
  }
}
