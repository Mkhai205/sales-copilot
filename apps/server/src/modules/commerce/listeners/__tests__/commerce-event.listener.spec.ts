import { MessageType, SenderType } from '@sales-copilot/shared-contracts';
import { CommerceEventListener } from '../commerce-event.listener';

describe('CommerceEventListener (Realtime Chat Receipt)', () => {
  let listener: CommerceEventListener;
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

    listener = new CommerceEventListener(mockMessagesService);
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

    expect(createdMessages.length).toBe(1);
    const msg = createdMessages[0];
    expect(msg.workspaceId).toBe(wsId);
    expect(msg.convId).toBe(conversationId);
    expect(msg.dto.senderType).toBe(SenderType.SYSTEM);
    expect(msg.dto.senderId).toBe(undefined);
    expect(msg.dto.messageType).toBe(MessageType.ACTIVITY);
    expect(msg.dto.content.includes('1004')).toBeTruthy();
    expect(msg.dto.content.includes('SEPAY')).toBeTruthy();
    expect(msg.dto.content.includes('TX_SEPAY_111')).toBeTruthy();
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

    expect(createdMessages.length).toBe(1);
    const msg = createdMessages[0];
    expect(msg.workspaceId).toBe(wsId);
    expect(msg.convId).toBe(conversationId);
    expect(msg.dto.senderType).toBe(SenderType.SYSTEM);
    expect(msg.dto.senderId).toBe(undefined);
    expect(msg.dto.messageType).toBe(MessageType.ACTIVITY);
    expect(msg.dto.content.includes('1004')).toBeTruthy();
    expect(msg.dto.content.includes('200.000')).toBeTruthy();
    expect(msg.dto.content.includes('300.000')).toBeTruthy();
    expect(msg.dto.metadata.type).toBe('PAYMENT_RECEIPT');
    expect(msg.dto.metadata.status).toBe('PARTIALLY_PAID');
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

    expect(createdMessages.length).toBe(1);
    const msg = createdMessages[0];
    expect(msg.workspaceId).toBe(wsId);
    expect(msg.convId).toBe(conversationId);
    expect(msg.dto.senderType).toBe(SenderType.SYSTEM);
    expect(msg.dto.messageType).toBe(MessageType.ACTIVITY);
    expect(msg.dto.content.includes('1004')).toBeTruthy();
    expect(msg.dto.content.includes('GHTK')).toBeTruthy();
    expect(msg.dto.content.includes('GHTK998877')).toBeTruthy();
    expect(msg.dto.metadata.type).toBe('ORDER_SHIPPED');
    expect(msg.dto.metadata.trackingCode).toBe('GHTK998877');
  });
});
