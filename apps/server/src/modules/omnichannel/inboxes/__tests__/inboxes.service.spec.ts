import { assertDefined, expectReject } from '../../../../../test/test-assertions';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = inboxesDb.get(id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          inboxesDb.set(id, updated);
          return updated;
        },
        delete: async ({ where }: { where: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = inboxesDb.get(id);
          inboxesDb.delete(id);
          // Cascade delete channel and members
          for (const [chId, ch] of channelsDb.entries()) {
            if (ch.inboxId === id) channelsDb.delete(chId);
          }
          for (const [mId, m] of inboxMembersDb.entries()) {
            if (m.inboxId === id) inboxMembersDb.delete(mId);
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
        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = channelsDb.get(id);
          if (!existing) throw new Error('Not found');
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          channelsDb.set(id, updated);
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

      assertDefined(result.id);
      expect(result.name).toBe('Telegram Support Inbox');
      expect(result.channelType).toBe(ChannelType.TELEGRAM);
      expect(result.greetingMessage).toBe('Xin chào! Chúng tôi có thể giúp gì cho bạn?');
      expect(result.isAutoAssignmentEnabled).toBe(true);
      expect(result.memberCount).toBe(0);

      // Verify channel info and masked credentials in response
      assertDefined(result.channel);
      expect(result.channel.providerAccountId).toBe('bot_support_xyz');
      expect(result.channel.credentials).toEqual({ isConfigured: true, hasSecret: true });

      // Verify raw database state: credentials MUST be encrypted
      const storedChannel = Array.from(channelsDb.values()).find(c => c.inboxId === result.id);
      assertDefined(storedChannel);
      expect(storedChannel.credentials.encrypted).toBeTruthy();
      expect(storedChannel.credentials.encrypted).not.toBe(JSON.stringify(plainCredentials));
      expect(storedChannel.credentials.encrypted.split(':').length).toBe(3);
    });

    it('should throw ConflictException (CHANNEL_ALREADY_EXISTS) when duplicate providerAccountId in same workspace', async () => {
      await service.createInbox(wsAlpha, {
        name: 'Facebook Page 1',
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: 'page_123456',
      });

      await expectReject(
        () =>
          service.createInbox(wsAlpha, {
            name: 'Duplicate Facebook Page',
            channelType: ChannelType.FACEBOOK_MESSENGER,
            providerAccountId: 'page_123456',
          }),
        (err: any) => {
          expect(err instanceof ConflictException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('CHANNEL_ALREADY_EXISTS');
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

      assertDefined(inboxAlpha.id);
      assertDefined(inboxBeta.id);
      expect(inboxAlpha.id).not.toBe(inboxBeta.id);
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
      expect(inboxes.length).toBe(2);

      for (const inbox of inboxes) {
        assertDefined(inbox.channel);
        expect((inbox.channel as any).credentials).toBe(undefined);
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

      expect(alphaList.length).toBe(1);
      expect(alphaList[0].name).toBe('Alpha Inbox 1');

      expect(betaList.length).toBe(1);
      expect(betaList[0].name).toBe('Beta Inbox 1');
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
      expect(detail.id).toBe(created.id);
      expect(detail.name).toBe('Support Line');
      assertDefined(detail.channel);
      expect(detail.channel.credentials).toEqual({ isConfigured: true, hasSecret: true });
    });

    it('should throw NotFoundException (INBOX_NOT_FOUND) when inbox does not exist', async () => {
      await expectReject(
        () => service.getInboxById(wsAlpha, 'non_existent_inbox_id'),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INBOX_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when attempting to access inbox from another workspace (Cross-Tenant Access Denial)', async () => {
      const createdInAlpha = await service.createInbox(wsAlpha, {
        name: 'Private Alpha Inbox',
        channelType: ChannelType.WEB_CHAT,
      });

      await expectReject(
        () => service.getInboxById(wsBeta, createdInAlpha.id),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INBOX_NOT_FOUND');
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

      expect(updated.name).toBe('New Inbox Name');
      expect(updated.greetingMessage).toBe('New greeting message!');
      expect(updated.isAutoAssignmentEnabled).toBe(true);
      expect(updated.channel?.credentials).toEqual({ isConfigured: true, hasSecret: true });

      // Verify database credentials updated with encryption
      const storedChannel = Array.from(channelsDb.values()).find(c => c.inboxId === created.id);
      assertDefined(storedChannel);
      expect(storedChannel.credentials.encrypted).toBeTruthy();
      expect(credentialService.decrypt(storedChannel.credentials.encrypted)).toEqual(updatedCreds);
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

      await expectReject(
        () =>
          service.updateInbox(wsAlpha, inbox2.id, {
            providerAccountId: 'telegram_bot_1',
          }),
        (err: any) => {
          expect(err instanceof ConflictException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('CHANNEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should throw NotFoundException when updating non-existent inbox or in wrong workspace', async () => {
      await expectReject(
        () => service.updateInbox(wsAlpha, 'unknown_id', { name: 'Test' }),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INBOX_NOT_FOUND');
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

      expect(inboxesDb.has(created.id)).toBe(true);
      const channelId = created.channel?.id;
      assertDefined(channelId);
      expect(channelsDb.has(channelId)).toBe(true);

      const deleteResult = await service.deleteInbox(wsAlpha, created.id);
      expect(deleteResult.success).toBe(true);

      expect(inboxesDb.has(created.id)).toBe(false);
      expect(channelsDb.has(channelId)).toBe(false);
    });

    it('should throw NotFoundException when deleting non-existent inbox', async () => {
      await expectReject(
        () => service.deleteInbox(wsAlpha, 'unknown_id'),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INBOX_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException when deleting inbox from another workspace (Tenant Isolation)', async () => {
      const createdInAlpha = await service.createInbox(wsAlpha, {
        name: 'Alpha Inbox',
        channelType: ChannelType.WEB_CHAT,
      });

      await expectReject(
        () => service.deleteInbox(wsBeta, createdInAlpha.id),
        (err: any) => {
          expect(err instanceof NotFoundException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INBOX_NOT_FOUND');
          return true;
        },
      );

      // Verify not deleted
      expect(inboxesDb.has(createdInAlpha.id)).toBe(true);
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

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('channel.created');
      expect(emittedEvents[0].payload.workspaceId).toBe(wsAlpha);
      expect(emittedEvents[0].payload.inboxId).toBe('ib_event_1');
      expect(emittedEvents[0].payload.channelId).toBe('chan_event_1');
      expect(emittedEvents[0].payload.channelType).toBe(ChannelType.TELEGRAM);
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

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('channel.updated');
      expect(emittedEvents[0].payload.channelId).toBe('chan_upd_1');
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

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('channel.deleted');
      expect(emittedEvents[0].payload.channelId).toBe('chan_del_1');
    });
  });

  describe('uploadAvatar (MinIO Avatar Upload)', () => {
    it('should upload a valid avatar image and return the public URL', async () => {
      let uploadedKey = '';
      const mockStorageService: any = {
        upload: async (_buffer: Buffer, _mimetype: string, key: string) => {
          uploadedKey = key;
        },
        getPublicUrl: (key: string) => `http://minio:9000/bucket/${key}`,
      };

      const serviceWithStorage = new InboxesService(
        {} as any,
        credentialService,
        undefined,
        mockStorageService,
      );

      const file = {
        originalname: 'shop_logo.png',
        mimetype: 'image/png',
        size: 1024,
        buffer: Buffer.from('fake-image-data'),
      };

      const result = await serviceWithStorage.uploadAvatar(wsAlpha, file);
      expect(
        result.avatarUrl.includes('http://minio:9000/bucket/avatars/inboxes/ws_alpha_1/'),
      ).toBeTruthy();
      expect(result.avatarUrl.endsWith('.png')).toBeTruthy();
      expect(uploadedKey.startsWith('avatars/inboxes/ws_alpha_1/')).toBeTruthy();
    });

    it('should reject non-image file uploads', async () => {
      const mockStorageService: any = {
        upload: async () => {},
        getPublicUrl: () => '',
      };

      const serviceWithStorage = new InboxesService(
        {} as any,
        credentialService,
        undefined,
        mockStorageService,
      );

      const file = {
        originalname: 'script.exe',
        mimetype: 'application/octet-stream',
        size: 1024,
        buffer: Buffer.from('binary-data'),
      };

      await expectReject(
        () => serviceWithStorage.uploadAvatar(wsAlpha, file),
        (err: any) => {
          expect(err instanceof BadRequestException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('INVALID_IMAGE_TYPE');
          return true;
        },
      );
    });

    it('should reject image files larger than 5MB', async () => {
      const mockStorageService: any = {
        upload: async () => {},
        getPublicUrl: () => '',
      };

      const serviceWithStorage = new InboxesService(
        {} as any,
        credentialService,
        undefined,
        mockStorageService,
      );

      const file = {
        originalname: 'huge_banner.png',
        mimetype: 'image/png',
        size: 6 * 1024 * 1024,
        buffer: Buffer.from('huge-data'),
      };

      await expectReject(
        () => serviceWithStorage.uploadAvatar(wsAlpha, file),
        (err: any) => {
          expect(err instanceof BadRequestException).toBeTruthy();
          expect((err.getResponse() as any).code).toBe('FILE_TOO_LARGE');
          return true;
        },
      );
    });
  });
});
