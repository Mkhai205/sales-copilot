import type { AuditLog, User } from '../../infrastructure/database/generated/client';
import type { AuditLogDto } from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma AuditLog entity (with optional user relation) to AuditLogDto.
 */
export function mapAuditLogToDto(
  record: AuditLog & {
    user?: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'> | null;
  },
): AuditLogDto {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    userId: record.userId,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId,
    payload: (record.payload as Record<string, unknown>) ?? null,
    ipAddress: record.ipAddress,
    createdAt: record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt,
    user: record.user
      ? {
          id: record.user.id,
          email: record.user.email,
          name: record.user.name,
          avatarUrl: record.user.avatarUrl,
        }
      : null,
  };
}
