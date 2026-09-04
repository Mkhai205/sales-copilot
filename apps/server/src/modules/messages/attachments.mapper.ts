import type { Attachment } from '../../infrastructure/database/generated/client';
import type { AttachmentDto } from '@sales-copilot/shared-contracts';
import { FileType } from '@sales-copilot/shared-contracts';

/**
 * Maps a Prisma Attachment entity to a transport-safe AttachmentDto.
 */
export function mapAttachmentToDto(attachment: Attachment, fileUrl?: string): AttachmentDto {
  const resolvedUrl =
    fileUrl ??
    (attachment.storagePath && attachment.storagePath.startsWith('http')
      ? attachment.storagePath
      : undefined);

  return {
    id: attachment.id,
    messageId: attachment.messageId,
    fileType: attachment.fileType as unknown as FileType,
    fileName: attachment.fileName,
    fileSize: attachment.fileSize,
    storagePath: attachment.storagePath,
    contentType: attachment.contentType,
    fileUrl: resolvedUrl,
    createdAt:
      attachment.createdAt instanceof Date
        ? attachment.createdAt.toISOString()
        : String(attachment.createdAt),
  };
}
