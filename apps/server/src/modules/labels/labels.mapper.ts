import type { Label } from '../../infrastructure/database/generated/client';
import type { LabelDto } from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma Label entity to a transport-safe LabelDto.
 */
export function mapLabelToDto(label: Label): LabelDto {
  return {
    id: label.id,
    workspaceId: label.workspaceId,
    title: label.title,
    description: label.description,
    color: label.color,
    showOnSidebar: label.showOnSidebar,
    createdAt: label.createdAt instanceof Date ? label.createdAt.toISOString() : label.createdAt,
    updatedAt: label.updatedAt instanceof Date ? label.updatedAt.toISOString() : label.updatedAt,
  };
}
