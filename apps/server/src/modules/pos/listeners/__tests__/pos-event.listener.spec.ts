import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  MessageType,
  OpportunityStage,
  SenderType,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { PosEventListener } from '../pos-event.listener';

describe('PosEventListener (Realtime Chat Receipt & CRM Sync)', () => {
  let listener: PosEventListener;
  let mockMessagesService: any;
  let mockOpportunitiesService: any;

  let createdMessages: Array<any>;
  let updatedOpportunities: Array<any>;

  const wsId = 'ws-listener-test';
  const orderId = 'order-test-123';
  const conversationId = 'conv-test-456';
  const opportunityId = 'opp-test-789';

  beforeEach(() => {
    createdMessages = [];
    updatedOpportunities = [];

    mockMessagesService = {
      create: async (workspaceId: string, convId: string, dto: any) => {
        createdMessages.push({ workspaceId, convId, dto });
        return { id: 'msg-123', ...dto };
      },
    };

    mockOpportunitiesService = {
      updateStage: async (workspaceId: string, id: string, dto: any, role: any) => {
        updatedOpportunities.push({ workspaceId, id, dto, role });
        return { id, stage: dto.stage };
      },
    };

    listener = new PosEventListener(mockMessagesService, mockOpportunitiesService);
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

  it('should sync CRM opportunity to CLOSED_WON on ORDER_PAID', async () => {
    await listener.handleOrderPaid({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      opportunityId,
      paidAmount: 500000,
    });

    assert.strictEqual(updatedOpportunities.length, 1);
    const opp = updatedOpportunities[0];
    assert.strictEqual(opp.workspaceId, wsId);
    assert.strictEqual(opp.id, opportunityId);
    assert.strictEqual(opp.dto.stage, OpportunityStage.CLOSED_WON);
    assert.strictEqual(opp.role, WorkspaceRole.ADMIN);
  });

  it('should perform both chat receipt and CRM sync when both IDs are present', async () => {
    await listener.handleOrderPaid({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      conversationId,
      opportunityId,
      paidAmount: 500000,
    });

    assert.strictEqual(createdMessages.length, 1);
    assert.strictEqual(updatedOpportunities.length, 1);
  });

  it('should isolate errors when messagesService fails and continue CRM sync', async () => {
    mockMessagesService.create = async () => {
      throw new Error('Chat service network timeout');
    };

    await listener.handleOrderPaid({
      workspaceId: wsId,
      orderId,
      displayId: 1004,
      conversationId,
      opportunityId,
      paidAmount: 500000,
    });

    // Message creation failed, but opportunity sync must still succeed
    assert.strictEqual(updatedOpportunities.length, 1);
    assert.strictEqual(updatedOpportunities[0].dto.stage, OpportunityStage.CLOSED_WON);
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
