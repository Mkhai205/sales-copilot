import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CarrierProvider,
  DomainEvent,
  FulfillmentStatus,
  InventoryTransactionType,
  OrderStatus,
  PaymentStatus,
  type CarrierQuoteResultDto,
  type CarrierRateQuoteDto,
  type DispatchOrderDto,
  type OrderResponseDto,
  type ShippingAddressResponseDto,
  type TrackingStatusDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ChannelCredentialService } from '../../inboxes/channel-credential.service';
import { CustomCarrierAdapter } from './adapters/custom.adapter';
import { GhnCarrierAdapter } from './adapters/ghn.adapter';
import { GhtkCarrierAdapter } from './adapters/ghtk.adapter';
import { ShippingCarrierAdapter } from './shipping.interface';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly credentialService: ChannelCredentialService,
    private readonly customAdapter: CustomCarrierAdapter,
    private readonly ghtkAdapter: GhtkCarrierAdapter,
    private readonly ghnAdapter: GhnCarrierAdapter,
  ) {}

  /**
   * Resolves appropriate carrier adapter based on provider enum.
   */
  getAdapter(carrier: CarrierProvider | string): ShippingCarrierAdapter {
    switch (carrier) {
      case CarrierProvider.GHTK:
        return this.ghtkAdapter;
      case CarrierProvider.GHN:
        return this.ghnAdapter;
      case CarrierProvider.CUSTOM:
      default:
        return this.customAdapter;
    }
  }

  /**
   * Resolves and decrypts carrier credentials for a workspace if configured.
   */
  private async getCarrierCredentials(
    workspaceId: string,
    carrier: CarrierProvider | string,
  ): Promise<Record<string, any>> {
    try {
      const workspace = await this.prisma.client.workspace.findFirst({
        where: { id: workspaceId },
      });

      if (!workspace || !workspace.settings) {
        return {};
      }

      const settings = workspace.settings as Record<string, any>;
      const carrierConfig = settings.shippingSettings?.[carrier];

      if (!carrierConfig) {
        return {};
      }

      // If credentials are encrypted string (iv:authTag:ciphertext)
      if (typeof carrierConfig === 'string' && carrierConfig.includes(':')) {
        return this.credentialService.decrypt(carrierConfig);
      }

      if (typeof carrierConfig === 'object') {
        return carrierConfig;
      }

      return {};
    } catch (err: any) {
      this.logger.warn(
        `Could not resolve credentials for carrier ${carrier} in workspace ${workspaceId}: ${err.message}`,
      );
      return {};
    }
  }

  /**
   * Calculates shipping rate quote from carrier.
   */
  async calculateFee(
    workspaceId: string,
    input: CarrierRateQuoteDto,
  ): Promise<CarrierQuoteResultDto> {
    const adapter = this.getAdapter(input.carrier);
    const credentials = await this.getCarrierCredentials(workspaceId, input.carrier);
    return adapter.calculateFee(input, credentials);
  }

  /**
   * Dispatches an order: calls carrier API to generate waybill and updates order status.
   *
   * Inventory Anti-Double-Commit Invariant:
   * - If order was already PAID (prepaid via VietQR), stock was ALREADY deducted in M3.
   *   Do NOT deduct stock again.
   * - If order is COD (not PAID) and CONFIRMED:
   *   Stock was reserved. Deduct stockQuantity, release reservedQuantity (COMMIT_SALE).
   * - If order is DRAFT:
   *   Throw ORDER_NOT_CONFIRMED.
   */
  async dispatchOrder(
    workspaceId: string,
    orderId: string,
    dto: DispatchOrderDto,
    userId?: string,
  ): Promise<OrderResponseDto> {
    // 1. Fetch order strictly scoped to workspaceId
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, workspaceId },
      include: {
        items: true,
        shippingAddress: true,
        contact: true,
      },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found in this workspace',
        details: { orderId, workspaceId },
      });
    }

    // 2. Status validation
    if (order.status === OrderStatus.DRAFT) {
      throw new BadRequestException({
        code: 'ORDER_NOT_CONFIRMED',
        message: 'Only confirmed or paid orders can be dispatched for shipping',
        details: { status: order.status },
      });
    }

    if (
      order.status === OrderStatus.SHIPPING ||
      order.status === OrderStatus.COMPLETED ||
      order.status === OrderStatus.CANCELLED
    ) {
      throw new BadRequestException({
        code: 'INVALID_ORDER_STATUS',
        message: `Cannot dispatch order with current status: ${order.status}`,
        details: { status: order.status },
      });
    }

    const carrier = dto.carrier || order.shippingAddress?.shippingCarrier || CarrierProvider.CUSTOM;
    const adapter = this.getAdapter(carrier);
    const credentials = await this.getCarrierCredentials(workspaceId, carrier);

    // 3. Determine COD amount: if already prepaid (PAID), COD amount is 0
    const isPrepaid = order.paymentStatus === PaymentStatus.PAID;
    const totalAmountNum = Number(order.totalAmount);
    const paidAmountNum = Number(order.paidAmount);
    const remainingAmount = Math.max(0, totalAmountNum - paidAmountNum);
    const codAmount = isPrepaid ? 0 : dto.codAmount !== undefined ? dto.codAmount : remainingAmount;

    // 4. Calculate total weight in grams
    const totalWeightInGrams =
      order.items.reduce((sum: number, it: any) => sum + it.quantity * 250, 0) || 500;

    // 5. Call 3PL carrier adapter to create shipment
    const recipientName =
      order.shippingAddress?.recipientName || order.contact?.name || 'Khách hàng';
    const recipientPhone =
      order.shippingAddress?.phoneNumber || order.contact?.phoneNumber || '0988000000';
    const recipientAddress = order.shippingAddress?.streetAddress || 'Địa chỉ nhận hàng';
    const province = order.shippingAddress?.province || 'Hà Nội';
    const district = order.shippingAddress?.district || 'Hoàng Mai';
    const ward = order.shippingAddress?.ward || 'Tương Mai';

    const shipmentResult = await adapter.createShipment(
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderDisplayId: order.displayId,
        recipientName,
        recipientPhone,
        recipientAddress,
        province,
        district,
        ward,
        codAmount,
        totalWeightInGrams,
        notes: dto.note || order.shippingAddress?.shippingNotes || order.customerNotes,
        pickShift: dto.pickShift,
        items: order.items.map((it: any) => ({
          productName: it.productName,
          variantName: it.variantName,
          sku: it.sku,
          quantity: it.quantity,
          price: Number(it.unitPrice),
        })),
      },
      credentials,
    );

    // 6. Execute atomic transaction for database state updates
    return this.prisma.runInTransaction(async ctx => {
      const tx = ctx.tx;

      // 6a. Update or create ShippingAddress record
      if (order.shippingAddress) {
        await tx.shippingAddress.update({
          where: { id: order.shippingAddress.id },
          data: {
            trackingCode: shipmentResult.trackingCode,
            shippingCarrier: carrier,
            carrierMetadata: (shipmentResult.rawResponse || {}) as any,
            shippingNotes: dto.note || order.shippingAddress.shippingNotes,
          },
        });
      } else {
        await tx.shippingAddress.create({
          data: {
            workspaceId,
            orderId: order.id,
            contactId: order.contactId,
            recipientName,
            phoneNumber: recipientPhone,
            streetAddress: recipientAddress,
            ward,
            district,
            province,
            shippingCarrier: carrier,
            trackingCode: shipmentResult.trackingCode,
            carrierMetadata: (shipmentResult.rawResponse || {}) as any,
            shippingNotes: dto.note || null,
          },
        });
      }

      // 6b. Update order status to SHIPPING and fulfillmentStatus to SHIPPED
      const updatedOrderDb = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.SHIPPING,
          fulfillmentStatus: FulfillmentStatus.SHIPPED,
          shippedAt: new Date(),
        },
        include: {
          items: true,
          shippingAddress: true,
          paymentTransactions: true,
          inventoryTransactions: true,
        },
      });

      // 6c. Inventory Deductions (Anti-Double-Commit Invariant)
      const inventoryUpdateEvents: Array<any> = [];

      if (isPrepaid) {
        // PREPAID ORDER: stock was already committed in M3 on payment confirmation.
        // DO NOT deduct stock a second time.
        this.logger.log(
          `Order #${order.displayId} is PAID. Skipping inventory deduction on dispatch.`,
        );
      } else {
        // COD ORDER: stock was reserved in CONFIRMED. Now commit sale (deduct physical stock & release reservation).
        const sortedItems = [...order.items].sort((a, b) => a.variantId.localeCompare(b.variantId));

        for (const item of sortedItems) {
          const count = await tx.$executeRaw`
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

          if (count === 0) {
            const variant = await tx.productVariant.findFirst({
              where: { id: item.variantId, workspaceId },
            });
            throw new ConflictException({
              code: 'INSUFFICIENT_RESERVED_STOCK',
              message: `Insufficient reserved stock to commit sale for '${item.productName}' (${item.sku})`,
              details: {
                variantId: item.variantId,
                sku: item.sku,
                requestedQuantity: item.quantity,
                reservedQuantity: variant?.reservedQuantity ?? 0,
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
              previousReserved: currentVariant.reservedQuantity + item.quantity,
              newReserved: currentVariant.reservedQuantity,
              reason: `Commit sale on dispatch for Order #${order.displayId} (${order.orderNumber})`,
              performedByUserId: userId || null,
            },
          });

          inventoryUpdateEvents.push({
            workspaceId,
            variantId: item.variantId,
            sku: currentVariant.sku,
            previousStock: currentVariant.stockQuantity + item.quantity,
            newStock: currentVariant.stockQuantity,
            previousReserved: currentVariant.reservedQuantity + item.quantity,
            newReserved: currentVariant.reservedQuantity,
            availableStock: currentVariant.stockQuantity - currentVariant.reservedQuantity,
            reason: `Commit sale on dispatch for Order #${order.displayId}`,
          });
        }
      }

      const formatted = this.formatOrder(updatedOrderDb);

      // 7. Post-commit hooks
      ctx.addPostCommitHook(() => {
        for (const ev of inventoryUpdateEvents) {
          this.eventEmitter.emit(DomainEvent.INVENTORY_UPDATED, ev);
        }

        this.eventEmitter.emit(DomainEvent.ORDER_SHIPPED, {
          workspaceId,
          orderId: order.id,
          orderNumber: order.orderNumber,
          displayId: order.displayId,
          conversationId: order.conversationId,
          trackingCode: shipmentResult.trackingCode,
          shippingCarrier: carrier,
          shippedAt: updatedOrderDb.shippedAt,
          order: formatted,
        });
      });

      return formatted;
    });
  }

  /**
   * Tracks order delivery progress via 3PL carrier.
   */
  async trackOrder(workspaceId: string, orderId: string): Promise<TrackingStatusDto> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, workspaceId },
      include: { shippingAddress: true },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found in this workspace',
        details: { orderId, workspaceId },
      });
    }

    const trackingCode = order.shippingAddress?.trackingCode;
    if (!trackingCode) {
      throw new BadRequestException({
        code: 'ORDER_NOT_SHIPPED',
        message: 'Order has not been dispatched or has no tracking code',
        details: { orderId },
      });
    }

    const carrier = order.shippingAddress?.shippingCarrier || CarrierProvider.CUSTOM;
    const adapter = this.getAdapter(carrier);
    const credentials = await this.getCarrierCredentials(workspaceId, carrier);

    return adapter.trackShipment(trackingCode, credentials);
  }

  /**
   * Cancels shipment with carrier.
   */
  async cancelOrderShipment(workspaceId: string, orderId: string): Promise<boolean> {
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, workspaceId },
      include: { shippingAddress: true },
    });

    if (!order || !order.shippingAddress?.trackingCode) {
      return false;
    }

    const carrier = order.shippingAddress.shippingCarrier;
    const adapter = this.getAdapter(carrier);
    const credentials = await this.getCarrierCredentials(workspaceId, carrier);

    return adapter.cancelShipment(order.shippingAddress.trackingCode, credentials);
  }

  /**
   * Helper to format Prisma Order model into OrderResponseDto
   */
  private formatOrder(order: any): OrderResponseDto {
    const items = (order.items || []).map((item: any) => ({
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
