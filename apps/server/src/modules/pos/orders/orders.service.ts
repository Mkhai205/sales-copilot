import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CarrierNetwork,
  CarrierProvider,
  DiscountType,
  DomainEvent,
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  type CancelOrderDto,
  type CreateOrderDto,
  type ListOrdersQueryOutput,
  type ManualPayOrderDto,
  type OrderItemResponseDto,
  type OrderResponseDto,
  type PaginationMeta,
  type ShippingAddressResponseDto,
  type ShippingLabelDataDto,
  type UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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

        const itemSubtotal = item.unitPrice * item.quantity;
        const itemDiscount = item.discountAmount || 0;
        const itemTotalPrice = Math.max(0, itemSubtotal - itemDiscount);

        subtotal += itemSubtotal;

        lineItemSnapshots.push({
          productId: variant.productId,
          variantId: variant.id,
          productName: variant.product.name,
          variantName: variant.name,
          sku: variant.sku,
          unitPrice: item.unitPrice,
          costPrice: Number(variant.costPrice || 0),
          quantity: item.quantity,
          discountAmount: itemDiscount,
          totalPrice: itemTotalPrice,
          metadata: item.metadata || {},
        });
      }

      // 4. Calculate Financials
      const discountAmount =
        dto.discountType === DiscountType.PERCENTAGE
          ? Math.min(
              subtotal,
              Math.round((subtotal * Math.min(100, dto.discountAmount || 0)) / 100),
            )
          : Math.min(subtotal, dto.discountAmount || 0);

      const shippingFee = dto.shippingFee || 0;
      const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

      // Temporary orderNumber until displayId is assigned by PostgreSQL autoincrement
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const tempOrderNumber = `ORD-${datePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

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
          metadata: dto.metadata || {},
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

      // 7. Create ShippingAddress if provided
      if (dto.shippingAddress) {
        await tx.shippingAddress.create({
          data: {
            workspaceId,
            orderId: createdOrder.id,
            contactId: dto.contactId,
            recipientName: dto.shippingAddress.recipientName,
            phoneNumber: dto.shippingAddress.phoneNumber,
            carrierNetwork: dto.shippingAddress.carrierNetwork || CarrierNetwork.OTHER,
            streetAddress: dto.shippingAddress.streetAddress,
            ward: dto.shippingAddress.ward,
            district: dto.shippingAddress.district,
            province: dto.shippingAddress.province,
            country: dto.shippingAddress.country || 'VN',
            postalCode: dto.shippingAddress.postalCode || null,
            shippingCarrier: dto.shippingAddress.shippingCarrier,
            trackingCode: dto.shippingAddress.trackingCode || null,
            shippingNotes: dto.shippingAddress.shippingNotes || null,
            carrierMetadata: dto.shippingAddress.carrierMetadata || {},
          },
        });
      }

      // 8. Fetch complete order with relations
      const order = await tx.order.findFirstOrThrow({
        where: { id: createdOrder.id, workspaceId },
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
        },
      });

      const formatted = this.formatOrder(order);

      // 9. Post-commit hook: Realtime broadcast
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CREATED, {
          workspaceId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          conversationId: order.conversationId,
          order: formatted,
        });
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
        include: { items: true, shippingAddress: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      if (order.status !== OrderStatus.DRAFT) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_FOR_UPDATE',
          message: `Only DRAFT orders can be updated. Current status: ${order.status}`,
          details: { currentStatus: order.status },
        });
      }

      let subtotal = Number(order.subtotal);

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

          const itemSubtotal = item.unitPrice * item.quantity;
          const itemDiscount = item.discountAmount || 0;
          const itemTotalPrice = Math.max(0, itemSubtotal - itemDiscount);

          subtotal += itemSubtotal;

          lineItemSnapshots.push({
            productId: variant.productId,
            variantId: variant.id,
            productName: variant.product.name,
            variantName: variant.name,
            sku: variant.sku,
            unitPrice: item.unitPrice,
            costPrice: Number(variant.costPrice || 0),
            quantity: item.quantity,
            discountAmount: itemDiscount,
            totalPrice: itemTotalPrice,
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

      // 3. Recalculate Financials
      const discountType = dto.discountType !== undefined ? dto.discountType : order.discountType;
      let discountAmount: number;

      if (dto.discountAmount !== undefined) {
        discountAmount =
          discountType === DiscountType.PERCENTAGE
            ? Math.min(subtotal, Math.round((subtotal * Math.min(100, dto.discountAmount)) / 100))
            : Math.min(subtotal, dto.discountAmount);
      } else {
        if (discountType === DiscountType.PERCENTAGE) {
          const originalSubtotal = Number(order.subtotal);
          const originalPct =
            originalSubtotal > 0 ? (Number(order.discountAmount) * 100) / originalSubtotal : 0;
          discountAmount = Math.min(
            subtotal,
            Math.round((subtotal * Math.min(100, originalPct)) / 100),
          );
        } else {
          discountAmount = Math.min(subtotal, Number(order.discountAmount));
        }
      }

      const shippingFee =
        dto.shippingFee !== undefined ? dto.shippingFee : Number(order.shippingFee);
      const totalAmount = Math.max(0, subtotal - discountAmount + shippingFee);

      // 4. Update Shipping Address if provided
      if (dto.shippingAddress !== undefined) {
        await tx.shippingAddress.deleteMany({
          where: { orderId: order.id, workspaceId },
        });

        if (dto.shippingAddress) {
          await tx.shippingAddress.create({
            data: {
              workspaceId,
              orderId: order.id,
              contactId: order.contactId,
              recipientName: dto.shippingAddress.recipientName,
              phoneNumber: dto.shippingAddress.phoneNumber,
              carrierNetwork: dto.shippingAddress.carrierNetwork || CarrierNetwork.OTHER,
              streetAddress: dto.shippingAddress.streetAddress,
              ward: dto.shippingAddress.ward,
              district: dto.shippingAddress.district,
              province: dto.shippingAddress.province,
              country: dto.shippingAddress.country || 'VN',
              postalCode: dto.shippingAddress.postalCode || null,
              shippingCarrier: dto.shippingAddress.shippingCarrier,
              trackingCode: dto.shippingAddress.trackingCode || null,
              shippingNotes: dto.shippingAddress.shippingNotes || null,
              carrierMetadata: dto.shippingAddress.carrierMetadata || {},
            },
          });
        }
      }

      // 5. Update Order Record
      const updateData: any = {
        subtotal,
        discountAmount,
        discountType,
        shippingFee,
        totalAmount,
        updatedAt: new Date(),
      };

      if (dto.discountReason !== undefined) updateData.discountReason = dto.discountReason;
      if (dto.customerNotes !== undefined) updateData.customerNotes = dto.customerNotes;
      if (dto.internalNotes !== undefined) updateData.internalNotes = dto.internalNotes;
      if (dto.metadata !== undefined) updateData.metadata = dto.metadata;

      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: updateData,
      });

      // 6. Fetch complete updated order
      const updatedOrder = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
        },
      });

      const formatted = this.formatOrder(updatedOrder);

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

  /**
   * Atomically transitions order from DRAFT to CONFIRMED and reserves inventory.
   * Enforces Anti-Overselling Model A (Available = physical - reserved).
   * Sorts line items by variantId ascending prior to row-level locking to prevent 40P01 deadlocks.
   */
  async confirmOrder(
    workspaceId: string,
    orderId: string,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Fetch order with line items strictly scoped to workspaceId
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, shippingAddress: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

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

      // 2. Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

      // 3. Atomically reserve inventory for each line item (Model A)
      const reservedItemsSummary: Array<{ variantId: string; quantity: number }> = [];

      for (const item of sortedItems) {
        // Quoted camelCase column predicate raw SQL:
        const count = await tx.$executeRaw`
          UPDATE "product_variants"
          SET 
            "reservedQuantity" = "reservedQuantity" + ${item.quantity},
            "updatedAt" = NOW()
          WHERE "id" = ${item.variantId}
            AND "workspaceId" = ${workspaceId}
            AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
        `;

        if (count === 0) {
          const variant = await tx.productVariant.findFirst({
            where: { id: item.variantId, workspaceId },
          });

          const currentAvailable = (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);

          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: `Insufficient available stock for '${item.productName} - ${item.variantName}' (${item.sku})`,
            details: {
              variantId: item.variantId,
              sku: item.sku,
              requestedQuantity: item.quantity,
              availableStock: Math.max(0, currentAvailable),
            },
          });
        }

        // Snapshot live variant after atomic reservation
        const currentVariant = await tx.productVariant.findFirstOrThrow({
          where: { id: item.variantId, workspaceId },
        });

        // Record immutable inventory audit ledger
        await tx.inventoryTransaction.create({
          data: {
            workspaceId,
            variantId: item.variantId,
            orderId: order.id,
            type: InventoryTransactionType.RESERVATION,
            quantity: item.quantity,
            previousStock: currentVariant.stockQuantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: currentVariant.reservedQuantity - item.quantity,
            newReserved: currentVariant.reservedQuantity,
            reason: `Reserved for Order #${order.displayId} (${order.orderNumber})`,
            performedByUserId: userId || null,
          },
        });

        reservedItemsSummary.push({ variantId: item.variantId, quantity: item.quantity });
      }

      // 4. Transition order status to CONFIRMED
      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: {
          status: OrderStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      const updatedOrder = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
        },
      });

      const formatted = this.formatOrder(updatedOrder);

      // 5. Post-commit hook: emit DomainEvent.ORDER_CONFIRMED
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CONFIRMED, {
          workspaceId,
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          displayId: updatedOrder.displayId,
          conversationId: updatedOrder.conversationId,
          confirmedAt: updatedOrder.confirmedAt || new Date(),
          reservedItems: reservedItemsSummary,
          order: formatted,
        });
      });

      return formatted;
    });
  }

  /**
   * Records manual payment and commits inventory sale.
   */
  async payOrder(
    workspaceId: string,
    orderId: string,
    dto: ManualPayOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, shippingAddress: true, paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CONFIRMED) {
        throw new BadRequestException({
          code: 'INVALID_STATUS_FOR_PAYMENT',
          message: `Cannot pay order in '${order.status}' status. Must be DRAFT or CONFIRMED.`,
        });
      }

      const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;

      // 1. Record payment transaction
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const idempotencyKey = `manual:${order.id}:${Date.now()}`;

      await tx.paymentTransaction.create({
        data: {
          workspaceId,
          orderId: order.id,
          paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
          gateway: PaymentGateway.MANUAL,
          amount: dto.amount,
          currency: 'VND',
          status: PaymentTransactionStatus.SUCCESS,
          transactionCode: dto.transactionCode || `MANUAL-${dateStr}`,
          transferContent: dto.notes || `Thanh toán đơn hàng #${order.displayId}`,
          idempotencyKey,
          paidAt: new Date(),
        },
      });

      // 2. Financial calculation
      const totalPaid = Number(order.paidAmount) + dto.amount;
      const orderTotal = Number(order.totalAmount);
      const isFullyPaid = totalPaid >= orderTotal;

      // Deterministic Variant Sorting (Deadlock Prevention 40P01)
      const sortedItems = [...(order.items || [])].sort((a, b) =>
        a.variantId.localeCompare(b.variantId),
      );
      const inventoryUpdateEvents: any[] = [];

      if (isFullyPaid) {
        // Full payment: Commit inventory sale
        for (const item of sortedItems) {
          let count: number;
          if (isPreviouslyConfirmed) {
            // CONFIRMED: Stock was already reserved. Atomically decrement both physical and reserved stock
            count = await tx.$executeRaw`
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
            // DRAFT: Stock was not reserved. Atomically verify available stock and decrement physical stock
            count = await tx.$executeRaw`
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
            const variant = await tx.productVariant.findFirst({
              where: { id: item.variantId, workspaceId },
            });
            const currentAvailable =
              (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);
            throw new ConflictException({
              code: 'INSUFFICIENT_STOCK',
              message: `Insufficient available stock for '${item.productName}' (${item.sku})`,
              details: {
                variantId: item.variantId,
                sku: item.sku,
                requestedQuantity: item.quantity,
                availableStock: Math.max(0, currentAvailable),
              },
            });
          }

          const currentVariant = await tx.productVariant.findFirstOrThrow({
            where: { id: item.variantId, workspaceId },
          });

          await tx.inventoryTransaction.create({
            data: {
              workspaceId,
              variantId: item.variantId,
              orderId: order.id,
              type: InventoryTransactionType.COMMIT_SALE,
              quantity: item.quantity,
              previousStock: currentVariant.stockQuantity + item.quantity,
              newStock: currentVariant.stockQuantity,
              previousReserved: isPreviouslyConfirmed
                ? currentVariant.reservedQuantity + item.quantity
                : currentVariant.reservedQuantity,
              newReserved: currentVariant.reservedQuantity,
              reason: `Commit sale for Order #${order.displayId} (${order.orderNumber})`,
              performedByUserId: userId || null,
            },
          });

          inventoryUpdateEvents.push({
            workspaceId,
            variantId: item.variantId,
            sku: currentVariant.sku,
            previousStock: currentVariant.stockQuantity + item.quantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: isPreviouslyConfirmed
              ? currentVariant.reservedQuantity + item.quantity
              : currentVariant.reservedQuantity,
            newReserved: currentVariant.reservedQuantity,
            availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
            reason: `Commit sale for Order #${order.displayId}`,
          });
        }

        // Update order status to PAID
        await tx.order.updateMany({
          where: { id: order.id, workspaceId },
          data: {
            paidAmount: totalPaid,
            paymentStatus: PaymentStatus.PAID,
            status: OrderStatus.PAID,
            paidAt: new Date(),
          },
        });
      } else {
        // Partial payment (Deposit / Installment):
        // If order was DRAFT, atomically reserve stock and transition to CONFIRMED
        if (!isPreviouslyConfirmed) {
          for (const item of sortedItems) {
            const count = await tx.$executeRaw`
              UPDATE "product_variants"
              SET 
                "reservedQuantity" = "reservedQuantity" + ${item.quantity},
                "updatedAt" = NOW()
              WHERE "id" = ${item.variantId}
                AND "workspaceId" = ${workspaceId}
                AND ("stockQuantity" - "reservedQuantity") >= ${item.quantity}
            `;

            if (count === 0) {
              const variant = await tx.productVariant.findFirst({
                where: { id: item.variantId, workspaceId },
              });
              const currentAvailable =
                (variant?.stockQuantity ?? 0) - (variant?.reservedQuantity ?? 0);
              throw new ConflictException({
                code: 'INSUFFICIENT_STOCK',
                message: `Insufficient available stock for '${item.productName}' (${item.sku})`,
                details: {
                  variantId: item.variantId,
                  sku: item.sku,
                  requestedQuantity: item.quantity,
                  availableStock: Math.max(0, currentAvailable),
                },
              });
            }

            const currentVariant = await tx.productVariant.findFirstOrThrow({
              where: { id: item.variantId, workspaceId },
            });

            await tx.inventoryTransaction.create({
              data: {
                workspaceId,
                variantId: item.variantId,
                orderId: order.id,
                type: InventoryTransactionType.RESERVATION,
                quantity: item.quantity,
                previousStock: currentVariant.stockQuantity,
                newStock: currentVariant.stockQuantity,
                previousReserved: currentVariant.reservedQuantity - item.quantity,
                newReserved: currentVariant.reservedQuantity,
                reason: `Reserved on partial payment for Order #${order.displayId} (${order.orderNumber})`,
                performedByUserId: userId || null,
              },
            });

            inventoryUpdateEvents.push({
              workspaceId,
              variantId: item.variantId,
              sku: currentVariant.sku,
              previousStock: currentVariant.stockQuantity,
              newStock: currentVariant.stockQuantity,
              previousReserved: currentVariant.reservedQuantity - item.quantity,
              newReserved: currentVariant.reservedQuantity,
              availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
              reason: `Reserved on partial payment for Order #${order.displayId}`,
            });
          }
        }

        // Update order status to PARTIALLY_PAID (keep CONFIRMED status, do NOT mark PAID)
        await tx.order.updateMany({
          where: { id: order.id, workspaceId },
          data: {
            paidAmount: totalPaid,
            paymentStatus: PaymentStatus.PARTIALLY_PAID,
            status: OrderStatus.CONFIRMED,
            confirmedAt: order.confirmedAt || new Date(),
          },
        });
      }

      const updated = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: { items: true, shippingAddress: true, paymentTransactions: true },
      });

      const formatted = this.formatOrder(updated);

      // 4. Post-commit hooks: Realtime broadcasts
      ctx.addPostCommitHook(() => {
        for (const ev of inventoryUpdateEvents) {
          this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
        }

        if (isFullyPaid) {
          this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
            workspaceId,
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            displayId: updated.displayId,
            conversationId: updated.conversationId,
            paidAmount: totalPaid,
            paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
            transactionCode: dto.transactionCode || null,
            order: formatted,
          });
        } else {
          this.eventEmitter.emit(DomainEvent.ORDER_PARTIALLY_PAID, {
            workspaceId,
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            displayId: updated.displayId,
            conversationId: updated.conversationId,
            paidAmount: totalPaid,
            totalAmount: orderTotal,
            remainingAmount: Math.max(0, orderTotal - totalPaid),
            paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
            transactionCode: dto.transactionCode || null,
            order: formatted,
          });
        }
      });

      return formatted;
    });
  }

  /**
   * Cancels an order with atomic status guard.
   * Releases reserved stock back to available inventory if previously CONFIRMED.
   */
  async cancelOrder(
    workspaceId: string,
    orderId: string,
    dto: CancelOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 1. Fetch current order
      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, shippingAddress: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CONFIRMED) {
        throw new ConflictException({
          code: 'ORDER_NOT_CANCELLABLE',
          message: `Cannot cancel order in status '${order.status}'. Only DRAFT and CONFIRMED orders can be cancelled.`,
        });
      }

      const wasConfirmed = order.status === OrderStatus.CONFIRMED;

      // 2. Transition order status to CANCELLED
      await tx.order.updateMany({
        where: { id: orderId, workspaceId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.cancelReason,
        },
      });

      // 3. If order was CONFIRMED, release reserved inventory
      const inventoryUpdateEvents: any[] = [];
      if (wasConfirmed && order.items) {
        // Deterministic sorting by variantId to prevent 40P01 deadlocks
        const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

        for (const item of sortedItems) {
          // Atomically decrement reservedQuantity
          await tx.$executeRaw`
            UPDATE "product_variants"
            SET 
              "reservedQuantity" = GREATEST(0, "reservedQuantity" - ${item.quantity}),
              "updatedAt" = NOW()
            WHERE "id" = ${item.variantId}
              AND "workspaceId" = ${workspaceId}
          `;

          const variant = await tx.productVariant.findFirstOrThrow({
            where: { id: item.variantId, workspaceId },
          });

          const currentReserved = variant.reservedQuantity;

          await tx.inventoryTransaction.create({
            data: {
              workspaceId,
              variantId: item.variantId,
              orderId: order.id,
              type: InventoryTransactionType.RELEASE_RESERVATION,
              quantity: item.quantity,
              previousStock: variant.stockQuantity,
              newStock: variant.stockQuantity,
              previousReserved: currentReserved + item.quantity,
              newReserved: currentReserved,
              reason: `Released reservation on order cancellation #${order.displayId}: ${dto.cancelReason}`,
              performedByUserId: userId || null,
            },
          });

          inventoryUpdateEvents.push({
            workspaceId,
            variantId: item.variantId,
            sku: variant.sku,
            previousStock: variant.stockQuantity,
            newStock: variant.stockQuantity,
            previousReserved: currentReserved + item.quantity,
            newReserved: currentReserved,
            availableStock: variant.stockQuantity - currentReserved,
            reason: `Reservation released on order cancellation #${order.displayId}`,
          });
        }
      }

      const updated = await tx.order.findFirstOrThrow({
        where: { id: orderId, workspaceId },
        include: { items: true, shippingAddress: true, paymentTransactions: true },
      });

      const formatted = this.formatOrder(updated);

      // 4. Post-commit hook: emit DomainEvent.ORDER_CANCELLED and INVENTORY_UPDATED
      ctx.addPostCommitHook(() => {
        for (const ev of inventoryUpdateEvents) {
          this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
        }

        this.eventEmitter.emit(DomainEvent.ORDER_CANCELLED, {
          workspaceId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          displayId: updated.displayId,
          conversationId: updated.conversationId,
          cancelReason: dto.cancelReason,
          releasedStock: wasConfirmed,
          order: formatted,
        });
      });

      return formatted;
    });
  }

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
        { shippingAddress: { recipientName: { contains: query.search, mode: 'insensitive' } } },
        { shippingAddress: { phoneNumber: { contains: query.search, mode: 'insensitive' } } },
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
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
        },
      }),
    ]);

    const items = orders.map((o: any) => this.formatOrder(o));

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
        shippingAddress: true,
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

    return this.formatOrder(order);
  }

  /**
   * Retrieves data needed to print a thermal shipping label (K80 / K58).
   */
  async getShippingLabelData(workspaceId: string, orderId: string): Promise<ShippingLabelDataDto> {
    const client = this.prisma.getClient();
    const order = await client.order.findFirst({
      where: { id: orderId, workspaceId },
      include: {
        items: true,
        shippingAddress: true,
        contact: true,
        workspace: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found in this workspace',
        details: { orderId, workspaceId },
      });
    }

    const isPaid = order.paymentStatus === PaymentStatus.PAID;
    const totalAmount = Number(order.totalAmount);
    const paidAmount = Number(order.paidAmount);
    const codAmount = isPaid ? 0 : Math.max(0, totalAmount - paidAmount);

    const trackingCode = order.shippingAddress?.trackingCode || `INTERNAL-${order.displayId}`;

    const carrier =
      (order.shippingAddress?.shippingCarrier as CarrierProvider) || CarrierProvider.CUSTOM;

    const totalWeightInGrams =
      order.items.reduce((sum: number, it: any) => sum + it.quantity * 250, 0) || 500;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      displayId: order.displayId,
      trackingCode,
      carrier,
      sender: {
        name: order.workspace?.name || 'Cửa hàng',
        phone: '1900 6868',
        address: 'Kho hàng trung tâm',
        province: 'Hà Nội',
        district: 'Hoàng Mai',
        ward: 'Hoàng Văn Thụ',
      },
      recipient: {
        name: order.shippingAddress?.recipientName || order.contact?.name || 'Khách hàng',
        phone: order.shippingAddress?.phoneNumber || order.contact?.phoneNumber || '',
        address: order.shippingAddress?.streetAddress || 'Địa chỉ nhận hàng',
        province: order.shippingAddress?.province || 'Hà Nội',
        district: order.shippingAddress?.district || 'Hoàng Mai',
        ward: order.shippingAddress?.ward || 'Hoàng Văn Thụ',
      },
      codAmount,
      isPaid,
      items: (order.items || []).map((it: any) => ({
        productName: it.productName,
        variantName: it.variantName,
        sku: it.sku,
        quantity: it.quantity,
        price: Number(it.unitPrice),
      })),
      totalWeightInGrams,
      shippingNotes: order.shippingAddress?.shippingNotes || order.customerNotes,
      createdAt: order.createdAt,
    };
  }

  /**
   * Helper to format raw database Order into typed OrderResponseDto.
   */
  private formatOrder(order: any): OrderResponseDto {
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

    let shippingAddress: ShippingAddressResponseDto | null = null;
    if (order.shippingAddress) {
      const sa = order.shippingAddress;
      shippingAddress = {
        id: sa.id,
        workspaceId: sa.workspaceId,
        orderId: sa.orderId,
        contactId: sa.contactId,
        recipientName: sa.recipientName,
        phoneNumber: sa.phoneNumber,
        carrierNetwork: sa.carrierNetwork,
        streetAddress: sa.streetAddress,
        ward: sa.ward,
        district: sa.district,
        province: sa.province,
        country: sa.country,
        postalCode: sa.postalCode,
        shippingCarrier: sa.shippingCarrier,
        trackingCode: sa.trackingCode,
        shippingNotes: sa.shippingNotes,
        carrierMetadata: sa.carrierMetadata || {},
        createdAt: sa.createdAt,
        updatedAt: sa.updatedAt,
      };
    }

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
      items,
      shippingAddress,
      paymentTransactions: order.paymentTransactions || [],
      inventoryTransactions: order.inventoryTransactions || [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
