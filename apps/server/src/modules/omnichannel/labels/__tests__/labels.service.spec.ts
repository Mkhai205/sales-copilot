import { assertDefined, expectReject } from '../../../../../test/test-assertions';
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

        update: async ({ where, data }: { where: any; data: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const existing = labelsDb.get(id);
          if (!existing) {
            throw new Error(`Label with id ${id} not found`);
          }
          const updated = {
            ...existing,
            ...data,
            updatedAt: new Date(),
          };
          labelsDb.set(id, updated);
          return { ...updated };
        },

        delete: async ({ where }: { where: any }) => {
          const id = where.workspaceId_id ? where.workspaceId_id.id : where.id;
          const existing = labelsDb.get(id);
          if (existing) {
            labelsDb.delete(id);
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

      expect(result.workspaceId).toBe('ws_1');
      expect(result.title).toBe('VIP Support');
      expect(result.description).toBe('VIP client inquiries');
      expect(result.color).toBe('#FF0000');
      expect(result.showOnSidebar).toBe(true);

      expect(emittedEvents.length).toBe(1);
      expect(emittedEvents[0].event).toBe('label.created');
      expect(emittedEvents[0].payload.label.id).toBe(result.id);
    });

    it('should trim title and apply defaults', async () => {
      const result = await service.create('ws_1', {
        title: '   VIP Customer   ',
      });

      expect(result.title).toBe('VIP Customer');
      expect(result.color).toBe('#2563eb');
      expect(result.description).toBe(null);
      expect(result.showOnSidebar).toBe(true);
    });

    it('should throw ConflictException on duplicate title in the same workspace', async () => {
      await service.create('ws_1', { title: 'Billing Issue' });

      await expectReject(
        async () => {
          await service.create('ws_1', { title: 'Billing Issue' });
        },
        (err: any) => {
          expect(err instanceof ConflictException).toBe(true);
          expect(err.response.code).toBe('LABEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow same title in different workspaces (multi-tenancy)', async () => {
      const l1 = await service.create('ws_1', { title: 'Feedback' });
      const l2 = await service.create('ws_2', { title: 'Feedback' });

      expect(l1.workspaceId).toBe('ws_1');
      expect(l2.workspaceId).toBe('ws_2');
      expect(l1.title).toBe(l2.title);
      expect(l1.id).not.toBe(l2.id);
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
      expect(labels.length).toBe(3);
      expect(labels.every(l => l.workspaceId === 'ws_1')).toBe(true);
    });

    it('should filter labels by search query q', async () => {
      const labels = await service.list('ws_1', { q: 'urgent' } as any);
      expect(labels.length).toBe(1);
      expect(labels[0].title).toBe('Beta Urgent');
    });

    it('should filter labels by showOnSidebar', async () => {
      const labels = await service.list('ws_1', { showOnSidebar: true } as any);
      expect(labels.length).toBe(2);
    });
  });

  describe('getById', () => {
    it('should retrieve label by ID within the workspace', async () => {
      const created = await service.create('ws_1', { title: 'Refund' });
      const found = await service.getById('ws_1', created.id);

      expect(found.id).toBe(created.id);
      expect(found.title).toBe('Refund');
    });

    it('should throw NotFoundException if label is not found', async () => {
      await expectReject(
        async () => {
          await service.getById('ws_1', 'non_existent_id');
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          expect(err.response.code).toBe('LABEL_NOT_FOUND');
          return true;
        },
      );
    });

    it('should throw NotFoundException if label belongs to another workspace (cross-tenant security)', async () => {
      const created = await service.create('ws_2', { title: 'Internal Only' });

      await expectReject(
        async () => {
          await service.getById('ws_1', created.id);
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          expect(err.response.code).toBe('LABEL_NOT_FOUND');
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

      expect(updated.id).toBe(created.id);
      expect(updated.title).toBe('High Priority Bug');
      expect(updated.color).toBe('#FF0000');
      expect(updated.showOnSidebar).toBe(false);

      const updateEvent = emittedEvents.find(e => e.event === 'label.updated');
      assertDefined(updateEvent);
      expect(updateEvent.payload.label.title).toBe('High Priority Bug');
    });

    it('should throw ConflictException if renaming to an existing title in same workspace', async () => {
      const l1 = await service.create('ws_1', { title: 'First Title' });
      await service.create('ws_1', { title: 'Second Title' });

      await expectReject(
        async () => {
          await service.update('ws_1', l1.id, { title: 'Second Title' });
        },
        (err: any) => {
          expect(err instanceof ConflictException).toBe(true);
          expect(err.response.code).toBe('LABEL_ALREADY_EXISTS');
          return true;
        },
      );
    });

    it('should allow updating without changing the title', async () => {
      const l1 = await service.create('ws_1', { title: 'Original', color: '#000000' });
      const updated = await service.update('ws_1', l1.id, { color: '#FFFFFF' });

      expect(updated.title).toBe('Original');
      expect(updated.color).toBe('#FFFFFF');
    });

    it('should throw NotFoundException if updating non-existent label', async () => {
      await expectReject(
        async () => {
          await service.update('ws_1', 'not_found', { title: 'New' });
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          return true;
        },
      );
    });
  });

  describe('delete', () => {
    it('should delete label and emit label.deleted', async () => {
      const created = await service.create('ws_1', { title: 'To Delete' });
      const result = await service.delete('ws_1', created.id);

      expect(result).toEqual({ success: true });

      const deleteEvent = emittedEvents.find(e => e.event === 'label.deleted');
      assertDefined(deleteEvent);
      expect(deleteEvent.payload.labelId).toBe(created.id);

      await expectReject(async () => {
        await service.getById('ws_1', created.id);
      }, NotFoundException);
    });

    it('should throw NotFoundException if deleting non-existent label', async () => {
      await expectReject(
        async () => {
          await service.delete('ws_1', 'unknown_id');
        },
        (err: any) => {
          expect(err instanceof NotFoundException).toBe(true);
          return true;
        },
      );
    });
  });
});
