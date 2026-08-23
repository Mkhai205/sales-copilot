import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CreateLabelDto,
  LabelDto,
  LabelListQueryDto,
  UpdateLabelDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapLabelToDto } from './labels.mapper';

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

    // Check collision within workspace
    const existing = await client.label.findFirst({
      where: { workspaceId, title },
    });

    if (existing) {
      throw new ConflictException({
        code: 'LABEL_ALREADY_EXISTS',
        message: `Label with title '${title}' already exists in this workspace`,
      });
    }

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

      const labelDto = mapLabelToDto(created);

      this.eventEmitter.emit('label.created', {
        workspaceId,
        label: labelDto,
      });

      this.logger.log(
        `Created label '${labelDto.title}' (${labelDto.id}) in workspace '${workspaceId}'`,
      );

      return labelDto;
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

    const labels = await client.label.findMany({
      where,
      orderBy: {
        [orderByField]: orderDirection,
      },
    });

    return labels.map(mapLabelToDto);
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

    return mapLabelToDto(label);
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
        where: { id },
        data: updateData,
      });

      const labelDto = mapLabelToDto(updated);

      this.eventEmitter.emit('label.updated', {
        workspaceId,
        label: labelDto,
      });

      this.logger.log(
        `Updated label '${labelDto.title}' (${labelDto.id}) in workspace '${workspaceId}'`,
      );

      return labelDto;
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

    const snapshot = mapLabelToDto(existing);

    await client.label.delete({
      where: { id },
    });

    this.eventEmitter.emit('label.deleted', {
      workspaceId,
      labelId: id,
      label: snapshot,
    });

    this.logger.log(`Deleted label '${snapshot.title}' (${id}) from workspace '${workspaceId}'`);

    return { success: true };
  }
}
