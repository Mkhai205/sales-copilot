import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { OrderStatus } from '@sales-copilot/shared-contracts';
import { createConfirmAndGenerateQrTool } from '../confirm-and-generate-qr.tool';

describe('confirmAndGenerateQR Tool (T7)', () => {
  const workspaceId = 'ws-test-123';
  const conversationId = 'conv-test-456';
  let mockPrisma: any;
  let mockOrdersService: any;
  let mockVietQrService: any;
  let mockMessagesService: any;
  let confirmCalls: string[];
  let sentMessages: any[];

  beforeEach(() => {
    confirmCalls = [];
    sentMessages = [];

    const ordersDb: Map<string, any> = new Map([
      [
        'ord-draft',
        {
          id: 'ord-draft',
          orderNumber: 'ORD-20260917-1042',
          displayId: 1042,
          status: OrderStatus.DRAFT,
          workspaceId,
          totalAmount: 180000,
        },
      ],
      [
        'ord-confirmed',
        {
          id: 'ord-confirmed',
          orderNumber: 'ORD-20260917-1043',
          displayId: 1043,
          status: OrderStatus.CONFIRMED,
          workspaceId,
          totalAmount: 250000,
        },
      ],
      [
        'ord-paid',
        {
          id: 'ord-paid',
          orderNumber: 'ORD-20260917-1044',
          displayId: 1044,
          status: OrderStatus.PAID,
          workspaceId,
          totalAmount: 300000,
        },
      ],
    ]);

    mockPrisma = {
      getClient: () => ({
        order: {
          findFirst: async ({ where }: any) => {
            if (where.workspaceId !== workspaceId) return null;
            return ordersDb.get(where.id) || null;
          },
        },
      }),
    };

    mockOrdersService = {
      confirmOrder: async (wsId: string, orderId: string) => {
        confirmCalls.push(orderId);
        const o = ordersDb.get(orderId);
        if (o) o.status = OrderStatus.CONFIRMED;
        return o;
      },
    };

    mockVietQrService = {
      generateForOrder: async (wsId: string, orderId: string, opts: any) => {
        const o = ordersDb.get(orderId);
        return {
          orderId,
          orderNumber: o.orderNumber,
          displayId: o.displayId,
          amount: o.totalAmount,
          qrUrl: 'https://img.vietqr.io/image/MB-0988123456-compact2.png',
          qrPayload:
            '00020101021238570010A00000072701270006970422011309881234560208QRIBFTTA530370454061800005802VN5913SALES COPILOT6006HA NOI62100806DH1042630429B1',
          bankName: 'MBBank',
          accountNumber: '0988123456',
          accountName: 'SALES COPILOT',
          transferContent: opts?.memo || 'DH1042',
        };
      },
    };

    mockMessagesService = {
      create: async (wsId: string, convId: string, payload: any) => {
        sentMessages.push({ wsId, convId, ...payload });
        return { id: 'msg-qr-card', ...payload };
      },
    };
  });

  it('should confirm DRAFT order and generate VietQR with interactive card', async () => {
    const tool = createConfirmAndGenerateQrTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      vietQrService: mockVietQrService,
      prisma: mockPrisma,
      messagesService: mockMessagesService,
    });

    const result = await tool.execute!({ orderId: 'ord-draft' }, {} as any);

    assert.strictEqual(confirmCalls.length, 1);
    assert.strictEqual(confirmCalls[0], 'ord-draft');
    assert.strictEqual(result.orderId, 'ord-draft');
    assert.strictEqual(result.displayId, 1042);
    assert.strictEqual(result.bankName, 'MBBank');
    assert.ok(result.qrImageUrl.includes('img.vietqr.io'));

    // Check that interactive card message was dispatched
    assert.strictEqual(sentMessages.length, 1);
    assert.strictEqual(sentMessages[0].metadata?.type, 'VIETQR_PAYMENT');
  });

  it('should be idempotent and skip confirmOrder if already CONFIRMED', async () => {
    const tool = createConfirmAndGenerateQrTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      vietQrService: mockVietQrService,
      prisma: mockPrisma,
      messagesService: mockMessagesService,
    });

    const result = await tool.execute!({ orderId: 'ord-confirmed' }, {} as any);

    // confirmOrder should NOT have been called again (avoid double-reserving stock!)
    assert.strictEqual(confirmCalls.length, 0);
    assert.strictEqual(result.orderId, 'ord-confirmed');
    assert.strictEqual(result.displayId, 1043);
  });

  it('should reject when order is already PAID', async () => {
    const tool = createConfirmAndGenerateQrTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      vietQrService: mockVietQrService,
      prisma: mockPrisma,
      messagesService: mockMessagesService,
    });

    const result = await tool.execute!({ orderId: 'ord-paid' }, {} as any);
    assert.strictEqual(result.error, 'ORDER_ALREADY_PAID');
  });

  it('should reject when order is not found in workspace', async () => {
    const tool = createConfirmAndGenerateQrTool({
      workspaceId,
      conversationId,
      ordersService: mockOrdersService,
      vietQrService: mockVietQrService,
      prisma: mockPrisma,
    });

    const result = await tool.execute!({ orderId: 'non-existent' }, {} as any);
    assert.strictEqual(result.error, 'ORDER_NOT_FOUND');
  });
});
