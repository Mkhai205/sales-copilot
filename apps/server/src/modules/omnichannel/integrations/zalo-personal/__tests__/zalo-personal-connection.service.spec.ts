import { ZaloPersonalConnectionService } from '../zalo-personal-connection.service';
import { ZaloPersonalClientProvider } from '../zalo-personal-client.provider';
import { ChannelCredentialService } from '../../../../../infrastructure/crypto/channel-credential.service';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../../infrastructure/database/prisma.service';
import { ChannelType } from '@sales-copilot/shared-contracts';

const WS_ID = 'ws_1';
const CHAN_ID = 'chan_zp_1';
const INBOX_ID = 'inbox_1';

function buildListenerMessage(overrides: Record<string, unknown> = {}) {
  return {
    type: 0, // ThreadType.User
    threadId: 'counterpart_user',
    isSelf: false,
    data: {
      msgId: `m_${Math.random().toString(36).slice(2, 8)}`,
      content: 'Xin chào shop',
      attach: '[]',
      ...overrides,
    },
    ...overrides,
  } as any;
}

describe('ZaloPersonalConnectionService (listener ingestion & connect)', () => {
  let service: ZaloPersonalConnectionService;
  let credentialService: ChannelCredentialService;
  let channelsDb: Map<string, any>;
  let messagesDb: Map<string, any>;
  let conversationsDb: Map<string, any>;
  let createdMessages: any[];
  let webhooksService: { handleInboundWebhook: jest.Mock };
  let messagesService: { create: jest.Mock };

  beforeEach(() => {
    channelsDb = new Map();
    messagesDb = new Map();
    conversationsDb = new Map();
    createdMessages = [];

    channelsDb.set(CHAN_ID, {
      id: CHAN_ID,
      workspaceId: WS_ID,
      inboxId: INBOX_ID,
      channelType: ChannelType.ZALO_PERSONAL,
      providerAccountId: 'own_id_1',
      credentials: {
        encrypted: new ChannelCredentialService({
          get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        } as unknown as ConfigService).encrypt({
          imei: 'imei_x',
          cookie: [{ name: 'zuid', value: 'v' }],
          userAgent: 'UA',
          ownUserId: 'own_id_1',
        }),
      },
      settings: { connectedByUserId: 'member_1' },
      isConnected: true,
    });

    const clientMock = {
      channel: {
        create: async ({ data }: { data: any }) => {
          const channel = { id: 'chan_new', isConnected: false, ...data };
          channelsDb.set(channel.id, channel);
          return channel;
        },
        findUnique: async ({ where }: { where: { id: string } }) =>
          channelsDb.get(where.id) || null,
        findFirst: async ({ where }: { where: any }) => {
          if (where.providerAccountId) {
            for (const ch of channelsDb.values()) {
              if (ch.providerAccountId === where.providerAccountId) return { ...ch };
            }
            return null;
          }
          const c = channelsDb.get(where.id);
          if (!c) return null;
          if (where.workspaceId && c.workspaceId !== where.workspaceId) return null;
          return { ...c };
        },
        findMany: async () => Array.from(channelsDb.values()).map(ch => ({ ...ch })),
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const updated = { ...channelsDb.get(id), ...data };
          channelsDb.set(id, updated);
          return updated;
        },
        updateMany: async () => ({ count: 0 }),
      },
      message: {
        findFirst: async ({ where }: { where: any }) => {
          for (const m of messagesDb.values()) {
            if (where.externalId && m.externalId !== where.externalId) continue;
            return { ...m };
          }
          return null;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const m = messagesDb.get(where.id) || {};
          const updated = { ...m, ...data };
          messagesDb.set(where.id, updated);
          return updated;
        },
      },
      conversation: {
        findFirst: async ({ where }: { where: any }) => {
          for (const conv of conversationsDb.values()) {
            if (where.inboxId && conv.inboxId !== where.inboxId) continue;
            if (where.workspaceId && conv.workspaceId !== where.workspaceId) continue;
            if (
              where.channelIdentity?.externalContactId &&
              conv.channelIdentity?.externalContactId !== where.channelIdentity.externalContactId
            ) {
              continue;
            }
            return { ...conv };
          }
          return null;
        },
      },
      workspaceMember: {
        findMany: async () => [{ userId: 'member_1' }],
      },
      inbox: { create: async ({ data }: { data: any }) => ({ id: 'inbox_new', ...data }) },
      inboxMember: { createMany: async ({ data }: { data: any[] }) => ({ count: data.length }) },
    };

    const prismaMock = {
      getClient: () => clientMock,
      runInTransaction: async (fn: (txCtx: { tx: unknown }) => Promise<any>) =>
        fn({ tx: clientMock }),
    } as unknown as PrismaService;

    credentialService = new ChannelCredentialService({
      get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    } as unknown as ConfigService);

    webhooksService = { handleInboundWebhook: jest.fn().mockResolvedValue({ success: true }) };
    messagesService = {
      create: jest.fn().mockImplementation(async (_ws, _convId, dto) => {
        const msg = { id: `msg_${createdMessages.length + 1}`, ...dto };
        createdMessages.push(msg);
        messagesDb.set(msg.id, msg);
        return msg;
      }),
    };

    service = new ZaloPersonalConnectionService(
      prismaMock,
      credentialService,
      new ZaloPersonalClientProvider(),
      webhooksService as any,
      messagesService as any,
    );
  });

  describe('handleListenerMessage()', () => {
    it('should push non-self messages into the standard ingestion pipeline', async () => {
      const msg = buildListenerMessage();
      await (service as any).handleListenerMessage(CHAN_ID, msg);

      expect(webhooksService.handleInboundWebhook).toHaveBeenCalledTimes(1);
      const [channelId, envelope, _headers, _query, options] =
        webhooksService.handleInboundWebhook.mock.calls[0];
      expect(channelId).toBe(CHAN_ID);
      expect(envelope.message.msgId).toBe(msg.data.msgId);
      expect(envelope.message.isSelf).toBe(false);
      expect(options).toEqual({ skipSignatureVerification: true });
    });

    it('should ignore group messages', async () => {
      const msg = buildListenerMessage({ type: 1 }); // ThreadType.Group
      await (service as any).handleListenerMessage(CHAN_ID, msg);
      expect(webhooksService.handleInboundWebhook).not.toHaveBeenCalled();
      expect(messagesService.create).not.toHaveBeenCalled();
    });
  });

  describe('self-message ingestion (owner replies from phone)', () => {
    beforeEach(() => {
      conversationsDb.set('conv_1', {
        id: 'conv_1',
        workspaceId: WS_ID,
        inboxId: INBOX_ID,
        channelIdentity: { externalContactId: 'counterpart_user' },
      });
    });

    it('should mirror a phone-sent message as an OUTGOING message with suppressOutbound', async () => {
      const msg = buildListenerMessage({ isSelf: true, content: 'Dạ shop gửi ảnh ngay ạ' });
      await (service as any).handleListenerMessage(CHAN_ID, msg);

      expect(webhooksService.handleInboundWebhook).not.toHaveBeenCalled();
      expect(messagesService.create).toHaveBeenCalledTimes(1);
      const [, conversationId, dto] = messagesService.create.mock.calls[0];
      expect(conversationId).toBe('conv_1');
      expect(dto).toMatchObject({
        senderType: 'USER',
        senderId: 'member_1',
        messageType: 'OUTGOING',
        externalId: msg.data.msgId,
        metadata: { selfMessage: true, suppressOutbound: true },
      });
    });

    it('should skip server-sent messages (loop guard by externalId)', async () => {
      const msg = buildListenerMessage({ isSelf: true });
      messagesDb.set('server_msg', { id: 'server_msg', externalId: msg.data.msgId });

      await (service as any).handleListenerMessage(CHAN_ID, msg);

      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('should skip self messages with media (text-only self ingest)', async () => {
      const msg = buildListenerMessage({
        isSelf: true,
        attach: JSON.stringify([{ type: 'chat.photo', href: 'https://zalo/img.png' }]),
      });
      await (service as any).handleListenerMessage(CHAN_ID, msg);
      expect(messagesService.create).not.toHaveBeenCalled();
    });

    it('should skip self messages when no conversation exists for the counterpart', async () => {
      const msg = buildListenerMessage({ isSelf: true, threadId: 'unknown_user' });
      await (service as any).handleListenerMessage(CHAN_ID, msg);
      expect(messagesService.create).not.toHaveBeenCalled();
    });
  });

  describe('connect() — new channel', () => {
    it('should reject an account that is already connected in the system', async () => {
      (service as any).pendingConnects.set('sess_1', {
        id: 'sess_1',
        workspaceId: WS_ID,
        status: 'connected',
        ownId: 'own_id_1', // same providerAccountId as the seeded channel
        profileName: 'My Zalo',
        credentials: { imei: 'i', cookie: [], userAgent: 'UA' },
        api: { listener: { start: jest.fn(), on: jest.fn() }, getOwnId: jest.fn() },
        expiresAt: Date.now() + 60_000,
      });

      await expect(service.connect(WS_ID, { sessionId: 'sess_1' })).rejects.toMatchObject({
        response: { code: 'ZALO_PERSONAL_ALREADY_CONNECTED' },
      });
    });

    it('should reject sessions belonging to another workspace', async () => {
      (service as any).pendingConnects.set('sess_2', {
        id: 'sess_2',
        workspaceId: 'ws_other',
        status: 'connected',
        ownId: 'own_new',
        credentials: { imei: 'i', cookie: [], userAgent: 'UA' },
        api: { listener: { start: jest.fn(), on: jest.fn() }, getOwnId: jest.fn() },
        expiresAt: Date.now() + 60_000,
      });

      await expect(service.connect(WS_ID, { sessionId: 'sess_2' })).rejects.toMatchObject({
        response: { code: 'ZALO_PERSONAL_SESSION_NOT_FOUND' },
      });
    });

    it('should create an inbox with custom name and avatarUrl when provided', async () => {
      (service as any).pendingConnects.set('sess_new', {
        id: 'sess_new',
        workspaceId: WS_ID,
        status: 'connected',
        ownId: 'own_brand_new',
        profileName: 'Default Zalo Name',
        profileAvatar: 'https://zalo/avatar-default.png',
        credentials: { imei: 'i', cookie: [], userAgent: 'UA' },
        api: { listener: { start: jest.fn(), on: jest.fn() }, getOwnId: jest.fn() },
        expiresAt: Date.now() + 60_000,
      });

      const res = await service.connect(WS_ID, {
        sessionId: 'sess_new',
        name: 'Tên Custom',
        avatarUrl: 'https://cdn/custom-avatar.png',
      });

      expect(res.zaloName).toBe('Tên Custom');
      expect(res.ownId).toBe('own_brand_new');
    });
  });

  describe('QR session & status', () => {
    it('should format raw base64 qrImage as data:image/png;base64 URI', () => {
      const session: any = { status: 'pending' };
      (service as any).handleLoginQREvent(session, {
        type: 0,
        data: { image: 'iVBORw0KGgoAAAANSUhEUgAA' },
      });

      expect(session.status).toBe('qr_ready');
      expect(session.qrImage).toBe('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA');
    });

    it('should return profileAvatar in getConnectSessionStatus', () => {
      (service as any).pendingConnects.set('sess_status', {
        id: 'sess_status',
        workspaceId: WS_ID,
        status: 'connected',
        qrImage: 'data:image/png;base64,xyz',
        profileAvatar: 'https://zalo/avatar.png',
        profileName: 'My Zalo',
        ownId: '12345',
        expiresAt: Date.now() + 60_000,
      });

      const status = service.getConnectSessionStatus(WS_ID, 'sess_status');
      expect(status.profileAvatar).toBe('https://zalo/avatar.png');
      expect(status.qrImage).toBe('data:image/png;base64,xyz');
    });
  });

  describe('completeReauthorize() via connect with bound channel', () => {
    it('should reject a mismatched Zalo account', async () => {
      (service as any).pendingConnects.set('sess_3', {
        id: 'sess_3',
        workspaceId: WS_ID,
        channelId: CHAN_ID,
        status: 'connected',
        ownId: 'attacker_own_id', // different from providerAccountId 'own_id_1'
        profileName: 'Attacker',
        credentials: { imei: 'i', cookie: [], userAgent: 'UA' },
        api: { listener: { start: jest.fn(), on: jest.fn() }, getOwnId: jest.fn() },
        expiresAt: Date.now() + 60_000,
      });

      await expect(service.connect(WS_ID, { sessionId: 'sess_3' })).rejects.toMatchObject({
        response: { code: 'ZALO_PERSONAL_MISMATCH' },
      });
    });

    it('should refresh credentials and re-register the listener on success', async () => {
      const stopListener = jest.fn();
      const api = {
        listener: { start: jest.fn(), stop: stopListener, on: jest.fn() },
        getOwnId: jest.fn().mockResolvedValue('own_id_1'),
        sendMessage: jest.fn(),
        getUserInfo: jest.fn().mockResolvedValue({
          changed_profiles: { own_id_1: { displayName: 'My Zalo', avatar: 'a.png' } },
        }),
      };

      (service as any).pendingConnects.set('sess_4', {
        id: 'sess_4',
        workspaceId: WS_ID,
        channelId: CHAN_ID,
        status: 'connected',
        ownId: 'own_id_1',
        profileName: 'My Zalo',
        credentials: { imei: 'i2', cookie: [{ name: 'zuid', value: 'v2' }], userAgent: 'UA2' },
        api,
        expiresAt: Date.now() + 60_000,
      });

      const result = await service.connect(WS_ID, { sessionId: 'sess_4' });

      expect(result).toMatchObject({ channelId: CHAN_ID, ownId: 'own_id_1' });
      const channel = channelsDb.get(CHAN_ID);
      expect(channel.isConnected).toBe(true);
      const decrypted = credentialService.decryptChannelCredentials(channel.credentials);
      expect(decrypted).toMatchObject({ imei: 'i2', ownUserId: 'own_id_1' });
      expect(channel.settings.reauthorizationRequired).toBe(false);
      // Listener handlers registered on the fresh api
      expect(api.listener.on).toHaveBeenCalled();
      expect(api.listener.start).toHaveBeenCalled();
    });
  });
});
