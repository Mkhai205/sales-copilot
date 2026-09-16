import { describe, it, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { BadGatewayException } from '@nestjs/common';
import { CarrierProvider } from '@sales-copilot/shared-contracts';
import { CustomCarrierAdapter } from '../adapters/custom.adapter';
import { GhnCarrierAdapter } from '../adapters/ghn.adapter';
import { GhtkCarrierAdapter } from '../adapters/ghtk.adapter';

describe('Logistics Carrier Adapters Unit Tests', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('1. CustomCarrierAdapter', () => {
    const adapter = new CustomCarrierAdapter();

    it('should calculate intra-province fee without excess weight', async () => {
      const quote = await adapter.calculateFee({
        carrier: CarrierProvider.CUSTOM,
        senderProvince: 'Hà Nội',
        senderDistrict: 'Hoàng Mai',
        recipientProvince: 'Hà Nội',
        recipientDistrict: 'Cầu Giấy',
        weightInGrams: 500,
        insuredValue: 0,
      });

      assert.strictEqual(quote.carrier, CarrierProvider.CUSTOM);
      assert.strictEqual(quote.fee, 22000);
      assert.strictEqual(quote.estimatedDeliveryDays, 1);
      assert.strictEqual(quote.insuranceFee, 0);
    });

    it('should calculate inter-province fee with excess weight and insurance', async () => {
      const quote = await adapter.calculateFee({
        carrier: CarrierProvider.CUSTOM,
        senderProvince: 'Hà Nội',
        senderDistrict: 'Hoàng Mai',
        recipientProvince: 'Hồ Chí Minh',
        recipientDistrict: 'Quận 1',
        weightInGrams: 2200, // 1000 base + 1200 excess = 3 blocks of 500g -> +15000
        insuredValue: 2000000, // > 1,000,000 -> 2,000,000 * 0.005 = 10000
      });

      assert.strictEqual(quote.fee, 35000 + 15000); // 50000
      assert.strictEqual(quote.estimatedDeliveryDays, 3);
      assert.strictEqual(quote.insuranceFee, 10000);
    });

    it('should generate shipment with INTERNAL- prefix', async () => {
      const res = await adapter.createShipment({
        orderId: 'ord-123',
        orderNumber: 'ORD-123',
        orderDisplayId: 105,
        recipientName: 'Nguyễn Văn A',
        recipientPhone: '0988111222',
        recipientAddress: '123 Đường Láng',
        province: 'Hà Nội',
        district: 'Đống Đa',
        ward: 'Láng Thượng',
        codAmount: 300000,
        totalWeightInGrams: 500,
        items: [],
      });

      assert.strictEqual(res.carrier, CarrierProvider.CUSTOM);
      assert.ok(res.trackingCode.startsWith('INTERNAL-105-'));
      assert.strictEqual(res.fee, 25000);
    });

    it('should return tracking timeline for custom shipment', async () => {
      const tracking = await adapter.trackShipment('INTERNAL-105-XYZ');
      assert.strictEqual(tracking.trackingCode, 'INTERNAL-105-XYZ');
      assert.strictEqual(tracking.status, 'IN_TRANSIT');
      assert.ok(tracking.timeline.length >= 2);
    });

    it('should cancel custom shipment successfully', async () => {
      const success = await adapter.cancelShipment('INTERNAL-105-XYZ');
      assert.strictEqual(success, true);
    });
  });

  describe('2. GhtkCarrierAdapter', () => {
    const adapter = new GhtkCarrierAdapter();

    it('should return fallback fee estimate when no API token is configured', async () => {
      const quote = await adapter.calculateFee(
        {
          carrier: CarrierProvider.GHTK,
          senderProvince: 'Hà Nội',
          senderDistrict: 'Hoàng Mai',
          recipientProvince: 'Hà Nội',
          recipientDistrict: 'Ba Đình',
          weightInGrams: 500,
          insuredValue: 500000,
        },
        {},
      );

      assert.strictEqual(quote.carrier, CarrierProvider.GHTK);
      assert.strictEqual(quote.fee, 22000);
      assert.strictEqual(quote.estimatedDeliveryDays, 1);
    });

    it('should parse real GHTK API response when credentials are provided', async () => {
      global.fetch = (async (url: string) => {
        assert.ok(url.includes('services.giaohangtietkiem.vn/services/shipment/fee'));
        return {
          ok: true,
          json: async () => ({
            success: true,
            fee: {
              name: 'GHTK Bay',
              fee: 28000,
              insurance_fee: 2000,
              delivery_type: 'fast',
            },
          }),
        } as any;
      }) as any;

      const quote = await adapter.calculateFee(
        {
          carrier: CarrierProvider.GHTK,
          senderProvince: 'Hà Nội',
          senderDistrict: 'Hoàng Mai',
          recipientProvince: 'Đà Nẵng',
          recipientDistrict: 'Hải Châu',
          weightInGrams: 800,
          insuredValue: 1000000,
        },
        { apiToken: 'mock_ghtk_token_123' },
      );

      assert.strictEqual(quote.serviceName, 'GHTK Bay');
      assert.strictEqual(quote.fee, 28000);
      assert.strictEqual(quote.insuranceFee, 2000);
      assert.strictEqual(quote.estimatedDeliveryDays, 1);
    });

    it('should create GHTK shipment and parse tracking code', async () => {
      global.fetch = (async (url: string, opts: any) => {
        assert.ok(url.includes('/services/shipment/order/v1.5'));
        assert.strictEqual(opts.headers.Token, 'mock_ghtk_token');
        return {
          ok: true,
          json: async () => ({
            success: true,
            order: {
              label: 'S2026.105.GHTK123',
              fee: 33000,
            },
          }),
        } as any;
      }) as any;

      const res = await adapter.createShipment(
        {
          orderId: 'ord-123',
          orderNumber: 'ORD-123',
          orderDisplayId: 105,
          recipientName: 'Trần Thị B',
          recipientPhone: '0977333444',
          recipientAddress: '45 Lê Duẩn',
          province: 'Hà Nội',
          district: 'Hai Bà Trưng',
          ward: 'Bạch Đằng',
          codAmount: 450000,
          totalWeightInGrams: 600,
          items: [
            {
              productName: 'Váy Hoa',
              sku: 'VAY-01',
              quantity: 1,
              price: 450000,
            },
          ],
        },
        { apiToken: 'mock_ghtk_token' },
      );

      assert.strictEqual(res.trackingCode, 'S2026.105.GHTK123');
      assert.strictEqual(res.fee, 33000);
      assert.strictEqual(res.carrier, CarrierProvider.GHTK);
    });

    it('should throw BadGatewayException when GHTK API returns success: false', async () => {
      global.fetch = (async () => ({
        ok: true,
        json: async () => ({
          success: false,
          message: 'GHTK: Địa chỉ người nhận không hợp lệ',
        }),
      })) as any;

      await assert.rejects(
        async () => {
          await adapter.createShipment(
            {
              orderId: 'ord-123',
              orderNumber: 'ORD-123',
              orderDisplayId: 105,
              recipientName: 'Trần Thị B',
              recipientPhone: '0977333444',
              recipientAddress: '45 Lê Duẩn',
              province: 'Hà Nội',
              district: 'Hai Bà Trưng',
              ward: 'Bạch Đằng',
              codAmount: 0,
              totalWeightInGrams: 300,
              items: [],
            },
            { apiToken: 'mock_ghtk_token' },
          );
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadGatewayException, true);
          assert.strictEqual(err.getResponse().code, 'CARRIER_API_ERROR');
          assert.ok(err.message.includes('Địa chỉ người nhận không hợp lệ'));
          return true;
        },
      );
    });
  });

  describe('3. GhnCarrierAdapter', () => {
    const adapter = new GhnCarrierAdapter();

    it('should return fallback fee estimate when no API token is configured', async () => {
      const quote = await adapter.calculateFee(
        {
          carrier: CarrierProvider.GHN,
          senderProvince: 'Hà Nội',
          senderDistrict: 'Hoàng Mai',
          recipientProvince: 'Hồ Chí Minh',
          recipientDistrict: 'Quận 1',
          weightInGrams: 500,
        },
        {},
      );

      assert.strictEqual(quote.carrier, CarrierProvider.GHN);
      assert.strictEqual(quote.fee, 38000);
      assert.strictEqual(quote.estimatedDeliveryDays, 3);
    });

    it('should parse GHN Shiip v2 fee calculation response', async () => {
      global.fetch = (async (url: string, opts: any) => {
        assert.ok(url.includes('/shipping-order/fee'));
        assert.strictEqual(opts.headers.token, 'ghn_token_abc');
        return {
          ok: true,
          json: async () => ({
            code: 200,
            data: {
              total: 36000,
              insurance_fee: 1500,
            },
          }),
        } as any;
      }) as any;

      const quote = await adapter.calculateFee(
        {
          carrier: CarrierProvider.GHN,
          senderProvince: 'Hà Nội',
          senderDistrict: 'Hoàng Mai',
          recipientProvince: 'Hồ Chí Minh',
          recipientDistrict: 'Quận 1',
          weightInGrams: 1000,
          insuredValue: 500000,
        },
        { apiToken: 'ghn_token_abc', shopId: '12345' },
      );

      assert.strictEqual(quote.carrier, CarrierProvider.GHN);
      assert.strictEqual(quote.fee, 36000);
      assert.strictEqual(quote.insuranceFee, 1500);
    });

    it('should create GHN shipment and parse order_code tracking', async () => {
      global.fetch = (async (url: string, opts: any) => {
        assert.ok(url.includes('/shipping-order/create'));
        assert.strictEqual(opts.headers.token, 'ghn_token_abc');
        assert.strictEqual(opts.headers.ShopId, '99999');
        return {
          ok: true,
          json: async () => ({
            code: 200,
            data: {
              order_code: 'GHN998877AABB',
              total_fee: 34000,
            },
          }),
        } as any;
      }) as any;

      const res = await adapter.createShipment(
        {
          orderId: 'ord-ghn-1',
          orderNumber: 'ORD-GHN-1',
          orderDisplayId: 109,
          recipientName: 'Lê Văn C',
          recipientPhone: '0912345678',
          recipientAddress: '100 Nguyễn Thị Minh Khai',
          province: 'Hồ Chí Minh',
          district: 'Quận 3',
          ward: 'Võ Thị Sáu',
          codAmount: 200000,
          totalWeightInGrams: 400,
          items: [
            {
              productName: 'Giày Thể Thao',
              sku: 'GIAY-42',
              quantity: 1,
              price: 200000,
            },
          ],
        },
        { apiToken: 'ghn_token_abc', shopId: '99999' },
      );

      assert.strictEqual(res.trackingCode, 'GHN998877AABB');
      assert.strictEqual(res.fee, 34000);
      assert.strictEqual(res.carrier, CarrierProvider.GHN);
    });

    it('should throw BadGatewayException when GHN API returns code != 200', async () => {
      global.fetch = (async () => ({
        ok: true,
        json: async () => ({
          code: 400,
          message: 'GHN: to_district_id is not valid',
        }),
      })) as any;

      await assert.rejects(
        async () => {
          await adapter.createShipment(
            {
              orderId: 'ord-123',
              orderNumber: 'ORD-123',
              orderDisplayId: 109,
              recipientName: 'Lê Văn C',
              recipientPhone: '0912345678',
              recipientAddress: '100 Nguyễn Thị Minh Khai',
              province: 'Hồ Chí Minh',
              district: 'Quận 3',
              ward: 'Võ Thị Sáu',
              codAmount: 0,
              totalWeightInGrams: 200,
              items: [],
            },
            { apiToken: 'ghn_token_abc' },
          );
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadGatewayException, true);
          assert.strictEqual(err.getResponse().code, 'CARRIER_API_ERROR');
          assert.ok(err.message.includes('to_district_id is not valid'));
          return true;
        },
      );
    });
  });
});
