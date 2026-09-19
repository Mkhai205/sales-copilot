import { expectReject } from '../../../../../test/test-assertions';
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
      expect(toTlv('00', '01')).toBe('000201');
      expect(toTlv('54', '150000')).toBe('5406150000');
      expect(toTlv('58', 'VN')).toBe('5802VN');
    });

    it('should calculate byte length in octets for multi-byte UTF-8 characters', () => {
      // "Việt" is 4 characters, but 6 UTF-8 bytes (i=1, ệ=3, t=1, V=1)
      const tlv = toTlv('08', 'Việt');
      expect(tlv).toBe('0806Việt');
    });

    it('should pad single digit tag with 0', () => {
      expect(toTlv('1', '12')).toBe('010212');
    });
  });

  describe('Vietnamese Sanitization (sanitizeVietnameseUnaccented)', () => {
    it('should strip all diacritics and convert to uppercase', () => {
      const result = sanitizeVietnameseUnaccented('Nguyễn Văn Đạt');
      expect(result).toBe('NGUYEN VAN DAT');
    });

    it('should convert đ and Đ to D', () => {
      const result = sanitizeVietnameseUnaccented('Trần Đình Đồng');
      expect(result).toBe('TRAN DINH DONG');
    });

    it('should remove special punctuation and multiple spaces', () => {
      const result = sanitizeVietnameseUnaccented('Cty TNHH TM & DV (Việt Nam) #1');
      expect(result).toBe('CTY TNHH TM DV VIET NAM 1');
    });

    it('should truncate to specified max length (Tag 59 max 25 chars)', () => {
      const longName = 'NGUYEN HOANG PHUC LONG AN BINH DUONG';
      const result = sanitizeVietnameseUnaccented(longName, 25);
      expect(result.length).toBe(25);
      expect(result).toBe('NGUYEN HOANG PHUC LONG AN');
    });
  });

  describe('CRC-16/CCITT-FALSE Calculation', () => {
    it('should calculate standard test vector "123456789" => 29B1', () => {
      const crc = calculateCrc16Ccitt('123456789');
      expect(crc).toBe('29B1');
    });

    it('should pad crc to 4 hex characters', () => {
      const crc = calculateCrc16Ccitt('test');
      expect(crc.length).toBe(4);
      expect(crc).toMatch(/^[0-9A-F]{4}$/);
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

      expect(result.qrPayload.startsWith('000201010212')).toBeTruthy(); // Tag 00 + Tag 01 (dynamic)
      expect(result.qrPayload.includes('38')).toBeTruthy(); // Tag 38 (NAPAS)
      expect(result.qrPayload.includes('A000000727')).toBeTruthy(); // NAPAS GUID
      expect(result.qrPayload.includes('970422')).toBeTruthy(); // Bank BIN
      expect(result.qrPayload.includes('0987654321')).toBeTruthy(); // Account number
      expect(result.qrPayload.includes('QRIBFTTA')).toBeTruthy(); // Service code
      expect(result.qrPayload.includes('5303704')).toBeTruthy(); // Currency VND
      expect(result.qrPayload.includes('5406450000')).toBeTruthy(); // Amount 450000
      expect(result.qrPayload.includes('5802VN')).toBeTruthy(); // Country
      expect(result.qrPayload.includes('5912NGUYEN VAN A')).toBeTruthy(); // Merchant Name
      expect(result.qrPayload.includes('ORD 1004')).toBeTruthy(); // Memo
      expect(result.qrPayload.includes('6304')).toBeTruthy(); // CRC Tag

      // Verify CRC matches calculated CRC over the payload
      const payloadWithoutCrc = result.qrPayload.slice(0, -4);
      const expectedCrc = calculateCrc16Ccitt(payloadWithoutCrc);
      expect(result.qrPayload.slice(-4)).toBe(expectedCrc);

      // Verify VietQR image url format
      expect(
        result.qrUrl.includes('img.vietqr.io/image/970422-0987654321-compact2.png'),
      ).toBeTruthy();
      expect(result.qrUrl.includes('amount=450000')).toBeTruthy();
      expect(result.qrUrl.includes('addInfo=ORD%201004')).toBeTruthy();
    });

    it('should sanitize accented Vietnamese memo to unaccented ASCII per NAPAS 247', () => {
      const result = service.buildEmvCoPayload({
        bankBin: '970422',
        accountNumber: '0987654321',
        amount: 450000,
        accountName: 'NGUYEN VAN A',
        memo: 'ORD 1004 Đơn hàng giầy',
      });

      expect(result.qrPayload.includes('ORD 1004 DON HANG GIAY')).toBeTruthy();
      expect(result.qrPayload.includes('Đơn')).toBe(false);
    });
  });

  describe('generateForOrder', () => {
    it('should successfully generate VietQR using workspace payment settings', async () => {
      const result = await service.generateForOrder(wsId, orderId);

      expect(result.orderId).toBe(orderId);
      expect(result.displayId).toBe(1004);
      expect(result.amount).toBe(450000);
      expect(result.bankBin).toBe('970422');
      expect(result.accountNumber).toBe('0987654321');
      expect(result.accountName).toBe('NGUYEN VAN CHU SHOP');
      expect(result.memo).toBe('ORD 1004');
      expect(result.qrPayload.length > 50).toBeTruthy();
      expect(result.qrUrl.includes('img.vietqr.io')).toBeTruthy();
    });

    it('should allow overriding bank account or memo via options', async () => {
      const result = await service.generateForOrder(wsId, orderId, {
        bankBin: '970436', // Vietcombank
        accountNumber: '1122334455',
        accountName: 'CONG TY ABC',
        memo: 'DH 1004 COC',
      });

      expect(result.bankBin).toBe('970436');
      expect(result.accountNumber).toBe('1122334455');
      expect(result.accountName).toBe('CONG TY ABC');
      expect(result.memo).toBe('DH 1004 COC');
      expect(result.qrPayload.includes('970436')).toBeTruthy();
      expect(result.qrPayload.includes('1122334455')).toBeTruthy();
    });

    it('should throw NotFoundException if order does not exist in workspace', async () => {
      await expectReject(
        async () => {
          await service.generateForOrder(wsId, 'non-existent-order');
        },
        (err: any) => {
          expect(err.name).toBe('NotFoundException');
          expect(err.response?.code).toBe('ORDER_NOT_FOUND');
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

      await expectReject(
        async () => {
          await service.generateForOrder(wsId, orderId);
        },
        (err: any) => {
          expect(err.name).toBe('BadRequestException');
          expect(err.response?.code).toBe('BANK_ACCOUNT_NOT_CONFIGURED');
          return true;
        },
      );
    });
  });
});
