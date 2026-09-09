import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { PosEventListener } from '../pos-event.listener';

describe('PosEventListener (Realtime Chat Receipt)', () => {
  let listener: PosEventListener;
  let mockMessagesService: any;

  let createdMessages: Array<any>;

  const wsId = 'ws-listener-test';
  const orderId = 'order-test-123';
  const conversationId = 'conv-test-456';

  beforeEach(() => {
    createdMessages = [];

    mockMessagesService = {
      create: async (workspaceId: string, convId: string, dto: any) => {
        createdMessages.push({ workspaceId, convId, dto });
        return { id: 'msg-123', ...dto };
      },
    };

    listener = new PosEventListener(mockMessagesService);
  });

  it('should post system receipt to conversation thread on ORDER_PAID', async () => {
    await listener.handleOrderPaid({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      conversationId,
      paidAmount: 500000,
      gateway: 'sepay',
      transactionCode: 'TX_SEPAY_111',
    });

    assert.strictEqual(createdMessages.length, 1);
    const msg = createdMessages[0];
    assert.strictEqual(msg.workspaceId, wsId);
    assert.strictEqual(msg.convId, conversationId);
    assert.strictEqual(msg.dto.senderType, SenderType.SYSTEM);
    assert.strictEqual(msg.dto.senderId, undefined);
    assert.strictEqual(msg.dto.messageType, MessageType.ACTIVITY);
    assert.ok(msg.dto.content.includes('1004'));
    assert.ok(msg.dto.content.includes('SEPAY'));
    assert.ok(msg.dto.content.includes('TX_SEPAY_111'));
  });

  it('should post system receipt to conversation thread on ORDER_PARTIALLY_PAID', async () => {
    await listener.handleOrderPartiallyPaid({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      conversationId,
      paidAmount: 200000,
      receivedAmount: 200000,
      totalAmount: 500000,
      remainingAmount: 300000,
      gateway: 'sepay',
      transactionCode: 'TX_PARTIAL_99',
    });

    assert.strictEqual(createdMessages.length, 1);
    const msg = createdMessages[0];
    assert.strictEqual(msg.workspaceId, wsId);
    assert.strictEqual(msg.convId, conversationId);
    assert.strictEqual(msg.dto.senderType, SenderType.SYSTEM);
    assert.strictEqual(msg.dto.senderId, undefined);
    assert.strictEqual(msg.dto.messageType, MessageType.ACTIVITY);
    assert.ok(msg.dto.content.includes('1004'));
    assert.ok(msg.dto.content.includes('200.000'));
    assert.ok(msg.dto.content.includes('300.000'));
    assert.strictEqual(msg.dto.metadata.type, 'PAYMENT_RECEIPT');
    assert.strictEqual(msg.dto.metadata.status, 'PARTIALLY_PAID');
  });

  it('should post order shipped activity message to conversation thread on ORDER_SHIPPED', async () => {
    await listener.handleOrderShipped({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      conversationId,
      trackingCode: 'GHTK998877',
      shippingCarrier: 'GHTK',
    });

    assert.strictEqual(createdMessages.length, 1);
    const msg = createdMessages[0];
    assert.strictEqual(msg.workspaceId, wsId);
    assert.strictEqual(msg.convId, conversationId);
    assert.strictEqual(msg.dto.senderType, SenderType.SYSTEM);
    assert.strictEqual(msg.dto.messageType, MessageType.ACTIVITY);
    assert.ok(msg.dto.content.includes('1004'));
    assert.ok(msg.dto.content.includes('GHTK'));
    assert.ok(msg.dto.content.includes('GHTK998877'));
    assert.strictEqual(msg.dto.metadata.type, 'ORDER_SHIPPED');
    assert.strictEqual(msg.dto.metadata.trackingCode, 'GHTK998877');
  });
});
