import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { VietQrController } from '../vietqr.controller';
import { MessageType, SenderType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import type { WorkspaceContext } from '../../../workspaces/types/workspace-context.type';

describe('VietQrController (POSIX / REST API & Chat Integration)', () => {
  let controller: VietQrController;
  let mockVietQrService: any;
  let mockMessagesService: any;
  let mockPrismaService: any;
  let clientMock: any;

  const wsId = 'ws-test-123';
  const orderId = 'order-test-456';
  const conversationId = 'conv-test-789';

  const mockContext: WorkspaceContext = {
    workspaceId: wsId,
    role: WorkspaceRole.AGENT,
    workspace: {
      id: wsId,
      name: 'Test WS',
      slug: 'test-ws',
      billingPlan: 'ENTERPRISE',
      timezone: 'Asia/Ho_Chi_Minh',
      defaultLanguage: 'vi',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  beforeEach(() => {
    mockVietQrService = {
      generateForOrder: async (workspaceId: string, id: string, dto?: any) => {
        return {
          qrPayload:
            '00020101021238540010A00000072701240006970422011009881234560208QRIBFTTA530370454062500005802VN62110807ORD 1016304ABCD',
          qrUrl:
            'https://img.vietqr.io/image/970422-0988123456-compact2.png?amount=250000&addInfo=ORD%20101&accountName=CONG%20TY%20SALES%20COPILOT',
          bankBin: dto?.bankBin || '970422',
          bankCode: dto?.bankCode || 'MB',
          bankName: dto?.bankName || 'MBBank',
          accountNumber: dto?.accountNumber || '0988123456',
          accountName: dto?.accountName || 'CONG TY SALES COPILOT',
          amount: 250000,
          memo: dto?.memo || 'ORD 101',
          displayId: 101,
          orderId,
        };
      },
    };

    clientMock = {
      order: {
        findFirst: async (args: any) => {
          if (args.where.id === orderId && args.where.workspaceId === wsId) {
            return {
              id: orderId,
              displayId: 101,
              conversationId,
            };
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    mockMessagesService = {
      createdMessages: [] as any[],
      create: async (workspaceId: string, convId: string, payload: any) => {
        mockMessagesService.createdMessages.push({ workspaceId, convId, payload });
        return { id: 'msg-1', ...payload };
      },
    };

    controller = new VietQrController(mockVietQrService, mockPrismaService, mockMessagesService);
  });

  it('should generate VietQR with default workspace settings and post to chat thread by default', async () => {
    const result = await controller.generateVietQr(
      wsId,
      orderId,
      undefined,
      { id: 'usr-agent-1' },
      mockContext,
    );

    assert.strictEqual(result.displayId, 101);
    assert.strictEqual(result.bankBin, '970422');
    assert.strictEqual(result.bankCode, 'MB');
    assert.strictEqual(result.accountNumber, '0988123456');
    assert.strictEqual(result.accountName, 'CONG TY SALES COPILOT');
    assert.strictEqual(result.amount, 250000);
    assert.strictEqual(result.memo, 'ORD 101');

    // Verify auto-sent message in chat
    assert.strictEqual(mockMessagesService.createdMessages.length, 1);
    const sentMsg = mockMessagesService.createdMessages[0];
    assert.strictEqual(sentMsg.workspaceId, wsId);
    assert.strictEqual(sentMsg.convId, conversationId);
    assert.strictEqual(sentMsg.payload.senderType, SenderType.USER);
    assert.strictEqual(sentMsg.payload.senderId, 'usr-agent-1');
    assert.strictEqual(sentMsg.payload.messageType, MessageType.OUTGOING);
    assert.strictEqual(sentMsg.payload.metadata.type, 'VIETQR_PAYMENT');
    assert.deepStrictEqual(sentMsg.payload.metadata.qrData, result);
  });

  it('should generate VietQR with override bank details when specified in DTO', async () => {
    const result = await controller.generateVietQr(
      wsId,
      orderId,
      {
        bankBin: '970436', // Vietcombank
        bankCode: 'VCB',
        accountNumber: '0011001234567',
        accountName: 'CONG TY SALES COPILOT VCB',
        memo: 'DH 101',
      },
      { id: 'usr-agent-1' },
      mockContext,
    );

    assert.strictEqual(result.bankBin, '970436');
    assert.strictEqual(result.bankCode, 'VCB');
    assert.strictEqual(result.accountNumber, '0011001234567');
    assert.strictEqual(result.accountName, 'CONG TY SALES COPILOT VCB');
    assert.strictEqual(result.memo, 'DH 101');
  });

  it('should not post to chat thread if sendToChat is explicitly false', async () => {
    await controller.generateVietQr(
      wsId,
      orderId,
      { sendToChat: false },
      { id: 'usr-agent-1' },
      mockContext,
    );

    assert.strictEqual(mockMessagesService.createdMessages.length, 0);
  });

  it('should fallback to SYSTEM senderType if user context is missing', async () => {
    await controller.generateVietQr(wsId, orderId, undefined, undefined, mockContext);

    assert.strictEqual(mockMessagesService.createdMessages.length, 1);
    assert.strictEqual(
      mockMessagesService.createdMessages[0].payload.senderType,
      SenderType.SYSTEM,
    );
    assert.strictEqual(mockMessagesService.createdMessages[0].payload.senderId, undefined);
  });

  it('should gracefully handle chat posting errors without failing VietQR response', async () => {
    mockMessagesService.create = async () => {
      throw new Error('Chat service network error');
    };

    const result = await controller.generateVietQr(
      wsId,
      orderId,
      undefined,
      { id: 'usr-agent-1' },
      mockContext,
    );

    assert.strictEqual(result.displayId, 101);
  });
});
