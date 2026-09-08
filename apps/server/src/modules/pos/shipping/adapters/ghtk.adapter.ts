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
export class GhtkCarrierAdapter implements ShippingCarrierAdapter {
  readonly carrier = CarrierProvider.GHTK;
  private readonly logger = new Logger(GhtkCarrierAdapter.name);

  private getApiUrl(credentials?: Record<string, any>): string {
    return credentials?.isSandbox
      ? 'https://services-staging.giaohangtietkiem.vn'
      : 'https://services.giaohangtietkiem.vn';
  }

  private getHeaders(credentials?: Record<string, any>): HeadersInit {
    const token = credentials?.apiToken || process.env.GHTK_API_TOKEN || '';
    return {
      Token: token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async calculateFee(
    input: CarrierRateQuoteDto,
    credentials?: Record<string, any>,
  ): Promise<CarrierQuoteResultDto> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHTK_API_TOKEN;

    if (!token) {
      // Fallback estimate when token is unconfigured
      const isSameProvince =
        input.senderProvince.toLowerCase() === input.recipientProvince.toLowerCase();
      const fee = isSameProvince ? 22000 : 35000;
      const insuredValue = input.insuredValue ?? 0;
      return {
        carrier: CarrierProvider.GHTK,
        serviceName: 'GHTK Chuẩn',
        fee,
        estimatedDeliveryDays: isSameProvince ? 1 : 3,
        insuranceFee: insuredValue > 1000000 ? Math.round(insuredValue * 0.005) : 0,
      };
    }

    try {
      const params = new URLSearchParams({
        pick_province: input.senderProvince,
        pick_district: input.senderDistrict,
        province: input.recipientProvince,
        district: input.recipientDistrict,
        weight: String(input.weightInGrams),
        value: String(input.insuredValue || 0),
      });

      const response = await fetch(`${baseUrl}/services/shipment/fee?${params.toString()}`, {
        method: 'GET',
        headers: this.getHeaders(credentials),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        throw new Error(`GHTK API responded with status ${response.status}`);
      }

      const json = await response.json();
      if (!json.success && json.message) {
        throw new Error(json.message);
      }

      const feeData = json.fee || {};
      return {
        carrier: CarrierProvider.GHTK,
        serviceName: feeData.name || 'GHTK Tiêu Chuẩn',
        fee: Number(feeData.fee || 30000),
        estimatedDeliveryDays: feeData.delivery_type === 'fast' ? 1 : 2,
        insuranceFee: Number(feeData.insurance_fee || 0),
      };
    } catch (error: any) {
      this.logger.warn(`Failed to query GHTK rate quote: ${error.message}. Returning fallback.`);
      const isSameProvince =
        input.senderProvince.toLowerCase() === input.recipientProvince.toLowerCase();
      return {
        carrier: CarrierProvider.GHTK,
        serviceName: 'GHTK Tiêu Chuẩn (Ước tính)',
        fee: isSameProvince ? 24000 : 38000,
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
    const token = credentials?.apiToken || process.env.GHTK_API_TOKEN;

    if (!token) {
      // Offline / staging simulation
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const trackingCode = `S${Date.now().toString().slice(-6)}.${input.orderDisplayId || '101'}.${randomSuffix}`;
      return {
        trackingCode,
        carrier: CarrierProvider.GHTK,
        fee: 30000,
        rawResponse: {
          success: true,
          mock: true,
          label: trackingCode,
        },
      };
    }

    try {
      const payload = {
        products: input.items.map(it => ({
          name: it.productName + (it.variantName ? ` - ${it.variantName}` : ''),
          weight: Number(((it.weightInGrams || 200) / 1000).toFixed(2)),
          quantity: it.quantity,
          product_code: it.sku || '',
        })),
        order: {
          id: `${input.orderNumber}-${Date.now().toString().slice(-4)}`,
          pick_name: credentials?.pickName || 'Cửa hàng',
          pick_money: input.codAmount,
          pick_address: credentials?.pickAddress || 'Kho hàng trung tâm',
          pick_province: credentials?.pickProvince || 'Hà Nội',
          pick_district: credentials?.pickDistrict || 'Quận Hoàng Mai',
          pick_tel: credentials?.pickTel || '0988000111',
          name: input.recipientName,
          address: input.recipientAddress,
          province: input.province,
          district: input.district,
          ward: input.ward,
          tel: input.recipientPhone,
          note: input.notes || 'Cho xem hàng không thử',
          is_freeship: 1,
        },
      };

      const response = await fetch(`${baseUrl}/services/shipment/order/v1.5`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      const json = await response.json();
      if (!json.success) {
        throw new BadGatewayException({
          code: 'CARRIER_API_ERROR',
          message: json.message || 'GHTK API failed to create order',
          details: json,
        });
      }

      const trackingCode = json.order?.label || json.order?.tracking_id;
      return {
        trackingCode,
        carrier: CarrierProvider.GHTK,
        fee: Number(json.order?.fee || 30000),
        rawResponse: json,
      };
    } catch (error: any) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException({
        code: 'CARRIER_API_ERROR',
        message: `GHTK API connection failed: ${error.message}`,
      });
    }
  }

  async trackShipment(
    trackingCode: string,
    credentials?: Record<string, any>,
  ): Promise<TrackingStatusDto> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHTK_API_TOKEN;

    if (!token) {
      return {
        trackingCode,
        carrier: CarrierProvider.GHTK,
        status: 'DELIVERING',
        statusDescription: 'Đang giao hàng tới người nhận',
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status: 'DELIVERING',
            description: 'Shipper đang đi giao hàng',
            location: 'Bưu cục GHTK',
          },
        ],
      };
    }

    try {
      const response = await fetch(`${baseUrl}/services/shipment/v2/${trackingCode}`, {
        headers: this.getHeaders(credentials),
        signal: AbortSignal.timeout(5000),
      });

      const json = await response.json();
      const order = json.order || {};
      return {
        trackingCode,
        carrier: CarrierProvider.GHTK,
        status: order.status_text || 'IN_TRANSIT',
        statusDescription: order.message || 'Đang vận chuyển',
        timeline: (order.timeline || []).map((t: any) => ({
          timestamp: t.time || new Date().toISOString(),
          status: t.status,
          description: t.reason || t.action,
          location: t.location,
        })),
      };
    } catch (error: any) {
      return {
        trackingCode,
        carrier: CarrierProvider.GHTK,
        status: 'IN_TRANSIT',
        statusDescription: `Đang tra cứu: ${error.message}`,
        timeline: [],
      };
    }
  }

  async cancelShipment(trackingCode: string, credentials?: Record<string, any>): Promise<boolean> {
    const baseUrl = this.getApiUrl(credentials);
    const token = credentials?.apiToken || process.env.GHTK_API_TOKEN;

    if (!token) return true;

    try {
      const response = await fetch(`${baseUrl}/services/shipment/cancel/${trackingCode}`, {
        method: 'POST',
        headers: this.getHeaders(credentials),
        signal: AbortSignal.timeout(5000),
      });
      const json = await response.json();
      return Boolean(json.success);
    } catch (_e) {
      return false;
    }
  }
}
