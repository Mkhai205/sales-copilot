import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  calculateCrc16Ccitt,
  sanitizeVietnameseUnaccented,
  toTlv,
  VietQrService,
} from '../vietqr.service';

describe('VietQrService (NAPAS 247 Dynamic QR Engine)', () => {
  let service: VietQrService;
  let mockPrismaService: any;
  let clientMock: any;

  const wsId = 'ws-test-123';
  const orderId = 'order-test-456';

  beforeEach(() => {
    clientMock = {
      order: {
        findFirst: async (args: any) => {
          if (args.where.id === orderId && args.where.workspaceId === wsId) {
            return {
              id: orderId,
              displayId: 1004,
              orderNumber: 'ORD-20260909-1004',
              workspaceId: wsId,
              totalAmount: 450000,
              paidAmount: 0,
              contact: { name: 'Nguyễn Văn Khách' },
            };
          }
          return null;
        },
      },
      workspace: {
        findUnique: async (args: any) => {
          if (args.where.id === wsId) {
            return {
              id: wsId,
              name: 'Shop Thời Trang ABC',
              settings: {
                paymentSettings: {
                  bankBin: '970422', // MBBank
                  bankCode: 'MB',
                  bankName: 'MBBank',
                  accountNumber: '0987654321',
                  accountName: 'NGUYEN VAN CHU SHOP',
                },
              },
            };
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new VietQrService(mockPrismaService);
  });

  describe('TLV Formatting (toTlv)', () => {
    it('should format 2-digit tag and 2-digit length correctly', () => {
      assert.strictEqual(toTlv('00', '01'), '000201');
      assert.strictEqual(toTlv('54', '150000'), '5406150000');
      assert.strictEqual(toTlv('58', 'VN'), '5802VN');
    });

    it('should calculate byte length in octets for multi-byte UTF-8 characters', () => {
      // "Việt" is 4 characters, but 6 UTF-8 bytes (i=1, ệ=3, t=1, V=1)
      const tlv = toTlv('08', 'Việt');
      assert.strictEqual(tlv, '0806Việt');
    });

    it('should pad single digit tag with 0', () => {
      assert.strictEqual(toTlv('1', '12'), '010212');
    });
  });

  describe('Vietnamese Sanitization (sanitizeVietnameseUnaccented)', () => {
    it('should strip all diacritics and convert to uppercase', () => {
      const result = sanitizeVietnameseUnaccented('Nguyễn Văn Đạt');
      assert.strictEqual(result, 'NGUYEN VAN DAT');
    });

    it('should convert đ and Đ to D', () => {
      const result = sanitizeVietnameseUnaccented('Trần Đình Đồng');
      assert.strictEqual(result, 'TRAN DINH DONG');
    });

    it('should remove special punctuation and multiple spaces', () => {
      const result = sanitizeVietnameseUnaccented('Cty TNHH TM & DV (Việt Nam) #1');
      assert.strictEqual(result, 'CTY TNHH TM DV VIET NAM 1');
    });

    it('should truncate to specified max length (Tag 59 max 25 chars)', () => {
      const longName = 'NGUYEN HOANG PHUC LONG AN BINH DUONG';
      const result = sanitizeVietnameseUnaccented(longName, 25);
      assert.strictEqual(result.length, 25);
      assert.strictEqual(result, 'NGUYEN HOANG PHUC LONG AN');
    });
  });

  describe('CRC-16/CCITT-FALSE Calculation', () => {
    it('should calculate standard test vector "123456789" => 29B1', () => {
      const crc = calculateCrc16Ccitt('123456789');
      assert.strictEqual(crc, '29B1');
    });

    it('should pad crc to 4 hex characters', () => {
      const crc = calculateCrc16Ccitt('test');
      assert.strictEqual(crc.length, 4);
      assert.match(crc, /^[0-9A-F]{4}$/);
    });
  });

  describe('EMVCo Payload Construction (buildEmvCoPayload)', () => {
    it('should assemble all required EMVCo tags and valid CRC', () => {
      const result = service.buildEmvCoPayload({
        bankBin: '970422',
        accountNumber: '0987654321',
        amount: 450000,
        accountName: 'NGUYEN VAN A',
        memo: 'ORD 1004',
      });

      assert.ok(result.qrPayload.startsWith('000201010212')); // Tag 00 + Tag 01 (dynamic)
      assert.ok(result.qrPayload.includes('38')); // Tag 38 (NAPAS)
      assert.ok(result.qrPayload.includes('A000000727')); // NAPAS GUID
      assert.ok(result.qrPayload.includes('970422')); // Bank BIN
      assert.ok(result.qrPayload.includes('0987654321')); // Account number
      assert.ok(result.qrPayload.includes('QRIBFTTA')); // Service code
      assert.ok(result.qrPayload.includes('5303704')); // Currency VND
      assert.ok(result.qrPayload.includes('5406450000')); // Amount 450000
      assert.ok(result.qrPayload.includes('5802VN')); // Country
      assert.ok(result.qrPayload.includes('5912NGUYEN VAN A')); // Merchant Name
      assert.ok(result.qrPayload.includes('ORD 1004')); // Memo
      assert.ok(result.qrPayload.includes('6304')); // CRC Tag

      // Verify CRC matches calculated CRC over the payload
      const payloadWithoutCrc = result.qrPayload.slice(0, -4);
      const expectedCrc = calculateCrc16Ccitt(payloadWithoutCrc);
      assert.strictEqual(result.qrPayload.slice(-4), expectedCrc);

      // Verify VietQR image url format
      assert.ok(result.qrUrl.includes('img.vietqr.io/image/970422-0987654321-compact2.png'));
      assert.ok(result.qrUrl.includes('amount=450000'));
      assert.ok(result.qrUrl.includes('addInfo=ORD%201004'));
    });

    it('should sanitize accented Vietnamese memo to unaccented ASCII per NAPAS 247', () => {
      const result = service.buildEmvCoPayload({
        bankBin: '970422',
        accountNumber: '0987654321',
        amount: 450000,
        accountName: 'NGUYEN VAN A',
        memo: 'ORD 1004 Đơn hàng giầy',
      });

      assert.ok(result.qrPayload.includes('ORD 1004 DON HANG GIAY'));
      assert.strictEqual(result.qrPayload.includes('Đơn'), false);
    });
  });

  describe('generateForOrder', () => {
    it('should successfully generate VietQR using workspace payment settings', async () => {
      const result = await service.generateForOrder(wsId, orderId);

      assert.strictEqual(result.orderId, orderId);
      assert.strictEqual(result.displayId, 1004);
      assert.strictEqual(result.amount, 450000);
      assert.strictEqual(result.bankBin, '970422');
      assert.strictEqual(result.accountNumber, '0987654321');
      assert.strictEqual(result.accountName, 'NGUYEN VAN CHU SHOP');
      assert.strictEqual(result.memo, 'ORD 1004');
      assert.ok(result.qrPayload.length > 50);
      assert.ok(result.qrUrl.includes('img.vietqr.io'));
    });

    it('should allow overriding bank account or memo via options', async () => {
      const result = await service.generateForOrder(wsId, orderId, {
        bankBin: '970436', // Vietcombank
        accountNumber: '1122334455',
        accountName: 'CONG TY ABC',
        memo: 'DH 1004 COC',
      });

      assert.strictEqual(result.bankBin, '970436');
      assert.strictEqual(result.accountNumber, '1122334455');
      assert.strictEqual(result.accountName, 'CONG TY ABC');
      assert.strictEqual(result.memo, 'DH 1004 COC');
      assert.ok(result.qrPayload.includes('970436'));
      assert.ok(result.qrPayload.includes('1122334455'));
    });

    it('should throw NotFoundException if order does not exist in workspace', async () => {
      await assert.rejects(
        async () => {
          await service.generateForOrder(wsId, 'non-existent-order');
        },
        (err: any) => {
          assert.strictEqual(err.name, 'NotFoundException');
          assert.strictEqual(err.response?.code, 'ORDER_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw BadRequestException if bank account is not configured', async () => {
      clientMock.workspace.findUnique = async () => ({
        id: wsId,
        name: 'Empty Shop',
        settings: {},
      });

      await assert.rejects(
        async () => {
          await service.generateForOrder(wsId, orderId);
        },
        (err: any) => {
          assert.strictEqual(err.name, 'BadRequestException');
          assert.strictEqual(err.response?.code, 'BANK_ACCOUNT_NOT_CONFIGURED');
          return true;
        },
      );
    });
  });
});
