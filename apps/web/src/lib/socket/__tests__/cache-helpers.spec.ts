import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type { InfiniteData } from '@tanstack/react-query';
import type { ApiResponse } from '../../api/client';
import {
  DeliveryStatus,
  MessageContentType,
  MessageType,
  Priority,
  SenderType,
  ConversationStatus,
  type ConversationResponseDto,
  type MessageResponseDto,
} from '@sales-copilot/shared-contracts';
import {
  appendMessageToInfiniteData,
  bubbleConversationToTop,
  markMessageFailedInInfiniteData,
  reconcileOrAppendMessage,
  removeMessageFromInfiniteData,
  updateConversationInList,
  updateMessageInInfiniteData,
} from '../cache-helpers';

describe('Realtime Cache Helpers (Task 22)', () => {
  const dummyMessage1: MessageResponseDto = {
    id: 'msg-1',
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    senderId: 'usr-1',
    senderType: SenderType.USER,
    messageType: MessageType.OUTGOING,
    contentType: MessageContentType.TEXT,
    content: 'Hello World',
    isPrivate: false,
    deliveryStatus: DeliveryStatus.SENT,
    createdAt: '2026-08-31T10:00:00.000Z',
    updatedAt: '2026-08-31T10:00:00.000Z',
  };

  const dummyMessage2: MessageResponseDto = {
    id: 'msg-2',
    workspaceId: 'ws-1',
    conversationId: 'conv-1',
    senderId: 'contact-1',
    senderType: SenderType.CONTACT,
    messageType: MessageType.INCOMING,
    contentType: MessageContentType.TEXT,
    content: 'Hi there',
    isPrivate: false,
    deliveryStatus: DeliveryStatus.DELIVERED,
    createdAt: '2026-08-31T10:05:00.000Z',
    updatedAt: '2026-08-31T10:05:00.000Z',
  };

  const initialMessageData: InfiniteData<ApiResponse<MessageResponseDto[]>> = {
    pages: [
      {
        success: true,
        data: [dummyMessage1],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
      },
    ],
    pageParams: [1],
  };

  const dummyConv1: ConversationResponseDto = {
    id: 'conv-1',
    displayId: 101,
    workspaceId: 'ws-1',
    inboxId: 'inbox-1',
    contactId: 'contact-1',
    status: ConversationStatus.OPEN,
    priority: Priority.MEDIUM,
    unreadMessagesCount: 0,
    lastActivityAt: '2026-08-31T10:00:00.000Z',
    createdAt: '2026-08-31T09:00:00.000Z',
    updatedAt: '2026-08-31T10:00:00.000Z',
  };

  const dummyConv2: ConversationResponseDto = {
    id: 'conv-2',
    displayId: 102,
    workspaceId: 'ws-1',
    inboxId: 'inbox-1',
    contactId: 'contact-2',
    status: ConversationStatus.OPEN,
    priority: Priority.LOW,
    unreadMessagesCount: 1,
    lastActivityAt: '2026-08-31T10:10:00.000Z',
    createdAt: '2026-08-31T09:30:00.000Z',
    updatedAt: '2026-08-31T10:10:00.000Z',
  };

  const initialConvData: InfiniteData<ApiResponse<ConversationResponseDto[]>> = {
    pages: [
      {
        success: true,
        data: [dummyConv2, dummyConv1],
        meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
      },
    ],
    pageParams: [1],
  };

  describe('appendMessageToInfiniteData', () => {
    it('should append a new message and increase total', () => {
      const result = appendMessageToInfiniteData(initialMessageData, dummyMessage2);
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 2);
      assert.strictEqual(result.pages[0].data[1].id, 'msg-2');
      assert.strictEqual(result.pages[0].meta?.total, 2);
    });

    it('should not duplicate if message already exists', () => {
      const result = appendMessageToInfiniteData(initialMessageData, dummyMessage1);
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 1);
      assert.strictEqual(result.pages[0].meta?.total, 1);
    });

    it('should return undefined if oldData is undefined', () => {
      const result = appendMessageToInfiniteData(undefined, dummyMessage1);
      assert.strictEqual(result, undefined);
    });
  });

  describe('updateMessageInInfiniteData', () => {
    it('should update message fields immutably', () => {
      const updated = updateMessageInInfiniteData(initialMessageData, {
        id: 'msg-1',
        content: 'Updated Content',
        deliveryStatus: DeliveryStatus.READ,
      });
      assert.ok(updated);
      assert.strictEqual(updated.pages[0].data?.[0].content, 'Updated Content');
      assert.strictEqual(updated.pages[0].data?.[0].deliveryStatus, DeliveryStatus.READ);
    });

    it('should return unchanged data if message ID not found', () => {
      const updated = updateMessageInInfiniteData(initialMessageData, {
        id: 'non-existent',
        content: 'Nope',
      });
      assert.strictEqual(updated, initialMessageData);
    });
  });

  describe('removeMessageFromInfiniteData', () => {
    it('should remove message by ID and decrement total', () => {
      const result = removeMessageFromInfiniteData(initialMessageData, 'msg-1');
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 0);
      assert.strictEqual(result.pages[0].meta?.total, 0);
    });

    it('should return unchanged data if message ID not found', () => {
      const result = removeMessageFromInfiniteData(initialMessageData, 'non-existent');
      assert.strictEqual(result, initialMessageData);
    });
  });

  describe('updateConversationInList', () => {
    it('should update conversation fields in list', () => {
      const result = updateConversationInList(initialConvData, 'conv-1', {
        status: ConversationStatus.RESOLVED,
        priority: Priority.URGENT,
      });
      assert.ok(result);
      const conv = result.pages[0].data?.find(c => c.id === 'conv-1');
      assert.strictEqual(conv?.status, ConversationStatus.RESOLVED);
      assert.strictEqual(conv?.priority, Priority.URGENT);
    });

    it('should support functional updater', () => {
      const result = updateConversationInList(initialConvData, 'conv-1', prev => ({
        ...prev,
        unreadMessagesCount: (prev.unreadMessagesCount ?? 0) + 5,
      }));
      assert.ok(result);
      const conv = result.pages[0].data?.find(c => c.id === 'conv-1');
      assert.strictEqual(conv?.unreadMessagesCount, 5);
    });
  });

  describe('bubbleConversationToTop', () => {
    it('should update and move conversation to index 0 of page 0', () => {
      // In initialConvData, conv-2 is at [0] and conv-1 is at [1]
      const { updatedData, found } = bubbleConversationToTop(initialConvData, 'conv-1', {
        lastActivityAt: '2026-08-31T11:00:00.000Z',
      });

      assert.strictEqual(found, true);
      assert.ok(updatedData);
      assert.strictEqual(updatedData.pages[0].data?.[0].id, 'conv-1');
      assert.strictEqual(updatedData.pages[0].data?.[0].lastActivityAt, '2026-08-31T11:00:00.000Z');
      assert.strictEqual(updatedData.pages[0].data?.[1].id, 'conv-2');
    });

    it('should return found=false if conversation not present', () => {
      const { updatedData, found } = bubbleConversationToTop(initialConvData, 'non-existent', {
        lastActivityAt: '2026-08-31T11:00:00.000Z',
      });

      assert.strictEqual(found, false);
      assert.strictEqual(updatedData, initialConvData);
    });
  });

  describe('reconcileOrAppendMessage (Task 23)', () => {
    const tempMessage: MessageResponseDto = {
      id: 'temp-123',
      workspaceId: 'ws-1',
      conversationId: 'conv-1',
      senderId: 'usr-1',
      senderType: SenderType.USER,
      messageType: MessageType.OUTGOING,
      contentType: MessageContentType.TEXT,
      content: 'Optimistic Message',
      isPrivate: false,
      deliveryStatus: DeliveryStatus.PENDING,
      metadata: { clientTempId: 'temp-123' },
      createdAt: '2026-08-31T10:00:00.000Z',
    };

    const cacheWithTempMessage: InfiniteData<ApiResponse<MessageResponseDto[]>> = {
      pages: [
        {
          success: true,
          data: [dummyMessage1, tempMessage],
          meta: { page: 1, limit: 20, total: 2, totalPages: 1, hasMore: false },
        },
      ],
      pageParams: [1],
    };

    it('should reconcile optimistic message by clientTempId in-place', () => {
      const serverMessage: MessageResponseDto = {
        id: 'msg-server-999',
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        senderId: 'usr-1',
        senderType: SenderType.USER,
        messageType: MessageType.OUTGOING,
        contentType: MessageContentType.TEXT,
        content: 'Optimistic Message',
        isPrivate: false,
        deliveryStatus: DeliveryStatus.SENT,
        metadata: { clientTempId: 'temp-123' },
        createdAt: '2026-08-31T10:00:01.000Z',
      };

      const result = reconcileOrAppendMessage(cacheWithTempMessage, serverMessage);
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 2);
      // Index 1 was tempMessage, should now be serverMessage
      assert.strictEqual(result.pages[0].data[1].id, 'msg-server-999');
      assert.strictEqual(result.pages[0].data[1].deliveryStatus, DeliveryStatus.SENT);
    });

    it('should update existing server message if ID already exists (idempotent)', () => {
      const updatedServerMessage: MessageResponseDto = {
        ...dummyMessage1,
        content: 'Hello World (Server Updated)',
        deliveryStatus: DeliveryStatus.DELIVERED,
      };

      const result = reconcileOrAppendMessage(initialMessageData, updatedServerMessage);
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 1);
      assert.strictEqual(result.pages[0].data[0].content, 'Hello World (Server Updated)');
      assert.strictEqual(result.pages[0].data[0].deliveryStatus, DeliveryStatus.DELIVERED);
    });

    it('should append as new message if no optimistic tempId or ID match', () => {
      const newInboundMessage: MessageResponseDto = {
        id: 'msg-inbound-555',
        workspaceId: 'ws-1',
        conversationId: 'conv-1',
        senderId: 'contact-2',
        senderType: SenderType.CONTACT,
        messageType: MessageType.INCOMING,
        contentType: MessageContentType.TEXT,
        content: 'New message from another customer',
        isPrivate: false,
        deliveryStatus: DeliveryStatus.DELIVERED,
        createdAt: '2026-08-31T10:20:00.000Z',
      };

      const result = reconcileOrAppendMessage(initialMessageData, newInboundMessage);
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.length, 2);
      assert.strictEqual(result.pages[0].data[1].id, 'msg-inbound-555');
    });
  });

  describe('markMessageFailedInInfiniteData (Task 23)', () => {
    it('should update optimistic message deliveryStatus to FAILED', () => {
      const cacheWithTemp: InfiniteData<ApiResponse<MessageResponseDto[]>> = {
        pages: [
          {
            success: true,
            data: [
              {
                ...dummyMessage1,
                id: 'temp-failed-1',
                deliveryStatus: DeliveryStatus.PENDING,
              },
            ],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
          },
        ],
        pageParams: [1],
      };

      const result = markMessageFailedInInfiniteData(cacheWithTemp, 'temp-failed-1');
      assert.ok(result);
      assert.strictEqual(result.pages[0].data?.[0].deliveryStatus, DeliveryStatus.FAILED);
    });
  });
});
