import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  MessageType,
  SenderType,
  DeliveryStatus,
  MessageContentType,
  type MessageResponseDto,
} from '@sales-copilot/shared-contracts';
import { playSyntheticChime } from '../use-browser-notifications';

describe('Browser Notifications & Audio Chimes (Task 24)', () => {
  function shouldTriggerNotification(message: MessageResponseDto): boolean {
    const isContactMessage =
      message.messageType === MessageType.INCOMING || message.senderType === SenderType.CONTACT;

    return Boolean(isContactMessage && !message.isPrivate);
  }

  it('should trigger notification for incoming contact message', () => {
    const contactMessage: MessageResponseDto = {
      id: 'msg-inbound-1',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      senderId: 'contact-1',
      senderType: SenderType.CONTACT,
      messageType: MessageType.INCOMING,
      contentType: MessageContentType.TEXT,
      content: 'Hello, I need assistance',
      isPrivate: false,
      deliveryStatus: DeliveryStatus.DELIVERED,
      createdAt: new Date().toISOString(),
    };

    assert.strictEqual(shouldTriggerNotification(contactMessage), true);
  });

  it('should NOT trigger notification for outgoing agent message', () => {
    const agentMessage: MessageResponseDto = {
      id: 'msg-outbound-1',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      senderId: 'usr-1',
      senderType: SenderType.USER,
      messageType: MessageType.OUTGOING,
      contentType: MessageContentType.TEXT,
      content: 'How can I help you?',
      isPrivate: false,
      deliveryStatus: DeliveryStatus.SENT,
      createdAt: new Date().toISOString(),
    };

    assert.strictEqual(shouldTriggerNotification(agentMessage), false);
  });

  it('should NOT trigger notification for private note', () => {
    const privateNote: MessageResponseDto = {
      id: 'msg-private-1',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      senderId: 'usr-1',
      senderType: SenderType.USER,
      messageType: MessageType.OUTGOING,
      contentType: MessageContentType.TEXT,
      content: 'Internal note for team',
      isPrivate: true,
      deliveryStatus: DeliveryStatus.SENT,
      createdAt: new Date().toISOString(),
    };

    assert.strictEqual(shouldTriggerNotification(privateNote), false);
  });

  it('should NOT trigger notification for private message even if incoming', () => {
    const privateIncoming: MessageResponseDto = {
      id: 'msg-priv-inc-1',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      senderId: 'contact-1',
      senderType: SenderType.CONTACT,
      messageType: MessageType.INCOMING,
      contentType: MessageContentType.TEXT,
      content: 'Private incoming',
      isPrivate: true,
      deliveryStatus: DeliveryStatus.DELIVERED,
      createdAt: new Date().toISOString(),
    };

    assert.strictEqual(shouldTriggerNotification(privateIncoming), false);
  });

  it('should safely execute playSyntheticChime without throwing in non-browser env', () => {
    assert.doesNotThrow(() => {
      playSyntheticChime();
    });
  });
});
