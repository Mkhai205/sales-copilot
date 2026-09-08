import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import {
  CarrierProvider,
  type CarrierRateQuoteDto,
  type CarrierQuoteResultDto,
  type ShipmentResultDto,
  type TrackingStatusDto,
} from '@sales-copilot/shared-contracts';
import { CreateShipmentInput, ShippingCarrierAdapter } from '../shipping.interface';

@Injectable()
export class GhnCarrierAdapter implements ShippingCarrierAdapter {
  readonly carrier = CarrierProvider.GHN;
  private readonly logger = new Logger(GhnCarrierAdapter.name);

  private getApiUrl(credentials?: Record<string, any>): string {
    return credentials?.isSandbox
      ? 'https://dev-online-gateway.ghn.vn/shiip/public-api/v2'
      : 'https://online-gateway.ghn.vn/shiip/public-api/v2';
  }

  private getHeaders(credentials?: Record<string, any>): HeadersInit {
    const token = credentials?.apiToken || process.env.GHN_API_TOKEN || '';
    const shopId = credentials?.shopId || process.env.GHN_SHOP_ID || '';
    return {
      token,
      ShopId: String(shopId),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async calculateFee(
    input: CarrierRateQuoteDto,
    credentials?: Record<string, any>,
  ): Promise<CarrierQuoteResultDto> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHN_API_TOKEN;

    if (!token) {
      const isSameProvince =
        input.senderProvince.toLowerCase() === input.recipientProvince.toLowerCase();
      const fee = isSameProvince ? 25000 : 38000;
      const insuredValue = input.insuredValue ?? 0;
      return {
        carrier: CarrierProvider.GHN,
        serviceName: 'GHN Tiêu Chuẩn',
        fee,
        estimatedDeliveryDays: isSameProvince ? 1 : 3,
        insuranceFee: insuredValue > 1000000 ? Math.round(insuredValue * 0.005) : 0,
      };
    }

    try {
      const payload = {
        from_district_id: Number(credentials?.fromDistrictId || 1442), // Default sender district
        to_district_id: Number(credentials?.toDistrictId || 1450),
        weight: Number(input.weightInGrams),
        length: 20,
        width: 15,
        height: 10,
        service_type_id: 2,
        insurance_value: Number(input.insuredValue || 0),
      };

      const response = await fetch(`${baseUrl}/shipping-order/fee`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const json = await response.json();
      if (json.code !== 200) {
        throw new Error(json.message || 'GHN API fee calculation error');
      }

      const data = json.data || {};
      return {
        carrier: CarrierProvider.GHN,
        serviceName: 'GHN Chuẩn',
        fee: Number(data.total || 32000),
        estimatedDeliveryDays: 2,
        insuranceFee: Number(data.insurance_fee || 0),
      };
    } catch (error: any) {
      this.logger.warn(`Failed to query GHN fee: ${error.message}. Returning fallback.`);
      const isSameProvince =
        input.senderProvince.toLowerCase() === input.recipientProvince.toLowerCase();
      return {
        carrier: CarrierProvider.GHN,
        serviceName: 'GHN Tiêu Chuẩn (Ước tính)',
        fee: isSameProvince ? 26000 : 40000,
        estimatedDeliveryDays: isSameProvince ? 1 : 3,
        insuranceFee: 0,
      };
    }
  }

  async createShipment(
    input: CreateShipmentInput,
    credentials?: Record<string, any>,
  ): Promise<ShipmentResultDto> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHN_API_TOKEN;

    if (!token) {
      // Offline / staging simulation
      const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
      const trackingCode = `GHN${Date.now().toString().slice(-6)}${randomSuffix}`;
      return {
        trackingCode,
        carrier: CarrierProvider.GHN,
        fee: 32000,
        rawResponse: {
          code: 200,
          mock: true,
          data: { order_code: trackingCode, total_fee: 32000 },
        },
      };
    }

    try {
      const payload = {
        payment_type_id: 2, // 2: Buyer pays shipping/COD
        note: input.notes || 'Cho xem hang khong thu',
        required_note: 'CHOXEMHANGKHONGTHU',
        to_name: input.recipientName,
        to_phone: input.recipientPhone,
        to_address: input.recipientAddress,
        to_ward_code: credentials?.toWardCode || '20311',
        to_district_id: Number(credentials?.toDistrictId || 1444),
        cod_amount: input.codAmount,
        content: `Đơn hàng #${input.orderDisplayId || input.orderNumber}`,
        weight: input.totalWeightInGrams || 500,
        length: 20,
        width: 15,
        height: 10,
        service_type_id: 2,
        items: input.items.map(it => ({
          name: it.productName,
          code: it.sku || '',
          quantity: it.quantity,
          price: it.price,
        })),
      };

      const response = await fetch(`${baseUrl}/shipping-order/create`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const json = await response.json();
      if (json.code !== 200) {
        throw new BadGatewayException({
          code: 'CARRIER_API_ERROR',
          message: json.message || 'GHN API failed to create order',
          details: json,
        });
      }

      const trackingCode = json.data?.order_code;
      return {
        trackingCode,
        carrier: CarrierProvider.GHN,
        fee: Number(json.data?.total_fee || 32000),
        rawResponse: json,
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException({
        code: 'CARRIER_API_ERROR',
        message: `GHN API connection failed: ${error.message}`,
      });
    }
  }

  async trackShipment(
    trackingCode: string,
    credentials?: Record<string, any>,
  ): Promise<TrackingStatusDto> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHN_API_TOKEN;

    if (!token) {
      return {
        trackingCode,
        carrier: CarrierProvider.GHN,
        status: 'READY_TO_PICK',
        statusDescription: 'Chờ lấy hàng từ người gửi',
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status: 'READY_TO_PICK',
            description: 'Đơn hàng đã được tạo trên hệ thống GHN',
            location: 'Bưu cục GHN',
          },
        ],
      };
    }

    try {
      const response = await fetch(`${baseUrl}/shipping-order/detail`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        body: JSON.stringify({ order_code: trackingCode }),
        signal: AbortSignal.timeout(5000),
      });

      const json = await response.json();
      const data = json.data || {};
      return {
        trackingCode,
        carrier: CarrierProvider.GHN,
        status: data.status || 'IN_TRANSIT',
        statusDescription: data.status_description || 'Đang luân chuyển bưu kiện',
        timeline: (data.log || []).map((l: any) => ({
          timestamp: l.updated_date || new Date().toISOString(),
          status: l.status,
          description: l.status,
          location: l.station_name,
        })),
      };
    } catch (error: any) {
      return {
        trackingCode,
        carrier: CarrierProvider.GHN,
        status: 'IN_TRANSIT',
        statusDescription: `Đang tra cứu: ${error.message}`,
        timeline: [],
      };
    }
  }

  async cancelShipment(trackingCode: string, credentials?: Record<string, any>): Promise<boolean> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHN_API_TOKEN;

    if (!token) return true;

    try {
      const response = await fetch(`${baseUrl}/shipping-order/cancel`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        body: JSON.stringify({ order_codes: [trackingCode] }),
        signal: AbortSignal.timeout(5000),
      });
      const json = await response.json();
      return json.code === 200;
    } catch (_e) {
      return false;
    }
  }
}
