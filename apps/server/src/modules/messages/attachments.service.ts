import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import type { AttachmentDto } from '@sales-copilot/shared-contracts';
import { FileType } from '@sales-copilot/shared-contracts';
import { PrismaService } from '../../infrastructure/database';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { mapAttachmentToDto } from './attachments.mapper';

/**
 * Supported MIME type mapping to FileType enum.
 */
export const ALLOWED_MIME_TYPES: Record<string, FileType> = {
  // Images
  'image/jpeg': FileType.IMAGE,
  'image/png': FileType.IMAGE,
  'image/gif': FileType.IMAGE,
  'image/webp': FileType.IMAGE,
  'image/svg+xml': FileType.IMAGE,
  // Audio
  'audio/mpeg': FileType.AUDIO,
  'audio/ogg': FileType.AUDIO,
  'audio/wav': FileType.AUDIO,
  'audio/mp4': FileType.AUDIO,
  'audio/webm': FileType.AUDIO,
  'audio/aac': FileType.AUDIO,
  // Video
  'video/mp4': FileType.VIDEO,
  'video/webm': FileType.VIDEO,
  'video/quicktime': FileType.VIDEO,
  'video/ogg': FileType.VIDEO,
  // Documents & General Files
  'application/pdf': FileType.FILE,
  'text/plain': FileType.FILE,
  'text/csv': FileType.FILE,
  'application/zip': FileType.FILE,
  'application/x-zip-compressed': FileType.FILE,
  'application/msword': FileType.FILE,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.FILE,
  'application/vnd.ms-excel': FileType.FILE,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.FILE,
  'application/vnd.ms-powerpoint': FileType.FILE,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': FileType.FILE,
  'application/json': FileType.FILE,
};

/**
 * Maximum file upload limit: 25MB (in bytes).
 */
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

export interface UploadedFile {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface FileValidationInput {
  mimetype?: string;
  mimeType?: string;
  size: number;
  originalname?: string;
  filename?: string;
}

export interface ValidatedFileInfo {
  fileType: FileType;
  contentType: string;
  fileSize: number;
  fileName: string;
}

export interface ExternalAttachmentData {
  fileName: string;
  fileType: FileType;
  fileSize: number;
  storagePath: string;
  contentType: string;
  fileUrl?: string;
}

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  /**
   * Validates a file's size and MIME type against the whitelist.
   */
  validateFile(file: FileValidationInput): ValidatedFileInfo {
    const rawMime = file.mimetype || file.mimeType;
    if (!rawMime) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: 'File content type is required',
      });
    }

    const mimeType = rawMime.toLowerCase().trim();
    const fileType = ALLOWED_MIME_TYPES[mimeType];

    if (!fileType) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_FILE_TYPE',
        message: `File type '${mimeType}' is not supported`,
      });
    }

    if (file.size <= 0) {
      throw new BadRequestException({
        code: 'EMPTY_FILE',
        message: 'File cannot be empty',
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File size (${(file.size / (1024 * 1024)).toFixed(2)}MB) exceeds maximum limit of 25MB`,
      });
    }

    const rawName = file.originalname || file.filename || 'attachment';
    const fileName = this.sanitizeFileName(rawName);

    return {
      fileType,
      contentType: mimeType,
      fileSize: file.size,
      fileName,
    };
  }

  /**
   * Uploads file buffer to MinIO / S3 storage and creates an Attachment record in database.
   */
  async uploadAndCreate(
    workspaceId: string,
    messageId: string,
    file: UploadedFile,
    tx?: any,
  ): Promise<AttachmentDto> {
    const validated = this.validateFile(file);

    const storageKey = this.generateStorageKey(workspaceId, messageId, validated.fileName);

    // Upload buffer to S3 / MinIO
    await this.storageService.upload(file.buffer, validated.contentType, storageKey);

    const client = tx ?? this.prisma.getClient();
    const attachment = await client.attachment.create({
      data: {
        messageId,
        fileType: validated.fileType,
        fileName: validated.fileName,
        fileSize: validated.fileSize,
        storagePath: storageKey,
        contentType: validated.contentType,
      },
    });

    const fileUrl = this.storageService.getPublicUrl(storageKey);

    this.logger.debug(
      `Created attachment ${attachment.id} for message ${messageId} at path ${storageKey}`,
    );

    return mapAttachmentToDto(attachment, fileUrl);
  }

  /**
   * Creates an Attachment record from an external URL or predefined storage path (for webhooks/ingestion).
   */
  async createFromExternalUrl(
    messageId: string,
    data: ExternalAttachmentData,
    tx?: any,
  ): Promise<AttachmentDto> {
    const client = tx ?? this.prisma.getClient();

    const attachment = await client.attachment.create({
      data: {
        messageId,
        fileType: data.fileType,
        fileName: this.sanitizeFileName(data.fileName),
        fileSize: data.fileSize,
        storagePath: data.storagePath,
        contentType: data.contentType,
      },
    });

    const fileUrl =
      data.fileUrl ??
      (data.storagePath.startsWith('http')
        ? data.storagePath
        : this.storageService.getPublicUrl(data.storagePath));

    return mapAttachmentToDto(attachment, fileUrl);
  }

  /**
   * Deletes all attachments belonging to a message from both MinIO/S3 and database.
   */
  async deleteByMessageId(messageId: string, tx?: any): Promise<{ deletedCount: number }> {
    const client = tx ?? this.prisma.getClient();

    const attachments = await client.attachment.findMany({
      where: { messageId },
    });

    for (const attachment of attachments) {
      if (attachment.storagePath && !attachment.storagePath.startsWith('http')) {
        try {
          await this.storageService.delete(attachment.storagePath);
        } catch (err) {
          this.logger.warn(
            `Failed to delete storage object for attachment ${attachment.id} (${attachment.storagePath}): ${err}`,
          );
        }
      }
    }

    const result = await client.attachment.deleteMany({
      where: { messageId },
    });

    this.logger.debug(`Deleted ${result.count} attachments for message ${messageId}`);

    return { deletedCount: result.count };
  }

  /**
   * Deletes a single attachment by ID with tenant isolation verification.
   */
  async deleteById(
    workspaceId: string,
    attachmentId: string,
    tx?: any,
  ): Promise<{ success: true }> {
    const client = tx ?? this.prisma.getClient();

    const attachment = await client.attachment.findFirst({
      where: {
        id: attachmentId,
        message: { workspaceId },
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: `Attachment with id '${attachmentId}' not found in this workspace`,
      });
    }

    if (attachment.storagePath && !attachment.storagePath.startsWith('http')) {
      try {
        await this.storageService.delete(attachment.storagePath);
      } catch (err) {
        this.logger.warn(
          `Failed to delete storage object for attachment ${attachment.id} (${attachment.storagePath}): ${err}`,
        );
      }
    }

    await client.attachment.delete({
      where: { id: attachmentId },
    });

    this.logger.debug(`Deleted attachment ${attachmentId} in workspace ${workspaceId}`);

    return { success: true };
  }

  /**
   * Generates a time-limited presigned S3 download URL for an attachment with tenant isolation.
   */
  async getSignedDownloadUrl(
    attachmentId: string,
    workspaceId: string,
    expiresIn?: number,
  ): Promise<string> {
    const client = this.prisma.getClient();

    const attachment = await client.attachment.findFirst({
      where: {
        id: attachmentId,
        message: { workspaceId },
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: `Attachment with id '${attachmentId}' not found in this workspace`,
      });
    }

    if (attachment.storagePath.startsWith('http')) {
      return attachment.storagePath;
    }

    return this.storageService.getSignedUrl(attachment.storagePath, expiresIn);
  }

  /**
   * Retrieves an attachment by ID with tenant isolation.
   */
  async getAttachmentById(attachmentId: string, workspaceId: string): Promise<AttachmentDto> {
    const client = this.prisma.getClient();

    const attachment = await client.attachment.findFirst({
      where: {
        id: attachmentId,
        message: { workspaceId },
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: `Attachment with id '${attachmentId}' not found in this workspace`,
      });
    }

    const fileUrl = attachment.storagePath.startsWith('http')
      ? attachment.storagePath
      : this.storageService.getPublicUrl(attachment.storagePath);

    return mapAttachmentToDto(attachment, fileUrl);
  }

  /**
   * Lists all attachments for a specific message within the workspace.
   */
  async listByMessageId(messageId: string, workspaceId: string): Promise<AttachmentDto[]> {
    const client = this.prisma.getClient();

    const message = await client.message.findFirst({
      where: { id: messageId, workspaceId },
      include: { attachments: true },
    });

    if (!message) {
      throw new NotFoundException({
        code: 'MESSAGE_NOT_FOUND',
        message: `Message with id '${messageId}' not found in this workspace`,
      });
    }

    return message.attachments.map(att => {
      const fileUrl = att.storagePath.startsWith('http')
        ? att.storagePath
        : this.storageService.getPublicUrl(att.storagePath);
      return mapAttachmentToDto(att, fileUrl);
    });
  }

  /**
   * Generates a unique, standardized S3 key for attachments.
   * Path: attachments/{workspaceId}/{messageId}/{uuid}-{sanitizedFilename}
   */
  private generateStorageKey(workspaceId: string, messageId: string, fileName: string): string {
    const uniquePrefix = randomUUID();
    return `attachments/${workspaceId}/${messageId}/${uniquePrefix}-${fileName}`;
  }

  /**
   * Sanitizes a file name, removing dangerous path traversal and special characters.
   */
  private sanitizeFileName(rawName: string): string {
    const basename = path.basename(rawName).trim();
    // Replace characters that could cause issues in S3 keys / HTTP headers
    return basename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100) || 'attachment';
  }
}
