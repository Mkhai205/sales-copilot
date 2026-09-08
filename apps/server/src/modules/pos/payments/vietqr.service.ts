import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  GenerateVietQrDto,
  VietQrResponseDto,
  WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * Standard NAPAS BIN codes mapped to Bank Code and Display Name.
 */
export const NAPAS_BANKS: Record<string, { code: string; name: string }> = {
  '970422': { code: 'MB', name: 'MBBank' },
  '970436': { code: 'VCB', name: 'Vietcombank' },
  '970407': { code: 'TCB', name: 'Techcombank' },
  '970415': { code: 'CTG', name: 'VietinBank' },
  '970418': { code: 'BIDV', name: 'BIDV' },
  '970416': { code: 'ACB', name: 'ACB' },
  '970432': { code: 'VPB', name: 'VPBank' },
  '970423': { code: 'TPB', name: 'TPBank' },
  '970403': { code: 'STB', name: 'Sacombank' },
  '970437': { code: 'HDB', name: 'HDBank' },
  '970441': { code: 'VIB', name: 'VIB' },
  '970443': { code: 'SHB', name: 'SHB' },
  '970426': { code: 'MSB', name: 'MSB' },
  '970448': { code: 'OCB', name: 'OCB' },
  '970440': { code: 'SEAB', name: 'SeABank' },
  '970449': { code: 'LPB', name: 'LPBank' },
  '970428': { code: 'NAB', name: 'NamABank' },
  '970409': { code: 'BAB', name: 'BacABank' },
  '970412': { code: 'PVCB', name: 'PVcomBank' },
  '970414': { code: 'OJB', name: 'OceanBank' },
  '970425': { code: 'ABB', name: 'AnBinhBank' },
  '970438': { code: 'BVB', name: 'BaoVietBank' },
  '970405': { code: 'VAB', name: 'VietABank' },
  '970408': { code: 'GPB', name: 'GPBank' },
  '970429': { code: 'SCB', name: 'SCB' },
  '970452': { code: 'KLB', name: 'KienLongBank' },
  '970454': { code: 'VCCB', name: 'VietCapitalBank' },
  '970419': { code: 'NVB', name: 'NCB' },
  '970431': { code: 'EIB', name: 'Eximbank' },
  '970444': { code: 'CBB', name: 'CBBank' },
  '970400': { code: 'SAIGONBANK', name: 'SaigonBank' },
  '970471': { code: 'SHBVN', name: 'Shinhan Bank' },
};

/**
 * Strips accents, maps đ/Đ to d/D, removes non-alphanumeric/spaces,
 * trims, uppercases and truncates to max length (default 25 chars for EMVCo Tag 59).
 */
export function sanitizeVietnameseUnaccented(str: string, maxLength = 25): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, match => (match === 'đ' ? 'd' : 'D'))
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

/**
 * Formats a single EMVCo TLV (Tag-Length-Value) segment.
 * Tag is 2 digits, Length is 2 digits padded with '0'.
 */
export function toTlv(tag: string, value: string): string {
  const t = tag.padStart(2, '0');
  const byteLength = Buffer.byteLength(value, 'utf8');
  const l = byteLength.toString().padStart(2, '0');
  return `${t}${l}${value}`;
}

/**
 * Computes CRC-16/CCITT-FALSE (Polynomial 0x1021, Initial 0xFFFF).
 * Standard vector: "123456789" => "29B1".
 */
export function calculateCrc16Ccitt(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    const c = payload.charCodeAt(i);
    crc ^= c << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

@Injectable()
export class VietQrService {
  private readonly logger = new Logger(VietQrService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates EMVCo MPM compliant VietQR payload (NAPAS 247 Specification).
   */
  buildEmvCoPayload(params: {
    bankBin: string;
    accountNumber: string;
    amount: number;
    accountName: string;
    memo: string;
  }): { qrPayload: string; qrUrl: string } {
    const { bankBin, accountNumber, amount, accountName, memo } = params;

    // 1. Tag 00: Payload Format Indicator ("01")
    const tlv00 = toTlv('00', '01');

    // 2. Tag 01: Point of Initiation Method ("12" = Dynamic QR with amount, "11" = Static)
    const tlv01 = toTlv('01', amount > 0 ? '12' : '11');

    // 3. Tag 38: Merchant Account Information (NAPAS 247)
    // Subtag 00: GUID "A000000727"
    const sub00 = toTlv('00', 'A000000727');

    // Subtag 01: Beneficiary (Sub-subtag 00: Bank BIN, Sub-subtag 01: Account Number)
    const subSub00 = toTlv('00', bankBin);
    const subSub01 = toTlv('01', accountNumber);
    const sub01 = toTlv('01', `${subSub00}${subSub01}`);

    // Subtag 02: Service Code "QRIBFTTA" (NAPAS 247 Fast Transfer)
    const sub02 = toTlv('02', 'QRIBFTTA');

    const tlv38 = toTlv('38', `${sub00}${sub01}${sub02}`);

    // 4. Tag 53: Transaction Currency ("704" for VND)
    const tlv53 = toTlv('53', '704');

    // 5. Tag 54: Transaction Amount (if positive integer)
    const roundedAmount = Math.max(0, Math.round(amount));
    const tlv54 = roundedAmount > 0 ? toTlv('54', roundedAmount.toString()) : '';

    // 6. Tag 58: Country Code ("VN")
    const tlv58 = toTlv('58', 'VN');

    // 7. Tag 59: Merchant Name (Sanitized, uppercase, max 25 chars)
    const cleanAccountName = sanitizeVietnameseUnaccented(accountName, 25);
    const tlv59 = cleanAccountName ? toTlv('59', cleanAccountName) : toTlv('59', 'SALES COPILOT');

    // 8. Tag 60: Merchant City ("HA NOI")
    const tlv60 = toTlv('60', 'HA NOI');

    // 9. Tag 62: Additional Data Field (Subtag 08: Purpose / Memo)
    // NAPAS 247: Max 25 chars, unaccented uppercase ASCII alphanumeric & spaces
    const cleanMemo = memo ? sanitizeVietnameseUnaccented(memo, 25) : '';
    const sub62_08 = cleanMemo ? toTlv('08', cleanMemo) : '';
    const tlv62 = sub62_08 ? toTlv('62', sub62_08) : '';

    // Assemble payload prior to CRC
    const rawPayloadWithoutCrc = `${tlv00}${tlv01}${tlv38}${tlv53}${tlv54}${tlv58}${tlv59}${tlv60}${tlv62}6304`;

    // Calculate CRC-16 CCITT over payload
    const crc = calculateCrc16Ccitt(rawPayloadWithoutCrc);
    const qrPayload = `${rawPayloadWithoutCrc}${crc}`;

    // Generate fallback VietQR compact image URL
    const qrUrl = `https://img.vietqr.io/image/${bankBin}-${accountNumber}-compact2.png?amount=${roundedAmount}&addInfo=${encodeURIComponent(
      cleanMemo,
    )}&accountName=${encodeURIComponent(cleanAccountName)}`;

    return { qrPayload, qrUrl };
  }

  /**
   * Generates VietQR response for a specific order in a workspace.
   */
  async generateForOrder(
    workspaceId: string,
    orderId: string,
    options?: GenerateVietQrDto,
  ): Promise<VietQrResponseDto> {
    const client = this.prisma.getClient();

    // 1. Fetch Order strictly scoped to workspaceId
    const order = await client.order.findFirst({
      where: { id: orderId, workspaceId },
      include: { contact: true },
    });

    if (!order) {
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'Order not found in this workspace',
        details: { orderId, workspaceId },
      });
    }

    // 2. Resolve Workspace Payment Settings
    const workspace = await client.workspace.findUnique({
      where: { id: workspaceId },
      select: { settings: true, name: true },
    });

    const wsSettings = (workspace?.settings as any)?.paymentSettings as
      WorkspacePaymentSettings | undefined;

    const bankBin = options?.bankBin || wsSettings?.bankBin;
    const accountNumber = options?.accountNumber || wsSettings?.accountNumber;
    const accountName = options?.accountName || wsSettings?.accountName || workspace?.name || '';
    const bankCode =
      options?.bankCode ||
      wsSettings?.bankCode ||
      (bankBin && NAPAS_BANKS[bankBin] ? NAPAS_BANKS[bankBin].code : 'BANK');
    const bankName =
      options?.bankName ||
      wsSettings?.bankName ||
      (bankBin && NAPAS_BANKS[bankBin] ? NAPAS_BANKS[bankBin].name : 'Ngân hàng');

    if (!bankBin || !accountNumber || !accountName) {
      throw new BadRequestException({
        code: 'BANK_ACCOUNT_NOT_CONFIGURED',
        message:
          'Tài khoản ngân hàng của Workspace chưa được cấu hình. Vui lòng vào Cài đặt để cập nhật thông tin nhận tiền.',
        details: { bankBin, accountNumber, accountName },
      });
    }

    // 3. Compute remaining amount and default transfer memo
    const remainingAmount = Math.max(
      0,
      Math.round(Number(order.totalAmount) - Number(order.paidAmount)),
    );
    const amount = remainingAmount > 0 ? remainingAmount : Math.round(Number(order.totalAmount));
    const memo = options?.memo || `ORD ${order.displayId}`;

    // 4. Build EMVCo QR and image URL
    const { qrPayload, qrUrl } = this.buildEmvCoPayload({
      bankBin,
      accountNumber,
      amount,
      accountName,
      memo,
    });

    return {
      qrPayload,
      qrUrl,
      bankBin,
      bankCode,
      bankName,
      accountNumber,
      accountName: sanitizeVietnameseUnaccented(accountName),
      amount,
      memo,
      displayId: order.displayId,
      orderId: order.id,
      orderNumber: order.orderNumber,
      transferContent: memo,
    };
  }
}
