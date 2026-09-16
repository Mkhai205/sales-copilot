import {
  CarrierProvider,
  type CarrierRateQuoteDto,
  type CarrierQuoteResultDto,
  type ShipmentResultDto,
  type TrackingStatusDto,
} from '@sales-copilot/shared-contracts';

export interface CreateShipmentInput {
  orderId: string;
  orderNumber: string;
  orderDisplayId: number;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  province: string;
  district: string;
  ward: string;
  codAmount: number;
  totalWeightInGrams: number;
  notes?: string | null;
  pickShift?: string | null;
  items: Array<{
    productName: string;
    variantName?: string | null;
    sku?: string | null;
    quantity: number;
    price: number;
    weightInGrams?: number;
  }>;
}

export interface ShippingCarrierAdapter {
  readonly carrier: CarrierProvider;

  calculateFee(
    input: CarrierRateQuoteDto,
    credentials?: Record<string, any>,
  ): Promise<CarrierQuoteResultDto>;

  createShipment(
    input: CreateShipmentInput,
    credentials?: Record<string, any>,
  ): Promise<ShipmentResultDto>;

  trackShipment(
    trackingCode: string,
    credentials?: Record<string, any>,
  ): Promise<TrackingStatusDto>;

  cancelShipment(trackingCode: string, credentials?: Record<string, any>): Promise<boolean>;
}
