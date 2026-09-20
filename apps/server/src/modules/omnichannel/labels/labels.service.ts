import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateLabelDto,
  LabelDto,
  LabelListQueryDto,
  UpdateLabelDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../../infrastructure/database';

@Injectable()
export class LabelsService {
  private readonly logger = new Logger(LabelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Label within a specific workspace.
   * Enforces title uniqueness per workspace (`@@unique([workspaceId, title])`).
   */
  async create(workspaceId: string, dto: CreateLabelDto): Promise<LabelDto> {
    const client = this.prisma.getClient();
    const title = dto.title.trim();
    const description =
      dto.description && dto.description.trim() !== '' ? dto.description.trim() : null;
    const color = dto.color && dto.color.trim() !== '' ? dto.color.trim() : '#2563eb';
    const showOnSidebar = dto.showOnSidebar ?? true;

    try {
      const created = await client.label.create({
        data: {
          workspaceId,
          title,
          description,
          color,
          showOnSidebar,
        },
      });

      this.eventEmitter.emit('label.created', {
        workspaceId,
        label: created,
      });

      this.logger.log(
        `Created label '${created.title}' (${created.id}) in workspace '${workspaceId}'`,
      );

      return created;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'LABEL_ALREADY_EXISTS',
          message: `Label with title '${title}' already exists in this workspace`,
        });
      }
      throw err;
    }
  }

  /**
   * Lists all labels within a workspace with optional filters and sorting.
   */
  async list(workspaceId: string, query?: LabelListQueryDto): Promise<LabelDto[]> {
    const client = this.prisma.getClient();
    const where: Record<string, unknown> = { workspaceId };

    if (query?.q && query.q.trim() !== '') {
      where.title = {
        contains: query.q.trim(),
        mode: 'insensitive',
      };
    }

    if (query?.showOnSidebar !== undefined) {
      where.showOnSidebar = query.showOnSidebar;
    }

    const orderByField = query?.sortBy || 'title';
    const orderDirection = query?.sortOrder || 'asc';

    return client.label.findMany({
      where,
      orderBy: {
        [orderByField]: orderDirection,
      },
    });
  }

  /**
   * Retrieves a single label by ID within a workspace.
   */
  async getById(workspaceId: string, id: string): Promise<LabelDto> {
    const client = this.prisma.getClient();
    const label = await client.label.findFirst({
      where: { id, workspaceId },
    });

    if (!label) {
      throw new NotFoundException({
        code: 'LABEL_NOT_FOUND',
        message: `Label with id '${id}' not found in this workspace`,
      });
    }

    return label;
  }

  /**
   * Updates an existing label within a workspace.
   */
  async update(workspaceId: string, id: string, dto: UpdateLabelDto): Promise<LabelDto> {
    const client = this.prisma.getClient();
    const existing = await client.label.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LABEL_NOT_FOUND',
        message: `Label with id '${id}' not found in this workspace`,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (dto.title !== undefined) {
      const newTitle = dto.title.trim();
      if (newTitle !== existing.title) {
        const titleCollision = await client.label.findFirst({
          where: {
            workspaceId,
            title: newTitle,
            id: { not: id },
          },
        });

        if (titleCollision) {
          throw new ConflictException({
            code: 'LABEL_ALREADY_EXISTS',
            message: `Label with title '${newTitle}' already exists in this workspace`,
          });
        }
      }
      updateData.title = newTitle;
    }

    if (dto.description !== undefined) {
      updateData.description =
        dto.description && dto.description.trim() !== '' ? dto.description.trim() : null;
    }

    if (dto.color !== undefined) {
      updateData.color = dto.color.trim();
    }

    if (dto.showOnSidebar !== undefined) {
      updateData.showOnSidebar = dto.showOnSidebar;
    }

    try {
      const updated = await client.label.update({
        where: { workspaceId_id: { workspaceId, id } },
        data: updateData,
      });

      this.eventEmitter.emit('label.updated', {
        workspaceId,
        label: updated,
      });

      this.logger.log(
        `Updated label '${updated.title}' (${updated.id}) in workspace '${workspaceId}'`,
      );

      return updated;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'LABEL_ALREADY_EXISTS',
          message: `Label with title '${dto.title}' already exists in this workspace`,
        });
      }
      throw err;
    }
  }

  /**
   * Deletes a label from a workspace.
   * Relational junctions in ConversationLabel will be cascade-deleted by database foreign key.
   */
  async delete(workspaceId: string, id: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();
    const existing = await client.label.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'LABEL_NOT_FOUND',
        message: `Label with id '${id}' not found in this workspace`,
      });
    }

    await client.label.delete({
      where: { workspaceId_id: { workspaceId, id } },
    });

    this.eventEmitter.emit('label.deleted', {
      workspaceId,
      labelId: id,
      label: existing,
    });

    this.logger.log(`Deleted label '${existing.title}' (${id}) from workspace '${workspaceId}'`);

    return { success: true };
  }
}
