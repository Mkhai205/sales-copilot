import { Injectable } from '@nestjs/common';
import {
  CarrierProvider,
  type CarrierRateQuoteDto,
  type CarrierQuoteResultDto,
  type ShipmentResultDto,
  type TrackingStatusDto,
} from '@sales-copilot/shared-contracts';
import { CreateShipmentInput, ShippingCarrierAdapter } from '../shipping.interface';

@Injectable()
export class CustomCarrierAdapter implements ShippingCarrierAdapter {
  readonly carrier = CarrierProvider.CUSTOM;

  async calculateFee(
    input: CarrierRateQuoteDto,
    _credentials?: Record<string, any>,
  ): Promise<CarrierQuoteResultDto> {
    const isSameProvince =
      input.senderProvince.toLowerCase() === input.recipientProvince.toLowerCase();
    const baseFee = isSameProvince ? 22000 : 35000;
    const weightFee =
      input.weightInGrams > 1000 ? Math.ceil((input.weightInGrams - 1000) / 500) * 5000 : 0;
    const fee = baseFee + weightFee;

    const insuredValue = input.insuredValue ?? 0;
    return {
      carrier: CarrierProvider.CUSTOM,
      serviceName: isSameProvince
        ? 'Giao hàng nội tỉnh tiêu chuẩn'
        : 'Giao hàng liên tỉnh tiêu chuẩn',
      fee,
      estimatedDeliveryDays: isSameProvince ? 1 : 3,
      insuranceFee: insuredValue > 1000000 ? Math.round(insuredValue * 0.005) : 0,
    };
  }

  async createShipment(
    input: CreateShipmentInput,
    _credentials?: Record<string, any>,
  ): Promise<ShipmentResultDto> {
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const displayId = input.orderDisplayId || '001';
    const trackingCode = `INTERNAL-${displayId}-${randomSuffix}`;

    return {
      trackingCode,
      carrier: CarrierProvider.CUSTOM,
      fee: 25000,
      rawResponse: {
        provider: 'CUSTOM',
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  async trackShipment(
    trackingCode: string,
    _credentials?: Record<string, any>,
  ): Promise<TrackingStatusDto> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    return {
      trackingCode,
      carrier: CarrierProvider.CUSTOM,
      status: 'IN_TRANSIT',
      statusDescription: 'Đang vận chuyển giao hàng',
      timeline: [
        {
          timestamp: twoHoursAgo.toISOString(),
          status: 'PICKED_UP',
          description: 'Đã lấy hàng từ người gửi',
          location: 'Kho trung tâm',
        },
        {
          timestamp: oneHourAgo.toISOString(),
          status: 'IN_TRANSIT',
          description: 'Đang luân chuyển trên đường',
          location: 'Bưu cục giao hàng',
        },
      ],
    };
  }

  async cancelShipment(
    _trackingCode: string,
    _credentials?: Record<string, any>,
  ): Promise<boolean> {
    return true;
  }
}
