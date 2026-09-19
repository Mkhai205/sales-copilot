import { expectReject } from '../../../../../../test/test-assertions';
import { Job } from 'bullmq';
import {
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  SenderType,
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

    expect(result.success).toBe(true);
    expect(result.commentId).toBe('123456_789012');
    expect(result.phoneExtracted).toBe('0912345678');
    expect(result.hidden).toBe(true);
    expect(result.privateReplyId).toBe('m_pr_123456_789012');
    expect(result.publicReplyId).toBe('c_reply_123456_789012');

    // 1. Hide comment called
    expect(hideCommentCalls.length).toBe(1);
    expect(hideCommentCalls[0].commentId).toBe('123456_789012');

    // 2. Private reply sent with custom template
    expect(sendPrivateReplyCalls.length).toBe(1);
    expect(sendPrivateReplyCalls[0].commentId).toBe('123456_789012');
    expect(sendPrivateReplyCalls[0].message).toBe('Custom private reply');

    // 3. Public comment reply posted with custom template
    expect(sendPublicCommentReplyCalls.length).toBe(1);
    expect(sendPublicCommentReplyCalls[0].commentId).toBe('123456_789012');
    expect(sendPublicCommentReplyCalls[0].message).toBe('Custom public reply');

    // 4. Contact resolved with phone number
    const contact = contactsDb.get('contact_psid_user_99');
    expect(contact).toBeTruthy();
    expect(contact.phoneNumber).toBe('0912345678');

    // 5. Message created
    expect(messagesDb.length).toBe(1);
    expect(messagesDb[0].content).toBe(jobData.message);
    expect(messagesDb[0].senderType).toBe(SenderType.CONTACT);
    expect(messagesDb[0].metadata.source).toBe('comment_guard');
    expect(messagesDb[0].metadata.extractedPhone).toBe('0912345678');

    // 6. ChannelEvent marked processed
    const evt = channelEventsDb.get('evt_cg_1');
    expect(evt.processedAt).toBeTruthy();
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

    expect(sendPrivateReplyCalls[0].message).toBe(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY);
    expect(sendPublicCommentReplyCalls[0].message).toBe(DEFAULT_COMMENT_GUARD_PUBLIC_REPLY);
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

    expect(result.success).toBe(true);
    expect(result.hidden).toBe(false);
    // Private reply & public reply should still execute!
    expect(sendPrivateReplyCalls.length).toBe(1);
    expect(sendPublicCommentReplyCalls.length).toBe(1);
    // Message should still be created
    expect(messagesDb.length).toBe(1);
    expect(messagesDb[0].metadata.hidden).toBe(false);
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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('NO_PHONE_DETECTED');
    expect(hideCommentCalls.length).toBe(0);
    expect(sendPrivateReplyCalls.length).toBe(0);
    expect(sendPublicCommentReplyCalls.length).toBe(0);
    expect(messagesDb.length).toBe(0);
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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('GUARD_DISABLED');
    expect(hideCommentCalls.length).toBe(0);
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

    expect(result.success).toBe(true);
    expect(result.phoneExtracted).toBe('0901234567');
    expect(hideCommentCalls.length).toBe(1);
    expect(sendPrivateReplyCalls.length).toBe(1);
    expect(sendPublicCommentReplyCalls.length).toBe(0);
    expect(result.publicReplyId).toBe(undefined);
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

    expect(result.skipped).toBe(true);
    expect(result.reason).toBe('CHANNEL_NOT_FOUND');
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

    await expectReject(
      async () => {
        await processor.process(job);
      },
      (err: any) => {
        expect(err instanceof FacebookRateLimitError).toBeTruthy();
        expect(err.status).toBe(429);
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

    await expectReject(
      async () => {
        await processor.process(job);
      },
      (err: any) => {
        expect(err instanceof FacebookRateLimitError).toBeTruthy();
        expect(err.status).toBe(429);
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

    expect(result.success).toBe(true);
    expect(result.phoneExtracted).toBe('0912345678');
    expect(messagesDb.length).toBe(1);
    expect(messagesDb[0].metadata.verb).toBe('edited');
    expect(messagesDb[0].externalId.startsWith('fb_comment_comm_edited_1_edit_')).toBeTruthy();
  });
});
