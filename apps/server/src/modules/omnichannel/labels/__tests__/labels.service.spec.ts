import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { LabelsService } from '../labels.service';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('LabelsService (Label CRUD & Workspace Scoping)', () => {
  let service: LabelsService;
  let mockPrismaService: any;
  let mockEventEmitter: any;
  let emittedEvents: Array<{ event: string; payload: any }>;

  let labelsDb: Map<string, any>;

  beforeEach(() => {
    labelsDb = new Map();
    emittedEvents = [];

    mockEventEmitter = {
      emit: (event: string, payload: any) => {
        emittedEvents.push({ event, payload });
      },
    };

    const clientMock = {
      label: {
        findFirst: async ({ where }: { where: any }) => {
          for (const label of labelsDb.values()) {
            if (where.id && typeof where.id === 'string' && label.id !== where.id) continue;
            if (
              where.id &&
              typeof where.id === 'object' &&
              where.id.not &&
              label.id === where.id.not
            ) {
              continue;
            }
            if (where.workspaceId && label.workspaceId !== where.workspaceId) continue;
            if (where.title && label.title !== where.title) continue;

            return { ...label };
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
          const results = Array.from(labelsDb.values()).filter((label: any) => {
            if (where?.workspaceId && label.workspaceId !== where.workspaceId) return false;
            if (where?.title?.contains) {
              const query = where.title.contains.toLowerCase();
              if (!label.title.toLowerCase().includes(query)) return false;
            }
            if (where?.showOnSidebar !== undefined && label.showOnSidebar !== where.showOnSidebar) {
              return false;
            }
            return true;
          });

          if (orderBy) {
            const [field, direction] = Object.entries(orderBy)[0];
            results.sort((a, b) => {
              if (direction === 'asc') {
                return a[field] > b[field] ? 1 : -1;
              }
              return a[field] < b[field] ? 1 : -1;
            });
          }

          return results.map(l => ({ ...l }));
        },

        create: async ({ data }: { data: any }) => {
          // Check unique constraint @@unique([workspaceId, title])
          for (const existing of labelsDb.values()) {
            if (existing.workspaceId === data.workspaceId && existing.title === data.title) {
              const err: any = new Error('Unique constraint failed');
              err.code = 'P2002';
              throw err;
            }
          }

          const id = `lbl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          const now = new Date();
          const newLabel = {
            id,
            workspaceId: data.workspaceId,
            title: data.title,
            description: data.description ?? null,
            color: data.color ?? '#2563eb',
            showOnSidebar: data.showOnSidebar ?? true,
            createdAt: now,
            updatedAt: now,
          };
          labelsDb.set(id, newLabel);
          return { ...newLabel };
        },

        update: async ({ where, data }: { where: { id: string }; data: any }) => {
          const existing = labelsDb.get(where.id);
          if (!existing) {
            throw new Error(`Label with id ${where.id} not found`);
          }
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          labelsDb.set(where.id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const existing = labelsDb.get(where.id);
          if (existing) {
            labelsDb.delete(where.id);
          }
          return existing;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new LabelsService(mockPrismaService, mockEventEmitter as any);
  });

  describe('create', () => {
    it('should successfully create a new label and emit label.created', async () => {
      const result = await service.create('ws_1', {
        title: 'VIP Support',
        description: 'VIP client inquiries',
        color: '#FF0000',
        showOnSidebar: true,
      });

      assert.strictEqual(result.workspaceId, 'ws_1');
      assert.strictEqual(result.title, 'VIP Support');
      assert.strictEqual(result.description, 'VIP client inquiries');
      assert.strictEqual(result.color, '#FF0000');
      assert.strictEqual(result.showOnSidebar, true);

      assert.strictEqual(emittedEvents.length, 1);
      assert.strictEqual(emittedEvents[0].event, 'label.created');
      assert.strictEqual(emittedEvents[0].payload.label.id, result.id);
    });

    it('should trim title and apply defaults', async () => {
      const result = await service.create('ws_1', {
        title: '   VIP Customer   ',
      });

      assert.strictEqual(result.title, 'VIP Customer');
      assert.strictEqual(result.color, '#2563eb');
      assert.strictEqual(result.description, null);
      assert.strictEqual(result.showOnSidebar, true);
    });

    it('should throw ConflictException on duplicate title in the same workspace', async () => {
      await service.create('ws_1', { title: 'Billing Issue' });

      await assert.rejects(
        async () => {
          await service.create('ws_1', { title: 'Billing Issue' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof ConflictException, true);
          assert.strictEqual(err.response.code, 'LABEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same title in different workspaces (multi-tenancy)', async () => {
      const l1 = await service.create('ws_1', { title: 'Feedback' });
      const l2 = await service.create('ws_2', { title: 'Feedback' });

      assert.strictEqual(l1.workspaceId, 'ws_1');
      assert.strictEqual(l2.workspaceId, 'ws_2');
      assert.strictEqual(l1.title, l2.title);
      assert.notStrictEqual(l1.id, l2.id);
    });
  });

  describe('list', () => {
    beforeEach(async () => {
      await service.create('ws_1', { title: 'Alpha', showOnSidebar: true });
      await service.create('ws_1', { title: 'Beta Urgent', showOnSidebar: false });
      await service.create('ws_1', { title: 'Gamma Support', showOnSidebar: true });
      await service.create('ws_2', { title: 'Alpha Other WS', showOnSidebar: true });
    });

    it('should list only labels belonging to the specified workspace', async () => {
      const labels = await service.list('ws_1');
      assert.strictEqual(labels.length, 3);
      assert.strictEqual(
        labels.every(l => l.workspaceId === 'ws_1'),
        true,
      );
    });

    it('should filter labels by search query q', async () => {
      const labels = await service.list('ws_1', { q: 'urgent' } as any);
      assert.strictEqual(labels.length, 1);
      assert.strictEqual(labels[0].title, 'Beta Urgent');
    });

    it('should filter labels by showOnSidebar', async () => {
      const labels = await service.list('ws_1', { showOnSidebar: true } as any);
      assert.strictEqual(labels.length, 2);
    });
  });

  describe('getById', () => {
    it('should retrieve label by ID within the workspace', async () => {
      const created = await service.create('ws_1', { title: 'Refund' });
      const found = await service.getById('ws_1', created.id);

      assert.strictEqual(found.id, created.id);
      assert.strictEqual(found.title, 'Refund');
    });

    it('should throw NotFoundException if label is not found', async () => {
      await assert.rejects(
        async () => {
          await service.getById('ws_1', 'non_existent_id');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'LABEL_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException if label belongs to another workspace (cross-tenant security)', async () => {
      const created = await service.create('ws_2', { title: 'Internal Only' });

      await assert.rejects(
        async () => {
          await service.getById('ws_1', created.id);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'LABEL_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('update', () => {
    it('should successfully update label fields and emit label.updated', async () => {
      const created = await service.create('ws_1', { title: 'Bug Report', color: '#111111' });

      const updated = await service.update('ws_1', created.id, {
        title: 'High Priority Bug',
        color: '#FF0000',
        showOnSidebar: false,
      });

      assert.strictEqual(updated.id, created.id);
      assert.strictEqual(updated.title, 'High Priority Bug');
      assert.strictEqual(updated.color, '#FF0000');
      assert.strictEqual(updated.showOnSidebar, false);

      const updateEvent = emittedEvents.find(e => e.event === 'label.updated');
      assert.ok(updateEvent);
      assert.strictEqual(updateEvent.payload.label.title, 'High Priority Bug');
    });

    it('should throw ConflictException if renaming to an existing title in same workspace', async () => {
      const l1 = await service.create('ws_1', { title: 'First Title' });
      await service.create('ws_1', { title: 'Second Title' });

      await assert.rejects(
        async () => {
          await service.update('ws_1', l1.id, { title: 'Second Title' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof ConflictException, true);
          assert.strictEqual(err.response.code, 'LABEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow updating without changing the title', async () => {
      const l1 = await service.create('ws_1', { title: 'Original', color: '#000000' });
      const updated = await service.update('ws_1', l1.id, { color: '#FFFFFF' });

      assert.strictEqual(updated.title, 'Original');
      assert.strictEqual(updated.color, '#FFFFFF');
    });

    it('should throw NotFoundException if updating non-existent label', async () => {
      await assert.rejects(
        async () => {
          await service.update('ws_1', 'not_found', { title: 'New' });
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          return true;
        },
      );
    });
  });

  describe('delete', () => {
    it('should delete label and emit label.deleted', async () => {
      const created = await service.create('ws_1', { title: 'To Delete' });
      const result = await service.delete('ws_1', created.id);

      assert.deepStrictEqual(result, { success: true });

      const deleteEvent = emittedEvents.find(e => e.event === 'label.deleted');
      assert.ok(deleteEvent);
      assert.strictEqual(deleteEvent.payload.labelId, created.id);

      await assert.rejects(async () => {
        await service.getById('ws_1', created.id);
      }, NotFoundException);
    });

    it('should throw NotFoundException if deleting non-existent label', async () => {
      await assert.rejects(
        async () => {
          await service.delete('ws_1', 'unknown_id');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          return true;
        },
      );
    });
  });
});
