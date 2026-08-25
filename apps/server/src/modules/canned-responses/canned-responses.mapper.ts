import type { CannedResponse } from '../../infrastructure/database/generated/client';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma CannedResponse entity to a transport-safe CannedResponseDto.
 */
export function mapCannedResponseToDto(record: CannedResponse): CannedResponseDto {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    shortCode: record.shortCode,
    content: record.content,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    updatedAt: record.updatedAt instanceof Date ? record.updatedAt.toISOString() : record.updatedAt,
  };
}
