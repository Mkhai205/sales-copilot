import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
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

        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = cannedResponsesDb.get(where.id);
          if (!existing) {
            throw new Error(`Canned response with id ${where.id} not found`);
          }
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          cannedResponsesDb.set(where.id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const existing = cannedResponsesDb.get(where.id);
          if (existing) {
            cannedResponsesDb.delete(where.id);
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
      assert.strictEqual(normalizeShortCode('/chao'), 'chao');
      assert.strictEqual(normalizeShortCode('  /BaoGia  '), 'baogia');
      assert.strictEqual(normalizeShortCode('///ho_tro'), 'ho_tro');
      assert.strictEqual(normalizeShortCode('HELLO'), 'hello');
      assert.strictEqual(normalizeShortCode(''), '');
    });
  });

  describe('create', () => {
    it('should create canned response with normalized shortcode and emit canned_response.created', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/Chao',
        content: 'Xin chào quý khách, tôi có thể giúp gì cho bạn?',
      });

      assert.strictEqual(created.workspaceId, 'ws_1');
      assert.strictEqual(created.shortCode, 'chao');
      assert.strictEqual(created.content, 'Xin chào quý khách, tôi có thể giúp gì cho bạn?');
      assert.ok(created.id);
      assert.ok(created.createdAt);

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'canned_response.created');
      assert.strictEqual(emittedEvents[0].payload.workspaceId, 'ws_1');
      assert.strictEqual(emittedEvents[0].payload.cannedResponse.shortCode, 'chao');
    });

    it('should throw BadRequestException if shortcode is empty or solely slashes', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            shortCode: '///',
            content: 'Hello',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_SHORT_CODE');
          return true;
        },
      );
    });

    it('should throw BadRequestException if content is empty', async () => {
      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            shortCode: 'chao',
            content: '   ',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'INVALID_CONTENT');
          return true;
        },
      );
    });

    it('should throw ConflictException if shortcode already exists in workspace', async () => {
      await service.create('ws_1', {
        shortCode: '/chao',
        content: 'Xin chào',
      });

      await assert.rejects(
        async () => {
          await service.create('ws_1', {
            shortCode: 'Chao',
            content: 'Xin chào bạn',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof ConflictException, true);
          assert.strictEqual(err.response.code, 'CANNED_RESPONSE_ALREADY_EXISTS');
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

      assert.strictEqual(cr1.shortCode, 'chao');
      assert.strictEqual(cr2.shortCode, 'chao');
      assert.strictEqual(cr1.workspaceId, 'ws_1');
      assert.strictEqual(cr2.workspaceId, 'ws_2');
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
      assert.strictEqual(list.length, 4);
      assert.deepStrictEqual(
        list.map(i => i.shortCode),
        ['baogia', 'baohiem', 'chao', 'thongbao'],
      );
    });

    it('should search by prefix using search parameter and prioritize prefix matches', async () => {
      const results = await service.list('ws_1', { search: '/bao' });
      assert.strictEqual(results.length, 3);
      // 'baogia' and 'baohiem' start with 'bao', 'thongbao' contains 'bao'
      assert.strictEqual(results[0].shortCode, 'baogia');
      assert.strictEqual(results[1].shortCode, 'baohiem');
      assert.strictEqual(results[2].shortCode, 'thongbao');
    });

    it('should search by content', async () => {
      const results = await service.list('ws_1', { q: 'khách hàng' });
      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].shortCode, 'chao');
    });

    it('should return empty array if no matches found', async () => {
      const results = await service.list('ws_1', { search: '/khongtontai' });
      assert.strictEqual(results.length, 0);
    });
  });

  describe('getById', () => {
    it('should get canned response by id and workspace', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/tam_biet',
        content: 'Tạm biệt quý khách',
      });

      const found = await service.getById('ws_1', created.id);
      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.shortCode, 'tam_biet');
    });

    it('should throw NotFoundException if id belongs to another workspace', async () => {
      const created = await service.create('ws_1', {
        shortCode: '/tam_biet',
        content: 'Tạm biệt quý khách',
      });

      await assert.rejects(
        async () => {
          await service.getById('ws_2', created.id);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'CANNED_RESPONSE_NOT_FOUND');
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

      assert.strictEqual(updated.shortCode, 'c1_new');
      assert.strictEqual(updated.content, 'New content');

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'canned_response.updated');
      assert.strictEqual(emittedEvents[0].payload.cannedResponse.shortCode, 'c1_new');
    });

    it('should throw ConflictException if updated shortcode collides with another canned response', async () => {
      const cr1 = await service.create('ws_1', { shortCode: '/c1', content: 'Content 1' });
      await service.create('ws_1', { shortCode: '/c2', content: 'Content 2' });

      await assert.rejects(
        async () => {
          await service.update('ws_1', cr1.id, { shortCode: '/c2' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof ConflictException, true);
          assert.strictEqual(err.response.code, 'CANNED_RESPONSE_ALREADY_EXISTS');
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

      assert.strictEqual(updated.content, 'Updated content');
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
      assert.deepStrictEqual(res, { success: true });

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'canned_response.deleted');
      assert.strictEqual(emittedEvents[0].payload.cannedResponseId, created.id);
      assert.strictEqual(emittedEvents[0].payload.shortCode, 'to_delete');

      // Verify deletion
      await assert.rejects(async () => {
        await service.getById('ws_1', created.id);
      });
    });

    it('should throw NotFoundException when deleting non-existent canned response', async () => {
      await assert.rejects(
        async () => {
          await service.delete('ws_1', 'cr_nonexistent');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'CANNED_RESPONSE_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
