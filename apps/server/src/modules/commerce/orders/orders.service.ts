import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  DiscountType,
  DomainEvent,
  FulfillmentStatus,
  OrderStatus,
  PaymentGateway,
  PaymentMethod,
  PaymentStatus,
  PaymentTransactionStatus,
  type CancelOrderDto,
  type CompleteOrderDto,
  type CreateOrderDto,
  type ListOrdersQueryOutput,
  type ManualPayOrderDto,
  type OrderItemResponseDto,
  type OrderResponseDto,
  type PaginationMeta,
  type UpdateOrderDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { InventoryLedgerService } from '../inventory/inventory-ledger.service';
import { MessagesService } from '../../omnichannel/messages/messages.service';
import { RedisService } from '../../../infrastructure/redis/redis.service';
import { calculateLineItemTotals, calculateOrderFinancialTotals } from './orders-calculator';
import {
  assertCanCancel,
  assertCanComplete,
  assertCanConfirm,
  assertCanUpdate,
} from './order-status-guard';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly inventoryLedgerService: InventoryLedgerService,
    private readonly messagesService: MessagesService,
    @Optional() private readonly redisService?: RedisService,
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

        const itemCalc = calculateLineItemTotals({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
        });

        subtotal += itemCalc.subtotal;

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

      // 4. Calculate Financials
      const financialTotals = calculateOrderFinancialTotals({
        subtotal,
        discountType: dto.discountType,
        discountAmount: dto.discountAmount,
        shippingFee: dto.shippingFee,
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

        await this.inventoryLedgerService.reserveStock({
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

      const formatted = this.formatOrder(order);

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

          const itemCalc = calculateLineItemTotals({
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            discountAmount: item.discountAmount,
          });

          subtotal += itemCalc.subtotal;

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

      // 3. Recalculate Financials
      const financialTotals = calculateOrderFinancialTotals({
        subtotal,
        discountType: dto.discountType !== undefined ? dto.discountType : order.discountType,
        discountAmount: dto.discountAmount,
        shippingFee: dto.shippingFee !== undefined ? dto.shippingFee : Number(order.shippingFee),
        existingDiscountAmount: Number(order.discountAmount),
        existingSubtotal: Number(order.subtotal),
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
        include: { items: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanConfirm(order);

      // 2. Atomically reserve inventory for line items via InventoryLedgerService (Model A Anti-Overselling)
      const reserveItems = order.items.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku,
      }));

      await this.inventoryLedgerService.reserveStock({
        workspaceId,
        items: reserveItems,
        orderId: order.id,
        orderDisplayId: order.displayId,
        orderNumber: order.orderNumber,
        userId,
        tx,
      });

      const reservedItemsSummary = reserveItems.map(item => ({
        variantId: item.variantId,
        quantity: item.quantity,
      }));

      // 3. Transition order status to CONFIRMED
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
    const lockKey = `order:payment:${orderId}`;
    const lockToken = this.redisService
      ? await this.redisService.acquireLock(lockKey, 10000)
      : null;
    if (this.redisService && !lockToken) {
      throw new ConflictException({
        code: 'PAYMENT_IN_PROGRESS',
        message: 'A payment transaction is currently being processed for this order',
      });
    }

    try {
      return await this.prisma.runInTransaction(async ctx => {
        const tx = ctx.tx;

        const order = await tx.order.findFirst({
          where: { id: orderId, workspaceId },
          include: { items: true, paymentTransactions: true },
        });

        if (!order) {
          throw new NotFoundException({
            code: 'ORDER_NOT_FOUND',
            message: 'Order not found in this workspace',
            details: { orderId, workspaceId },
          });
        }

        // 1. Idempotency guard: reject duplicate manual payment with deterministic key
        const idempotencyKey = dto.transactionCode
          ? `manual:${order.id}:${dto.transactionCode}`
          : `manual:${order.id}`;
        const existingTx = await tx.paymentTransaction.findFirst({
          where: { workspaceId, idempotencyKey },
        });

        if (existingTx) {
          throw new ConflictException({
            code: 'PAYMENT_ALREADY_PROCESSED',
            message: 'Payment for this order has already been recorded manually',
          });
        }

        if (order.status !== OrderStatus.DRAFT && order.status !== OrderStatus.CONFIRMED) {
          throw new BadRequestException({
            code: 'INVALID_STATUS_FOR_PAYMENT',
            message: `Cannot pay order in '${order.status}' status. Must be DRAFT or CONFIRMED.`,
          });
        }

        const isPreviouslyConfirmed = order.status === OrderStatus.CONFIRMED;
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

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

        if (isFullyPaid) {
          // Full payment: Commit inventory sale via InventoryLedgerService
          const commitItems = (order.items || []).map(item => ({
            variantId: item.variantId,
            quantity: item.quantity,
            productName: item.productName,
            variantName: item.variantName,
            sku: item.sku,
          }));

          await this.inventoryLedgerService.commitStock({
            workspaceId,
            items: commitItems,
            orderId: order.id,
            orderDisplayId: order.displayId,
            orderNumber: order.orderNumber,
            isPreviouslyReserved: isPreviouslyConfirmed,
            userId,
            tx,
          });

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
            const reserveItems = (order.items || []).map(item => ({
              variantId: item.variantId,
              quantity: item.quantity,
              productName: item.productName,
              variantName: item.variantName,
              sku: item.sku,
            }));

            await this.inventoryLedgerService.reserveStock({
              workspaceId,
              items: reserveItems,
              orderId: order.id,
              orderDisplayId: order.displayId,
              orderNumber: order.orderNumber,
              userId,
              reason: `Reserved on partial payment for Order #${order.displayId} (${order.orderNumber})`,
              tx,
            });
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
          include: { items: true, paymentTransactions: true },
        });

        const formatted = this.formatOrder(updated);

        // 4. Post-commit hooks: Realtime broadcasts
        ctx.addPostCommitHook(() => {
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
    } finally {
      if (this.redisService && lockToken) {
        await this.redisService.releaseLock(lockKey, lockToken);
      }
    }
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
        include: { items: true, paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanCancel(order);

      const wasConfirmed = order.status === OrderStatus.CONFIRMED;
      const wasPaidOrShipped =
        order.status === OrderStatus.PAID || order.status === OrderStatus.SHIPPING;
      const paidAmount = Number(order.paidAmount || 0);

      // Refund tracking: Record refund payment transaction if paidAmount > 0
      if (paidAmount > 0) {
        const originalMethod =
          order.paymentTransactions?.[0]?.paymentMethod ||
          ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
          PaymentMethod.OTHER;

        await tx.paymentTransaction.create({
          data: {
            workspaceId,
            orderId: order.id,
            paymentMethod: originalMethod,
            gateway: PaymentGateway.MANUAL,
            amount: -paidAmount,
            currency: 'VND',
            status: PaymentTransactionStatus.SUCCESS,
            transactionCode: `REFUND-${order.displayId}`,
            transferContent: `Hoàn tiền đơn hủy #${order.displayId}: ${dto.cancelReason}`,
            idempotencyKey: `refund:${order.id}`,
            paidAt: new Date(),
          },
        });
      }

      // 2. Transition order status to CANCELLED
      await tx.order.updateMany({
        where: { id: orderId, workspaceId },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelReason: dto.cancelReason,
          ...(paidAmount > 0 ? { paymentStatus: PaymentStatus.REFUNDED } : {}),
        },
      });

      // 3. Release or restock inventory
      if (wasConfirmed && order.items && order.items.length > 0) {
        const releaseItems = order.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          sku: item.sku,
        }));

        await this.inventoryLedgerService.releaseStock({
          workspaceId,
          items: releaseItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          userId,
          reason: `Released reservation on order cancellation #${order.displayId}: ${dto.cancelReason}`,
          tx,
        });
      } else if (wasPaidOrShipped && order.items && order.items.length > 0) {
        const restockItems = order.items.map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
        }));

        await this.inventoryLedgerService.restockStock({
          workspaceId,
          items: restockItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          userId,
          reason: `Restocked physical inventory on cancellation of ${order.status} order #${order.displayId}: ${dto.cancelReason}`,
          tx,
        });
      }

      const updated = await tx.order.findFirstOrThrow({
        where: { id: orderId, workspaceId },
        include: { items: true, paymentTransactions: true },
      });

      const formatted = this.formatOrder(updated);

      // 4. Post-commit hook: emit DomainEvent.ORDER_CANCELLED
      ctx.addPostCommitHook(() => {
        this.eventEmitter.emit(DomainEvent.ORDER_CANCELLED, {
          workspaceId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          displayId: updated.displayId,
          conversationId: updated.conversationId,
          cancelReason: dto.cancelReason,
          releasedStock: wasConfirmed || wasPaidOrShipped,
          order: formatted,
        });
      });

      return formatted;
    });
  }

  /**
   * Completes an order (transitions from PAID, SHIPPING, or CONFIRMED to COMPLETED).
   * Automatically marks fulfillmentStatus as DELIVERED.
   * If the order is COD and not fully paid, automatically creates a MANUAL payment transaction,
   * setting paymentStatus to PAID and paidAmount to totalAmount.
   */
  async completeOrder(
    workspaceId: string,
    orderId: string,
    dto?: CompleteOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      const order = await tx.order.findFirst({
        where: { id: orderId, workspaceId },
        include: { items: true, paymentTransactions: true },
      });

      if (!order) {
        throw new NotFoundException({
          code: 'ORDER_NOT_FOUND',
          message: 'Order not found in this workspace',
          details: { orderId, workspaceId },
        });
      }

      assertCanComplete(order);

      const orderTotal = Number(order.totalAmount);
      const paidAmount = Number(order.paidAmount);
      const isFullyPaid = paidAmount >= orderTotal;

      // If order was CONFIRMED (not yet committed stock), commit stock now
      if (order.status === OrderStatus.CONFIRMED) {
        const commitItems = (order.items || []).map(item => ({
          variantId: item.variantId,
          quantity: item.quantity,
          productName: item.productName,
          variantName: item.variantName,
          sku: item.sku,
        }));

        await this.inventoryLedgerService.commitStock({
          workspaceId,
          items: commitItems,
          orderId: order.id,
          orderDisplayId: order.displayId,
          orderNumber: order.orderNumber,
          isPreviouslyReserved: true,
          userId,
          reason: `Commit stock upon order completion #${order.displayId}`,
          tx,
        });
      }

      let finalPaidAmount = paidAmount;
      let finalPaymentStatus = order.paymentStatus;
      let finalPaidAt = order.paidAt;

      // Auto-reconcile COD if not fully paid AND payment method is explicitly COD or CASH
      const orderPaymentMethod =
        (order as any).paymentMethod ||
        ((order.metadata as Record<string, any>)?.paymentMethod as PaymentMethod) ||
        (order.paymentTransactions?.[0]?.paymentMethod as PaymentMethod);

      let didAutoPayCod = false;
      let codTx: any = null;

      if (
        !isFullyPaid &&
        (orderPaymentMethod === PaymentMethod.COD || orderPaymentMethod === PaymentMethod.CASH)
      ) {
        const remaining = Math.max(0, orderTotal - paidAmount);
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const prefix = orderPaymentMethod === PaymentMethod.CASH ? 'CASH' : 'COD';
        const idempotencyKey = `cod:${order.id}`;

        const existingCodTx = await tx.paymentTransaction.findFirst({
          where: { workspaceId, idempotencyKey },
        });

        if (!existingCodTx) {
          codTx = await tx.paymentTransaction.create({
            data: {
              workspaceId,
              orderId: order.id,
              paymentMethod: orderPaymentMethod,
              gateway: PaymentGateway.MANUAL,
              amount: remaining,
              currency: 'VND',
              status: PaymentTransactionStatus.SUCCESS,
              transactionCode: `${prefix}-${dateStr}`,
              transferContent:
                dto?.notes || `Thu hộ ${prefix} khi giao thành công đơn #${order.displayId}`,
              idempotencyKey,
              paidAt: new Date(),
            },
          });

          didAutoPayCod = true;
          finalPaidAmount = orderTotal;
          finalPaymentStatus = PaymentStatus.PAID;
          finalPaidAt = new Date();
        }
      }

      const completedAt = new Date();

      await tx.order.updateMany({
        where: { id: order.id, workspaceId },
        data: {
          status: OrderStatus.COMPLETED,
          fulfillmentStatus: FulfillmentStatus.DELIVERED,
          completedAt,
          paidAmount: finalPaidAmount,
          paymentStatus: finalPaymentStatus,
          paidAt: finalPaidAt,
          internalNotes: dto?.notes
            ? order.internalNotes
              ? `${order.internalNotes}\n${dto.notes}`
              : dto.notes
            : order.internalNotes,
        },
      });

      const updated = await tx.order.findFirstOrThrow({
        where: { id: order.id, workspaceId },
        include: {
          items: true,
          paymentTransactions: true,
          inventoryTransactions: true,
        },
      });

      const formatted = this.formatOrder(updated);

      ctx.addPostCommitHook(() => {
        if (didAutoPayCod) {
          this.eventEmitter.emit(DomainEvent.ORDER_PAID, {
            workspaceId,
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            displayId: updated.displayId,
            conversationId: updated.conversationId,
            paidAmount: finalPaidAmount,
            paymentMethod: orderPaymentMethod,
            transactionCode: codTx?.transactionCode || null,
            order: formatted,
          });
        }

        this.eventEmitter.emit(DomainEvent.ORDER_COMPLETED, {
          workspaceId,
          orderId: updated.id,
          orderNumber: updated.orderNumber,
          displayId: updated.displayId,
          conversationId: updated.conversationId,
          completedAt,
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
        include: {
          items: true,
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
}
