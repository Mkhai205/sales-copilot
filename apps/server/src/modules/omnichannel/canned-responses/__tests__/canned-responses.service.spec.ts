import { expectReject } from '../../../../../test/test-assertions';
import { CannedResponsesService, normalizeShortCode } from '../canned-responses.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('CannedResponsesService (Feature F-1.8.3)', () => {
  let service: CannedResponsesService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;
  let cannedResponsesDb: Map<string, any>;

  beforeEach(() => {
    cannedResponsesDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      cannedResponse: {
        findFirst: async ({ where }: { where: any }) => {
          for (const item of cannedResponsesDb.values()) {
            if (where.id && typeof where.id === 'string' && item.id !== where.id) continue;
            if (
              where.id &&
              typeof where.id === 'object' &&
              where.id.not &&
              item.id === where.id.not
            ) {
              continue;
            }
            if (where.workspaceId && item.workspaceId !== where.workspaceId) continue;
            if (where.shortCode && item.shortCode !== where.shortCode) continue;

            return { ...item };
          }
          return null;
        },

        findMany: async ({
          where,
          orderBy,
        }: {
          where?: any;
          orderBy?: Record<string, 'asc' | 'desc'>;
        }) => {
          const results = Array.from(cannedResponsesDb.values()).filter((item: any) => {
            if (where?.workspaceId && item.workspaceId !== where.workspaceId) return false;
            if (where?.OR && Array.isArray(where.OR)) {
              const matched = where.OR.some((condition: any) => {
                if (condition.shortCode?.contains) {
                  const query = condition.shortCode.contains.toLowerCase();
                  if (item.shortCode.toLowerCase().includes(query)) return true;
                }
                if (condition.content?.contains) {
                  const query = condition.content.contains.toLowerCase();
                  if (item.content.toLowerCase().includes(query)) return true;
                }
                return false;
              });
              if (!matched) return false;
            }
            return true;
          });

          if (orderBy?.shortCode) {
            const direction = orderBy.shortCode;
            results.sort((a, b) => {
              if (direction === 'asc') {
                return a.shortCode.localeCompare(b.shortCode);
              }
              return b.shortCode.localeCompare(a.shortCode);
            });
          }

          return results.map(i => ({ ...i }));
        },

        create: async ({ data }: { data: any }) => {
          // Check unique constraint @@unique([workspaceId, shortCode])
          for (const existing of cannedResponsesDb.values()) {
            if (
              existing.workspaceId === data.workspaceId &&
              existing.shortCode === data.shortCode
            ) {
              const err: any = new Error('Unique constraint failed');
              err.code = 'P2002';
              throw err;
            }
          }

          const id = `cr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const now = new Date();
          const newRecord = {
            id,
            workspaceId: data.workspaceId,
            shortCode: data.shortCode,
            content: data.content,
            createdAt: now,
            updatedAt: now,
          };
          cannedResponsesDb.set(id, newRecord);
          return { ...newRecord };
        },

        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = cannedResponsesDb.get(id);
          if (!existing) {
            throw new Error(`Canned response with id ${id} not found`);
          }
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          cannedResponsesDb.set(id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: any }) => {
          const id = where.id ?? where.workspaceId_id?.id;
          const existing = cannedResponsesDb.get(id);
          if (existing) {
            cannedResponsesDb.delete(id);
          }
          return existing;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new CannedResponsesService(mockPrismaService, mockEventEmitter as any);
  });

  describe('normalizeShortCode', () => {
    it('should strip leading slashes, convert to lowercase, and trim', () => {
      expect(normalizeShortCode('/chao')).toBe('chao');
      expect(normalizeShortCode('  /BaoGia  ')).toBe('baogia');
      expect(normalizeShortCode('///ho_tro')).toBe('ho_tro');
      expect(normalizeShortCode('HELLO')).toBe('hello');
      expect(normalizeShortCode('')).toBe('');
    });
  });

  describe('create', () => {
    it('should create canned response with normalized shortcode and emit canned_response.created', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/Chao',
        content: 'Xin chào quý khách, tôi có thể giúp gì cho bạn?',
      });

      expect(created.workspaceId).toBe('ws_1');
      expect(created.shortCode).toBe('chao');
      expect(created.content).toBe('Xin chào quý khách, tôi có thể giúp gì cho bạn?');
      expect(created.id).toBeTruthy();
      expect(created.createdAt).toBeTruthy();

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('canned_response.created');
      expect(emittedEvents[0].payload.workspaceId).toBe('ws_1');
      expect(emittedEvents[0].payload.cannedResponse.shortCode).toBe('chao');
    });

    it('should throw BadRequestException if shortcode is empty or solely slashes', async () => {
      await expectReject(
        async () => {
          await service.create('ws_1', {
            shortCode: '///',
            content: 'Hello',
          });
        },
        (err: any) => {
          expect(err instanceof BadRequestException).toBe(true);
          expect(err.response.code).toBe('INVALID_SHORT_CODE');
          return true;
        },
      );
    });

    it('should throw BadRequestException if content is empty', async () => {
      await expectReject(
        async () => {
          await service.create('ws_1', {
            shortCode: 'chao',
            content: '   ',
          });
        },
        (err: any) => {
          expect(err instanceof BadRequestException).toBe(true);
          expect(err.response.code).toBe('INVALID_CONTENT');
          return true;
        },
      );
    });

    it('should throw ConflictException if shortcode already exists in workspace', async () => {
      await service.create('ws_1', {
        shortCode: '/chao',
        content: 'Xin chào',
      });

      await expectReject(
        async () => {
          await service.create('ws_1', {
            shortCode: 'Chao',
            content: 'Xin chào bạn',
          });
        },
        (err: any) => {
          expect(err instanceof ConflictException).toBe(true);
          expect(err.response.code).toBe('CANNED_RESPONSE_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same shortcode in different workspace', async () => {
      const cr1 = await service.create('ws_1', {
        shortCode: '/chao',
        content: 'Workspace 1 chào',
      });
      const cr2 = await service.create('ws_2', {
        shortCode: '/chao',
        content: 'Workspace 2 chào',
      });

      expect(cr1.shortCode).toBe('chao');
      expect(cr2.shortCode).toBe('chao');
      expect(cr1.workspaceId).toBe('ws_1');
      expect(cr2.workspaceId).toBe('ws_2');
    });
  });

  describe('list & search', () => {
    beforeEach(async () => {
      await service.create('ws_1', { shortCode: '/baogia', content: 'Bảng báo giá dịch vụ 2026' });
      await service.create('ws_1', { shortCode: '/baohiem', content: 'Thông tin gói bảo hiểm' });
      await service.create('ws_1', { shortCode: '/chao', content: 'Xin chào khách hàng' });
      await service.create('ws_1', { shortCode: '/thongbao', content: 'Thông báo quan trọng' });
      await service.create('ws_2', { shortCode: '/baogia', content: 'Báo giá ws2' });
    });

    it('should list all canned responses for workspace in alphabetical order', async () => {
      const list = await service.list('ws_1');
      expect(list.length).toBe(4);
      expect(list.map(i => i.shortCode)).toEqual(['baogia', 'baohiem', 'chao', 'thongbao']);
    });

    it('should search by prefix using search parameter and prioritize prefix matches', async () => {
      const results = await service.list('ws_1', { search: '/bao' });
      expect(results.length).toBe(3);
      // 'baogia' and 'baohiem' start with 'bao', 'thongbao' contains 'bao'
      expect(results[0].shortCode).toBe('baogia');
      expect(results[1].shortCode).toBe('baohiem');
      expect(results[2].shortCode).toBe('thongbao');
    });

    it('should search by content', async () => {
      const results = await service.list('ws_1', { q: 'khách hàng' });
      expect(results.length).toBe(1);
      expect(results[0].shortCode).toBe('chao');
    });

    it('should return empty array if no matches found', async () => {
      const results = await service.list('ws_1', { search: '/khongtontai' });
      expect(results.length).toBe(0);
    });
  });

  describe('getById', () => {
    it('should get canned response by id and workspace', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/tam_biet',
        content: 'Tạm biệt quý khách',
      });

      const found = await service.getById('ws_1', created.id);
      expect(found.id).toBe(created.id);
      expect(found.shortCode).toBe('tam_biet');
    });

    it('should throw NotFoundException if id belongs to another workspace', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/tam_biet',
        content: 'Tạm biệt quý khách',
      });

      await expectReject(
        async () => {
          await service.getById('ws_2', created.id);
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          expect(err.response.code).toBe('CANNED_RESPONSE_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('update', () => {
    it('should update content and normalized shortcode, and emit canned_response.updated', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/c1',
        content: 'Old content',
      });
      emittedEvents = [];

      const updated = await service.update('ws_1', created.id, {
        shortCode: '/C1_NEW',
        content: 'New content',
      });

      expect(updated.shortCode).toBe('c1_new');
      expect(updated.content).toBe('New content');

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('canned_response.updated');
      expect(emittedEvents[0].payload.cannedResponse.shortCode).toBe('c1_new');
    });

    it('should throw ConflictException if updated shortcode collides with another canned response', async () => {
      const cr1 = await service.create('ws_1', { shortCode: '/c1', content: 'Content 1' });
      await service.create('ws_1', { shortCode: '/c2', content: 'Content 2' });

      await expectReject(
        async () => {
          await service.update('ws_1', cr1.id, { shortCode: '/c2' });
        },
        (err: any) => {
          expect(err instanceof ConflictException).toBe(true);
          expect(err.response.code).toBe('CANNED_RESPONSE_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow updating with same shortcode without conflict', async () => {
      const cr = await service.create('ws_1', { shortCode: '/same', content: 'Content' });

      const updated = await service.update('ws_1', cr.id, {
        shortCode: '/same',
        content: 'Updated content',
      });

      expect(updated.content).toBe('Updated content');
    });
  });

  describe('delete', () => {
    it('should delete canned response and emit canned_response.deleted', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/to_delete',
        content: 'Delete me',
      });
      emittedEvents = [];

      const res = await service.delete('ws_1', created.id);
      expect(res).toEqual({ success: true });

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('canned_response.deleted');
      expect(emittedEvents[0].payload.cannedResponseId).toBe(created.id);
      expect(emittedEvents[0].payload.shortCode).toBe('to_delete');

      // Verify deletion
      await expectReject(async () => {
        await service.getById('ws_1', created.id);
      });
    });

    it('should throw NotFoundException when deleting non-existent canned response', async () => {
      await expectReject(
        async () => {
          await service.delete('ws_1', 'cr_nonexistent');
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          expect(err.response.code).toBe('CANNED_RESPONSE_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
