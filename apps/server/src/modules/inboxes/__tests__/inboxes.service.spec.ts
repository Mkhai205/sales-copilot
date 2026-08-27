import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { InboxesService } from '../inboxes.service';
import { ChannelCredentialService } from '../channel-credential.service';
import { ConfigService } from '@nestjs/config';

describe('InboxesService (Inbox & Channel 1:1 CRUD & Security)', () => {
  let service: InboxesService;
  let credentialService: ChannelCredentialService;
  let inboxesDb: Map<string, any>;
  let channelsDb: Map<string, any>;
  let inboxMembersDb: Map<string, any>;

  const wsAlpha = 'ws_alpha_1';
  const wsBeta = 'ws_beta_2';

  beforeEach(() => {
    inboxesDb = new Map();
    channelsDb = new Map();
    inboxMembersDb = new Map();

    const mockConfigService = {
      get: () => '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    };
    credentialService = new ChannelCredentialService(mockConfigService as unknown as ConfigService);

    const clientMock = {
      inbox: {
        findMany: async ({ where }: { where: { workspaceId: string } }) => {
          const results: any[] = [];
          for (const inbox of inboxesDb.values()) {
            if (inbox.workspaceId === where.workspaceId) {
              const channel = Array.from(channelsDb.values()).find(
                c => c.inboxId === inbox.id && c.workspaceId === where.workspaceId,
              );
              const members = Array.from(inboxMembersDb.values()).filter(
                m => m.inboxId === inbox.id,
              );
              results.push({
                ...inbox,
                channel: channel || null,
                _count: { members: members.length },
              });
            }
          }
          return results;
        },
        findFirst: async ({ where }: { where: { id: string; workspaceId?: string } }) => {
          const inbox = inboxesDb.get(where.id);
          if (!inbox) return null;
          if (where.workspaceId && inbox.workspaceId !== where.workspaceId) return null;

          const channel = Array.from(channelsDb.values()).find(
            c =>
              c.inboxId === inbox.id && (!where.workspaceId || c.workspaceId === where.workspaceId),
          );
          const members = Array.from(inboxMembersDb.values()).filter(m => m.inboxId === inbox.id);

          return {
            ...inbox,
            channel: channel || null,
            _count: { members: members.length },
          };
        },
        create: async ({ data }: { data: any }) => {
          const newInbox = {
            id: `ib_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          inboxesDb.set(newInbox.id, newInbox);
          return newInbox;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = inboxesDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          inboxesDb.set(where.id, updated);
          return updated;
        },
        delete: async ({ where }: { where: { id: string } }) => {
          const existing = inboxesDb.get(where.id);
          inboxesDb.delete(where.id);
          // Cascade delete channel and members
          for (const [id, ch] of channelsDb.entries()) {
            if (ch.inboxId === where.id) channelsDb.delete(id);
          }
          for (const [id, m] of inboxMembersDb.entries()) {
            if (m.inboxId === where.id) inboxMembersDb.delete(id);
          }
          return existing;
        },
      },
      channel: {
        findFirst: async ({ where }: { where: any }) => {
          for (const ch of channelsDb.values()) {
            let match = true;
            if (where.workspaceId && ch.workspaceId !== where.workspaceId) match = false;
            if (where.channelType && ch.channelType !== where.channelType) match = false;
            if (where.providerAccountId && ch.providerAccountId !== where.providerAccountId)
              match = false;
            if (where.NOT?.id && ch.id === where.NOT.id) match = false;
            if (match) return ch;
          }
          return null;
        },
        create: async ({ data }: { data: any }) => {
          const newChannel = {
            id: `chn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          channelsDb.set(newChannel.id, newChannel);
          return newChannel;
        },
        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = channelsDb.get(where.id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          channelsDb.set(where.id, updated);
          return updated;
        },
      },
    };

    const mockPrismaService: any = {
      getClient: () => clientMock,
      runInTransaction: async (cb: (ctx: any) => Promise<any>) => {
        return cb({ tx: clientMock });
      },
    };

    service = new InboxesService(mockPrismaService, credentialService);
  });

  describe('Create Inbox and Channel (1:1 Binding)', () => {
    it('should create an inbox and channel with encrypted credentials in a transaction', async () => {
      const plainCredentials = {
        botToken: '123456:ABC-DEF-SECRET-TOKEN',
        webhookSecret: 'my_wh_secret_999',
      };

      const result = await service.createInbox(wsAlpha, {
        name: 'Telegram Support Inbox',
        channelType: ChannelType.TELEGRAM,
        greetingMessage: 'Xin chào! Chúng tôi có thể giúp gì cho bạn?',
        isAutoAssignmentEnabled: true,
        channelCredentials: plainCredentials,
        providerAccountId: 'bot_support_xyz',
      });

      assert.ok(result.id);
      assert.strictEqual(result.name, 'Telegram Support Inbox');
      assert.strictEqual(result.channelType, ChannelType.TELEGRAM);
      assert.strictEqual(result.greetingMessage, 'Xin chào! Chúng tôi có thể giúp gì cho bạn?');
      assert.strictEqual(result.isAutoAssignmentEnabled, true);
      assert.strictEqual(result.memberCount, 0);

      // Verify channel info and masked credentials in response
      assert.ok(result.channel);
      assert.strictEqual(result.channel.providerAccountId, 'bot_support_xyz');
      assert.deepStrictEqual(result.channel.credentials, { isConfigured: true, hasSecret: true });

      // Verify raw database state: credentials MUST be encrypted
      const storedChannel = Array.from(channelsDb.values()).find(c => c.inboxId === result.id);
      assert.ok(storedChannel);
      assert.ok(storedChannel.credentials.encrypted, 'Database must store encrypted credentials');
      assert.notStrictEqual(storedChannel.credentials.encrypted, JSON.stringify(plainCredentials));
      assert.strictEqual(storedChannel.credentials.encrypted.split(':').length, 3);
    });

    it('should throw ConflictException (CHANNEL_ALREADY_EXISTS) when duplicate providerAccountId in same workspace', async () => {
      await service.createInbox(wsAlpha, {
        name: 'Facebook Page 1',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: 'page_123456',
      });

      await assert.rejects(
        () =>
          service.createInbox(wsAlpha, {
            name: 'Duplicate Facebook Page',
            channelType: ChannelType.FACEBOOK_MESSENGER,
            providerAccountId: 'page_123456',
          }),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'CHANNEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same providerAccountId across different workspaces (Tenant Isolation)', async () => {
      const inboxAlpha = await service.createInbox(wsAlpha, {
        name: 'FB Alpha',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: 'shared_page_id',
      });

      const inboxBeta = await service.createInbox(wsBeta, {
        name: 'FB Beta',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: 'shared_page_id',
      });

      assert.ok(inboxAlpha.id);
      assert.ok(inboxBeta.id);
      assert.notStrictEqual(inboxAlpha.id, inboxBeta.id);
    });
  });

  describe('List Inboxes', () => {
    it('should list all inboxes in workspace and OMIT credentials from channel summary', async () => {
      await service.createInbox(wsAlpha, {
        name: 'Zalo Inbox',
        channelType: ChannelType.ZALO,
        channelCredentials: { secret: 'zalo_secret_123' },
      });

      await service.createInbox(wsAlpha, {
        name: 'Email Inbox',
        channelType: ChannelType.EMAIL,
        channelCredentials: { smtpPass: 'smtp_secret_pass' },
      });

      const inboxes = await service.listInboxes(wsAlpha);
      assert.strictEqual(inboxes.length, 2);

      for (const inbox of inboxes) {
        assert.ok(inbox.channel);
        assert.strictEqual(
          (inbox.channel as any).credentials,
          undefined,
          'List endpoint must NEVER expose credentials in channel summary',
        );
      }
    });

    it('should only return inboxes belonging to the requesting workspace (Tenant Isolation)', async () => {
      await service.createInbox(wsAlpha, {
        name: 'Alpha Inbox 1',
        channelType: ChannelType.WEB_CHAT,
      });

      await service.createInbox(wsBeta, {
        name: 'Beta Inbox 1',
        channelType: ChannelType.WEB_CHAT,
      });

      const alphaList = await service.listInboxes(wsAlpha);
      const betaList = await service.listInboxes(wsBeta);

      assert.strictEqual(alphaList.length, 1);
      assert.strictEqual(alphaList[0].name, 'Alpha Inbox 1');

      assert.strictEqual(betaList.length, 1);
      assert.strictEqual(betaList[0].name, 'Beta Inbox 1');
    });
  });

  describe('Get Inbox Detail', () => {
    it('should return detailed inbox info with masked credentials', async () => {
      const credentials = { apiKey: 'key_live_9999', apiSecret: 'sec_live_8888' };
      const created = await service.createInbox(wsAlpha, {
        name: 'Support Line',
        channelType: ChannelType.TELEGRAM,
        channelCredentials: credentials,
      });

      const detail = await service.getInboxById(wsAlpha, created.id);
      assert.strictEqual(detail.id, created.id);
      assert.strictEqual(detail.name, 'Support Line');
      assert.ok(detail.channel);
      assert.deepStrictEqual(detail.channel.credentials, { isConfigured: true, hasSecret: true });
    });

    it('should throw NotFoundException (INBOX_NOT_FOUND) when inbox does not exist', async () => {
      await assert.rejects(
        () => service.getInboxById(wsAlpha, 'non_existent_inbox_id'),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when attempting to access inbox from another workspace (Cross-Tenant Access Denial)', async () => {
      const createdInAlpha = await service.createInbox(wsAlpha, {
        name: 'Private Alpha Inbox',
        channelType: ChannelType.WEB_CHAT,
      });

      await assert.rejects(
        () => service.getInboxById(wsBeta, createdInAlpha.id),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('Update Inbox', () => {
    it('should update inbox name, greetingMessage and re-encrypt updated credentials', async () => {
      const initialCreds = { token: 'initial_token_123' };
      const created = await service.createInbox(wsAlpha, {
        name: 'Old Name',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        channelCredentials: initialCreds,
      });

      const updatedCreds = { token: 'updated_token_999', newField: 'added' };
      const updated = await service.updateInbox(wsAlpha, created.id, {
        name: 'New Inbox Name',
        greetingMessage: 'New greeting message!',
        isAutoAssignmentEnabled: true,
        channelCredentials: updatedCreds,
      });

      assert.strictEqual(updated.name, 'New Inbox Name');
      assert.strictEqual(updated.greetingMessage, 'New greeting message!');
      assert.strictEqual(updated.isAutoAssignmentEnabled, true);
      assert.deepStrictEqual(updated.channel?.credentials, { isConfigured: true, hasSecret: true });

      // Verify database credentials updated with encryption
      const storedChannel = Array.from(channelsDb.values()).find(c => c.inboxId === created.id);
      assert.ok(storedChannel);
      assert.ok(storedChannel.credentials.encrypted);
      assert.deepStrictEqual(
        credentialService.decrypt(storedChannel.credentials.encrypted),
        updatedCreds,
      );
    });

    it('should throw ConflictException if updating providerAccountId causes conflict in same workspace', async () => {
      await service.createInbox(wsAlpha, {
        name: 'Channel 1',
        channelType: ChannelType.TELEGRAM,
        providerAccountId: 'telegram_bot_1',
      });

      const inbox2 = await service.createInbox(wsAlpha, {
        name: 'Channel 2',
        channelType: ChannelType.TELEGRAM,
        providerAccountId: 'telegram_bot_2',
      });

      await assert.rejects(
        () =>
          service.updateInbox(wsAlpha, inbox2.id, {
            providerAccountId: 'telegram_bot_1',
          }),
        (err: any) => {
          assert.ok(err instanceof ConflictException);
          assert.strictEqual((err.getResponse() as any).code, 'CHANNEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should throw NotFoundException when updating non-existent inbox or in wrong workspace', async () => {
      await assert.rejects(
        () => service.updateInbox(wsAlpha, 'unknown_id', { name: 'Test' }),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('Delete Inbox', () => {
    it('should delete inbox and cascade delete linked channel', async () => {
      const created = await service.createInbox(wsAlpha, {
        name: 'To Delete',
        channelType: ChannelType.WEB_CHAT,
      });

      assert.strictEqual(inboxesDb.has(created.id), true);
      const channelId = created.channel?.id;
      assert.ok(channelId);
      assert.strictEqual(channelsDb.has(channelId), true);

      const deleteResult = await service.deleteInbox(wsAlpha, created.id);
      assert.strictEqual(deleteResult.success, true);

      assert.strictEqual(inboxesDb.has(created.id), false);
      assert.strictEqual(channelsDb.has(channelId), false);
    });

    it('should throw NotFoundException when deleting non-existent inbox', async () => {
      await assert.rejects(
        () => service.deleteInbox(wsAlpha, 'unknown_id'),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when deleting inbox from another workspace (Tenant Isolation)', async () => {
      const createdInAlpha = await service.createInbox(wsAlpha, {
        name: 'Alpha Inbox',
        channelType: ChannelType.WEB_CHAT,
      });

      await assert.rejects(
        () => service.deleteInbox(wsBeta, createdInAlpha.id),
        (err: any) => {
          assert.ok(err instanceof NotFoundException);
          assert.strictEqual((err.getResponse() as any).code, 'INBOX_NOT_FOUND');
          return true;
        },
      );

      // Verify not deleted
      assert.strictEqual(inboxesDb.has(createdInAlpha.id), true);
    });
  });

  describe('Domain Event Emissions (channel.created, channel.updated, channel.deleted)', () => {
    it('should emit channel.created event when creating an inbox with channel', async () => {
      const emittedEvents: Array<{ event: string; payload: any }> = [];
      const mockEventEmitter = {
        emit: (event: string, payload: any) => {
          emittedEvents.push({ event, payload });
        },
      };

      const mockPrismaService: any = {
        getClient: () => ({
          inbox: {
            findFirst: async () => null,
          },
          channel: {
            findFirst: async () => null,
          },
        }),
        runInTransaction: async (cb: (ctx: any) => Promise<any>) => {
          return cb({
            tx: {
              inbox: {
                create: async ({ data }: any) => ({
                  id: 'ib_event_1',
                  ...data,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }),
              },
              channel: {
                create: async ({ data }: any) => ({
                  id: 'chan_event_1',
                  ...data,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                }),
              },
            },
          });
        },
      };

      const serviceWithEvents = new InboxesService(
        mockPrismaService,
        credentialService,
        mockEventEmitter as any,
      );

      await serviceWithEvents.createInbox(wsAlpha, {
        name: 'Event Test Inbox',
        channelType: ChannelType.TELEGRAM,
      });

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'channel.created');
      assert.strictEqual(emittedEvents[0].payload.workspaceId, wsAlpha);
      assert.strictEqual(emittedEvents[0].payload.inboxId, 'ib_event_1');
      assert.strictEqual(emittedEvents[0].payload.channelId, 'chan_event_1');
      assert.strictEqual(emittedEvents[0].payload.channelType, ChannelType.TELEGRAM);
    });

    it('should emit channel.updated event when updating an inbox', async () => {
      const emittedEvents: Array<{ event: string; payload: any }> = [];
      const mockEventEmitter = {
        emit: (event: string, payload: any) => {
          emittedEvents.push({ event, payload });
        },
      };

      const existingInbox = {
        id: 'ib_upd_1',
        workspaceId: wsAlpha,
        name: 'Existing',
        channel: {
          id: 'chan_upd_1',
          workspaceId: wsAlpha,
          inboxId: 'ib_upd_1',
          channelType: ChannelType.TELEGRAM,
          settings: {},
          isConnected: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },

        _count: { members: 0 },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrismaService: any = {
        getClient: () => ({
          inbox: {
            findFirst: async () => existingInbox,
          },
          channel: {
            findFirst: async () => null,
          },
        }),
        runInTransaction: async (cb: (ctx: any) => Promise<any>) => {
          return cb({
            tx: {
              inbox: {
                update: async () => existingInbox,
              },
              channel: {
                update: async () => existingInbox.channel,
              },
            },
          });
        },
      };

      const serviceWithEvents = new InboxesService(
        mockPrismaService,
        credentialService,
        mockEventEmitter as any,
      );

      await serviceWithEvents.updateInbox(wsAlpha, 'ib_upd_1', {
        name: 'Updated Name',
      });

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'channel.updated');
      assert.strictEqual(emittedEvents[0].payload.channelId, 'chan_upd_1');
    });

    it('should emit channel.deleted event when deleting an inbox', async () => {
      const emittedEvents: Array<{ event: string; payload: any }> = [];
      const mockEventEmitter = {
        emit: (event: string, payload: any) => {
          emittedEvents.push({ event, payload });
        },
      };

      const existingInbox = {
        id: 'ib_del_1',
        workspaceId: wsAlpha,
        name: 'To Delete',
        channel: {
          id: 'chan_del_1',
          channelType: ChannelType.TELEGRAM,
        },
      };

      const mockPrismaService: any = {
        getClient: () => ({
          inbox: {
            findFirst: async () => existingInbox,
            delete: async () => existingInbox,
          },
        }),
      };

      const serviceWithEvents = new InboxesService(
        mockPrismaService,
        credentialService,
        mockEventEmitter as any,
      );

      await serviceWithEvents.deleteInbox(wsAlpha, 'ib_del_1');

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'channel.deleted');
      assert.strictEqual(emittedEvents[0].payload.channelId, 'chan_del_1');
    });
  });
});
