import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { Job } from 'bullmq';
import {
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  SenderType,
  MessageType,
  MessageContentType,
} from '@sales-copilot/shared-contracts';
import { CommentGuardProcessor, CommentGuardJobData } from '../comment-guard.processor';
import { FacebookRateLimitError } from '../facebook.adapter';

describe('CommentGuardProcessor', () => {
  let processor: CommentGuardProcessor;
  let prismaMock: any;
  let contactResolutionServiceMock: any;
  let conversationsServiceMock: any;
  let messagesServiceMock: any;
  let facebookAdapterMock: any;
  let credentialServiceMock: any;

  let channelsDb: Map<string, any>;
  let contactsDb: Map<string, any>;
  let channelEventsDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let messagesDb: Array<any>;

  let hideCommentCalls: Array<{ credentials: any; commentId: string }>;
  let sendPrivateReplyCalls: Array<{ credentials: any; commentId: string; message: string }>;
  let sendPublicCommentReplyCalls: Array<{ credentials: any; commentId: string; message: string }>;

  const workspaceId = 'ws_cg_test';
  const channelId = 'chan_fb_cg_1';
  const inboxId = 'inbox_fb_1';
  const mockPageId = 'page_123456';

  beforeEach(() => {
    channelsDb = new Map();
    contactsDb = new Map();
    channelEventsDb = new Map();
    conversationsDb = new Map();
    messagesDb = [];

    hideCommentCalls = [];
    sendPrivateReplyCalls = [];
    sendPublicCommentReplyCalls = [];

    // Seed test channel
    channelsDb.set(channelId, {
      id: channelId,
      workspaceId,
      inboxId,
      channelType: 'FACEBOOK_MESSENGER',
      providerAccountId: mockPageId,
      credentials: { pageAccessToken: 'EAA_valid_token' },
      settings: {
        commentGuard: {
          enabled: true,
          publicReplyEnabled: true,
          privateReplyTemplate: 'Custom private reply',
          publicReplyTemplate: 'Custom public reply',
        },
      },
    });

    // Mock Prisma Client
    const clientMock = {
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          const chan = channelsDb.get(where.id);
          if (chan && where.workspaceId && chan.workspaceId !== where.workspaceId) {
            return null;
          }
          return chan || null;
        },
      },
      contact: {
        updateMany: async ({ where, data }: { where: any; data: any }) => {
          if (!where.workspaceId) {
            throw new Error('Multi-tenancy violation: workspaceId is required in where clause');
          }
          const contact = contactsDb.get(where.id);
          if (contact) {
            Object.assign(contact, data);
            return { count: 1 };
          }
          return { count: 0 };
        },
      },
      message: {
        findFirst: async ({ where }: { where: any }) => {
          if (!where.workspaceId) {
            throw new Error('Multi-tenancy violation: workspaceId is required in where clause');
          }
          return (
            messagesDb.find(
              m =>
                m.workspaceId === where.workspaceId &&
                m.conversationId === where.conversationId &&
                m.externalId === where.externalId,
            ) || null
          );
        },
      },
      channelEvent: {
        update: async ({ where, data }: { where: any; data: any }) => {
          const evt = channelEventsDb.get(where.id);
          if (evt) {
            Object.assign(evt, data);
            return evt;
          }
          return null;
        },
      },
    };

    prismaMock = {
      getClient: () => clientMock,
    };

    // Mock ContactResolutionService
    contactResolutionServiceMock = {
      resolveFromChannel: async (params: any) => {
        let contact = contactsDb.get(params.externalContactId);
        if (!contact) {
          contact = {
            id: `contact_${params.externalContactId}`,
            workspaceId: params.workspaceId,
            name: params.contactInfo?.name || 'Customer',
            phoneNumber: params.contactInfo?.phoneNumber || null,
          };
          contactsDb.set(contact.id, contact);
        }
        return {
          contact,
          channelIdentity: {
            id: `ident_${params.externalContactId}`,
            channelId: params.channelId,
            externalContactId: params.externalContactId,
          },
          isNewContact: true,
        };
      },
    };

    // Mock ConversationsService
    conversationsServiceMock = {
      findOrCreateActiveConversation: async (wsId: string, params: any) => {
        const convId = `conv_${params.contactId}_${params.inboxId}`;
        let conv = conversationsDb.get(convId);
        if (!conv) {
          conv = {
            id: convId,
            workspaceId: wsId,
            contactId: params.contactId,
            inboxId: params.inboxId,
            status: 'OPEN',
          };
          conversationsDb.set(convId, conv);
        }
        return conv;
      },
    };

    // Mock MessagesService
    messagesServiceMock = {
      create: async (wsId: string, conversationId: string, dto: any) => {
        const msg = {
          id: `msg_${Date.now()}`,
          workspaceId: wsId,
          conversationId,
          ...dto,
        };
        messagesDb.push(msg);
        return msg;
      },
    };

    // Mock FacebookAdapter
    facebookAdapterMock = {
      hideComment: async (creds: any, commentId: string) => {
        hideCommentCalls.push({ credentials: creds, commentId });
        return true;
      },
      sendPrivateReply: async (creds: any, commentId: string, message: string) => {
        sendPrivateReplyCalls.push({ credentials: creds, commentId, message });
        return { id: `m_pr_${commentId}` };
      },
      sendPublicCommentReply: async (creds: any, commentId: string, message: string) => {
        sendPublicCommentReplyCalls.push({ credentials: creds, commentId, message });
        return { id: `c_reply_${commentId}` };
      },
    };

    credentialServiceMock = {
      decrypt: (str: string) => JSON.parse(str),
    };

    processor = new CommentGuardProcessor(
      prismaMock,
      contactResolutionServiceMock,
      conversationsServiceMock,
      messagesServiceMock,
      facebookAdapterMock,
      credentialServiceMock,
    );
  });

  it('should successfully hide comment, send private reply, post public comment reply, resolve contact and create message', async () => {
    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      channelEventId: 'evt_cg_1',
      commentId: '123456_789012',
      postId: 'post_100',
      senderId: 'psid_user_99',
      senderName: 'Nguyen Van A',
      message: 'Shop oi em lay 2 hop kem size to nhe 0912345678',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    channelEventsDb.set('evt_cg_1', { id: 'evt_cg_1', processedAt: null });

    const job = { id: 'job_1', data: jobData } as Job<CommentGuardJobData>;

    const result = await processor.process(job);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.commentId, '123456_789012');
    assert.strictEqual(result.phoneExtracted, '0912345678');
    assert.strictEqual(result.hidden, true);
    assert.strictEqual(result.privateReplyId, 'm_pr_123456_789012');
    assert.strictEqual(result.publicReplyId, 'c_reply_123456_789012');

    // 1. Hide comment called
    assert.strictEqual(hideCommentCalls.length, 1);
    assert.strictEqual(hideCommentCalls[0].commentId, '123456_789012');

    // 2. Private reply sent with custom template
    assert.strictEqual(sendPrivateReplyCalls.length, 1);
    assert.strictEqual(sendPrivateReplyCalls[0].commentId, '123456_789012');
    assert.strictEqual(sendPrivateReplyCalls[0].message, 'Custom private reply');

    // 3. Public comment reply posted with custom template
    assert.strictEqual(sendPublicCommentReplyCalls.length, 1);
    assert.strictEqual(sendPublicCommentReplyCalls[0].commentId, '123456_789012');
    assert.strictEqual(sendPublicCommentReplyCalls[0].message, 'Custom public reply');

    // 4. Contact resolved with phone number
    const contact = contactsDb.get('contact_psid_user_99');
    assert.ok(contact);
    assert.strictEqual(contact.phoneNumber, '0912345678');

    // 5. Message created
    assert.strictEqual(messagesDb.length, 1);
    assert.strictEqual(messagesDb[0].content, jobData.message);
    assert.strictEqual(messagesDb[0].senderType, SenderType.CONTACT);
    assert.strictEqual(messagesDb[0].metadata.source, 'comment_guard');
    assert.strictEqual(messagesDb[0].metadata.extractedPhone, '0912345678');

    // 6. ChannelEvent marked processed
    const evt = channelEventsDb.get('evt_cg_1');
    assert.ok(evt.processedAt);
  });

  it('should support default templates when custom templates are not configured', async () => {
    // Set channel settings without custom templates
    channelsDb.set(channelId, {
      ...channelsDb.get(channelId),
      settings: {
        commentGuard: {
          enabled: true,
          publicReplyEnabled: true,
        },
      },
    });

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_default_tmpl',
      senderId: 'psid_user_default',
      senderName: 'Le Thi B',
      message: 'Gui em 1 ao 0987654321',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_2', data: jobData } as Job<CommentGuardJobData>;
    await processor.process(job);

    assert.strictEqual(sendPrivateReplyCalls[0].message, DEFAULT_COMMENT_GUARD_PRIVATE_REPLY);
    assert.strictEqual(sendPublicCommentReplyCalls[0].message, DEFAULT_COMMENT_GUARD_PUBLIC_REPLY);
  });

  it('should fail-safe proceed when hideComment throws permission or API error', async () => {
    facebookAdapterMock.hideComment = async () => {
      throw new Error('Graph API error: (#200) Requires pages_manage_engagement permission');
    };

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_failsafe',
      senderId: 'psid_failsafe',
      senderName: 'Tran Van C',
      message: 'Gia sao ban oi 091-234-5678',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_3', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.hidden, false);
    // Private reply & public reply should still execute!
    assert.strictEqual(sendPrivateReplyCalls.length, 1);
    assert.strictEqual(sendPublicCommentReplyCalls.length, 1);
    // Message should still be created
    assert.strictEqual(messagesDb.length, 1);
    assert.strictEqual(messagesDb[0].metadata.hidden, false);
  });

  it('should skip job when no phone number is found in comment text', async () => {
    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_no_phone',
      senderId: 'psid_no_phone',
      message: 'Quan 09 co ship khong shop? Gia 350000d dung khong?',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_4', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'NO_PHONE_DETECTED');
    assert.strictEqual(hideCommentCalls.length, 0);
    assert.strictEqual(sendPrivateReplyCalls.length, 0);
    assert.strictEqual(sendPublicCommentReplyCalls.length, 0);
    assert.strictEqual(messagesDb.length, 0);
  });

  it('should skip job when Comment Guard is disabled on channel', async () => {
    channelsDb.set(channelId, {
      ...channelsDb.get(channelId),
      settings: {
        commentGuard: {
          enabled: false,
        },
      },
    });

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_disabled',
      senderId: 'psid_disabled',
      message: 'Goi em so 0912345678 nhe',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_5', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'GUARD_DISABLED');
    assert.strictEqual(hideCommentCalls.length, 0);
  });

  it('should not post public reply when publicReplyEnabled is false', async () => {
    channelsDb.set(channelId, {
      ...channelsDb.get(channelId),
      settings: {
        commentGuard: {
          enabled: true,
          publicReplyEnabled: false,
        },
      },
    });

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_no_public',
      senderId: 'psid_no_public',
      message: 'Sdt cua em: 090 123 4567',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_6', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phoneExtracted, '0901234567');
    assert.strictEqual(hideCommentCalls.length, 1);
    assert.strictEqual(sendPrivateReplyCalls.length, 1);
    assert.strictEqual(sendPublicCommentReplyCalls.length, 0);
    assert.strictEqual(result.publicReplyId, undefined);
  });

  it('should handle channels not found gracefully with skipped: true', async () => {
    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId: 'non_existent_channel',
      commentId: 'comm_missing_chan',
      senderId: 'psid_1',
      message: '0912345678',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_7', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.skipped, true);
    assert.strictEqual(result.reason, 'CHANNEL_NOT_FOUND');
  });

  it('should rethrow FacebookRateLimitError when hideComment encounters HTTP 429 for BullMQ retry', async () => {
    facebookAdapterMock.hideComment = async () => {
      throw new FacebookRateLimitError('Application request limit reached', 429, 4);
    };

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_ratelimit_hide',
      senderId: 'psid_rl_1',
      message: '0912345678',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_rl_1', data: jobData } as Job<CommentGuardJobData>;

    await assert.rejects(
      async () => {
        await processor.process(job);
      },
      (err: any) => {
        assert.ok(err instanceof FacebookRateLimitError);
        assert.strictEqual(err.status, 429);
        return true;
      },
    );
  });

  it('should rethrow FacebookRateLimitError when sendPrivateReply encounters HTTP 429 for BullMQ retry', async () => {
    facebookAdapterMock.sendPrivateReply = async () => {
      throw new FacebookRateLimitError('Page request limit reached', 429, 32);
    };

    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_ratelimit_pr',
      senderId: 'psid_rl_2',
      message: '0912345678',
      verb: 'add',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_rl_2', data: jobData } as Job<CommentGuardJobData>;

    await assert.rejects(
      async () => {
        await processor.process(job);
      },
      (err: any) => {
        assert.ok(err instanceof FacebookRateLimitError);
        assert.strictEqual(err.status, 429);
        return true;
      },
    );
  });

  it('should handle edited comments and create message with edit metadata', async () => {
    const jobData: CommentGuardJobData = {
      workspaceId,
      channelId,
      commentId: 'comm_edited_1',
      senderId: 'psid_edit_user',
      senderName: 'Hoang Van D',
      message: 'Em sua them sdt nhe 091. 234 . 5678',
      verb: 'edited',
      timestamp: new Date().toISOString(),
    };

    const job = { id: 'job_edit_1', data: jobData } as Job<CommentGuardJobData>;
    const result = await processor.process(job);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.phoneExtracted, '0912345678');
    assert.strictEqual(messagesDb.length, 1);
    assert.strictEqual(messagesDb[0].metadata.verb, 'edited');
    assert.ok(messagesDb[0].externalId.startsWith('fb_comment_comm_edited_1_edit_'));
  });
});
