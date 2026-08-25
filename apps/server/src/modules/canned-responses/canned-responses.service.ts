import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  CannedResponseDto,
  CannedResponseListQueryDto,
  CreateCannedResponseDto,
  UpdateCannedResponseDto,
} from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { mapCannedResponseToDto } from './canned-responses.mapper';

/**
 * Normalizes a canned response shortcode:
 * - Trims leading and trailing whitespace
 * - Strips leading slashes (e.g., `/chao` -> `chao`, `///baogia` -> `baogia`)
 * - Converts to lowercase for case-insensitive matching
 */
export function normalizeShortCode(input: string): string {
  if (!input) return '';
  return input.trim().toLowerCase().replace(/^\/+/, '');
}

@Injectable()
export class CannedResponsesService {
  private readonly logger = new Logger(CannedResponsesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Creates a new Canned Response in a specific workspace.
   * Enforces shortcode normalization and workspace-level uniqueness (`@@unique([workspaceId, shortCode])`).
   */
  async create(workspaceId: string, dto: CreateCannedResponseDto): Promise<CannedResponseDto> {
    const client = this.prisma.getClient();
    const shortCode = normalizeShortCode(dto.shortCode);
    const content = dto.content ? dto.content.trim() : '';

    if (!shortCode) {
      throw new BadRequestException({
        code: 'INVALID_SHORT_CODE',
        message: 'Shortcode cannot be empty or solely slashes',
      });
    }

    if (!content) {
      throw new BadRequestException({
        code: 'INVALID_CONTENT',
        message: 'Content cannot be empty',
      });
    }

    // Check collision in workspace
    const existing = await client.cannedResponse.findFirst({
      where: { workspaceId, shortCode },
    });

    if (existing) {
      throw new ConflictException({
        code: 'CANNED_RESPONSE_ALREADY_EXISTS',
        message: `Canned response with shortcode '/${shortCode}' already exists in this workspace`,
      });
    }

    try {
      const created = await client.cannedResponse.create({
        data: {
          workspaceId,
          shortCode,
          content,
        },
      });

      const responseDto = mapCannedResponseToDto(created);

      this.eventEmitter.emit('canned_response.created', {
        workspaceId,
        cannedResponse: responseDto,
      });

      this.logger.log(
        `Created canned response '/${responseDto.shortCode}' (${responseDto.id}) in workspace '${workspaceId}'`,
      );

      return responseDto;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'CANNED_RESPONSE_ALREADY_EXISTS',
          message: `Canned response with shortcode '/${shortCode}' already exists in this workspace`,
        });
      }
      throw err;
    }
  }

  /**
   * Lists all canned responses within a workspace, with optional prefix/containment search.
   * Results are sorted with prefix matches on shortCode prioritized first, then alphabetical.
   */
  async list(
    workspaceId: string,
    query?: CannedResponseListQueryDto,
  ): Promise<CannedResponseDto[]> {
    const client = this.prisma.getClient();
    const rawSearch = query?.search || query?.q;
    const searchTerm = rawSearch ? normalizeShortCode(rawSearch) : undefined;

    const where: Record<string, unknown> = { workspaceId };

    if (searchTerm && searchTerm !== '') {
      where.OR = [
        { shortCode: { contains: searchTerm, mode: 'insensitive' } },
        { content: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const items = await client.cannedResponse.findMany({
      where,
      orderBy: { shortCode: 'asc' },
    });

    if (searchTerm && searchTerm !== '') {
      items.sort((a, b) => {
        const aStarts = a.shortCode.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        const bStarts = b.shortCode.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        if (aStarts !== bStarts) return bStarts - aStarts;
        return a.shortCode.localeCompare(b.shortCode);
      });
    }

    return items.map(mapCannedResponseToDto);
  }

  /**
   * Retrieves a single canned response by ID within a workspace.
   */
  async getById(workspaceId: string, id: string): Promise<CannedResponseDto> {
    const client = this.prisma.getClient();
    const found = await client.cannedResponse.findFirst({
      where: { id, workspaceId },
    });

    if (!found) {
      throw new NotFoundException({
        code: 'CANNED_RESPONSE_NOT_FOUND',
        message: `Canned response with id '${id}' not found in this workspace`,
      });
    }

    return mapCannedResponseToDto(found);
  }

  /**
   * Updates an existing canned response within a workspace.
   */
  async update(
    workspaceId: string,
    id: string,
    dto: UpdateCannedResponseDto,
  ): Promise<CannedResponseDto> {
    const client = this.prisma.getClient();
    const existing = await client.cannedResponse.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CANNED_RESPONSE_NOT_FOUND',
        message: `Canned response with id '${id}' not found in this workspace`,
      });
    }

    const updateData: Record<string, unknown> = {};

    if (dto.shortCode !== undefined) {
      const newShortCode = normalizeShortCode(dto.shortCode);
      if (!newShortCode) {
        throw new BadRequestException({
          code: 'INVALID_SHORT_CODE',
          message: 'Shortcode cannot be empty or solely slashes',
        });
      }

      if (newShortCode !== existing.shortCode) {
        const collision = await client.cannedResponse.findFirst({
          where: {
            workspaceId,
            shortCode: newShortCode,
            id: { not: id },
          },
        });

        if (collision) {
          throw new ConflictException({
            code: 'CANNED_RESPONSE_ALREADY_EXISTS',
            message: `Canned response with shortcode '/${newShortCode}' already exists in this workspace`,
          });
        }
      }
      updateData.shortCode = newShortCode;
    }

    if (dto.content !== undefined) {
      const newContent = dto.content.trim();
      if (!newContent) {
        throw new BadRequestException({
          code: 'INVALID_CONTENT',
          message: 'Content cannot be empty',
        });
      }
      updateData.content = newContent;
    }

    try {
      const updated = await client.cannedResponse.update({
        where: { id },
        data: updateData,
      });

      const responseDto = mapCannedResponseToDto(updated);

      this.eventEmitter.emit('canned_response.updated', {
        workspaceId,
        cannedResponse: responseDto,
      });

      this.logger.log(
        `Updated canned response '/${responseDto.shortCode}' (${responseDto.id}) in workspace '${workspaceId}'`,
      );

      return responseDto;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new ConflictException({
          code: 'CANNED_RESPONSE_ALREADY_EXISTS',
          message: `Canned response with shortcode already exists in this workspace`,
        });
      }
      throw err;
    }
  }

  /**
   * Deletes a canned response from a workspace.
   */
  async delete(workspaceId: string, id: string): Promise<{ success: true }> {
    const client = this.prisma.getClient();
    const existing = await client.cannedResponse.findFirst({
      where: { id, workspaceId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'CANNED_RESPONSE_NOT_FOUND',
        message: `Canned response with id '${id}' not found in this workspace`,
      });
    }

    await client.cannedResponse.delete({
      where: { id },
    });

    this.eventEmitter.emit('canned_response.deleted', {
      workspaceId,
      cannedResponseId: id,
      shortCode: existing.shortCode,
    });

    this.logger.log(
      `Deleted canned response '/${existing.shortCode}' (${id}) from workspace '${workspaceId}'`,
    );

    return { success: true };
  }
}
