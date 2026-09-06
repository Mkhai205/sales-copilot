import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import {
  ANALYZE_INBOUND_MESSAGE_JOB,
  MessageContentType,
  SenderType,
} from '@sales-copilot/shared-contracts';
import { ConversationIntelligenceListener } from '../conversation-intelligence.listener';

describe('ConversationIntelligenceListener (Fast Guardrails & Enqueueing)', () => {
  let listener: ConversationIntelligenceListener;
  let mockQueue: any;
  let enqueuedJobs: Array<{ name: string; data: any; opts: any }>;

  const wsId = 'ws-test-01';
  const convId = 'conv-test-01';
  const msgId = 'msg-test-01';

  beforeEach(() => {
    enqueuedJobs = [];
    mockQueue = {
      add: async (name: string, data: any, opts: any) => {
        enqueuedJobs.push({ name, data, opts });
        return { id: opts?.jobId || 'job-id' };
      },
    };
    listener = new ConversationIntelligenceListener(mockQueue);
  });

  it('should enqueue inbound contact text message with correct jobId and retry options', async () => {
    const payload = {
      workspaceId: wsId,
      conversationId: convId,
      message: {
        id: msgId,
        conversationId: convId,
        senderType: SenderType.CONTACT,
        senderId: 'contact-01',
        isPrivate: false,
        contentType: MessageContentType.TEXT,
        content: 'Bên mình có gói doanh nghiệp cho 50 user không?',
      },
    };

    await listener.handleMessageCreated(payload as any);

    assert.strictEqual(enqueuedJobs.length, 1);
    const job = enqueuedJobs[0];
    assert.strictEqual(job.name, ANALYZE_INBOUND_MESSAGE_JOB);
    assert.strictEqual(job.data.workspaceId, wsId);
    assert.strictEqual(job.data.conversationId, convId);
    assert.strictEqual(job.data.messageId, msgId);
    assert.strictEqual(job.data.contactId, 'contact-01');
    assert.strictEqual(job.opts.jobId, `job:analyze:${msgId}`);
    assert.strictEqual(job.opts.attempts, 3);
    assert.strictEqual(job.opts.backoff?.type, 'exponential');
  });

  it('should ignore messages from internal agents (USER)', async () => {
    const payload = {
      workspaceId: wsId,
      conversationId: convId,
      message: {
        id: 'msg-user-1',
        conversationId: convId,
        senderType: SenderType.USER,
        senderId: 'user-01',
        isPrivate: false,
        contentType: MessageContentType.TEXT,
        content: 'Dạ bên em có ạ, em xin gửi bảng giá.',
      },
    };

    await listener.handleMessageCreated(payload as any);
    assert.strictEqual(enqueuedJobs.length, 0);
  });

  it('should ignore private notes even if authored by contacts or system', async () => {
    const payload = {
      workspaceId: wsId,
      conversationId: convId,
      message: {
        id: 'msg-private-1',
        conversationId: convId,
        senderType: SenderType.CONTACT,
        isPrivate: true,
        contentType: MessageContentType.TEXT,
        content: 'Ghi chú nội bộ bí mật',
      },
    };

    await listener.handleMessageCreated(payload as any);
    assert.strictEqual(enqueuedJobs.length, 0);
  });

  it('should ignore empty content or non-text messages', async () => {
    const emptyPayload = {
      workspaceId: wsId,
      conversationId: convId,
      message: {
        id: 'msg-empty',
        conversationId: convId,
        senderType: SenderType.CONTACT,
        isPrivate: false,
        contentType: MessageContentType.TEXT,
        content: '   ',
      },
    };

    await listener.handleMessageCreated(emptyPayload as any);
    assert.strictEqual(enqueuedJobs.length, 0);

    const nonTextPayload = {
      workspaceId: wsId,
      conversationId: convId,
      message: {
        id: 'msg-file',
        conversationId: convId,
        senderType: SenderType.CONTACT,
        isPrivate: false,
        contentType: MessageContentType.FILE,
        content: '',
      },
    };

    await listener.handleMessageCreated(nonTextPayload as any);
    assert.strictEqual(enqueuedJobs.length, 0);
  });
});
