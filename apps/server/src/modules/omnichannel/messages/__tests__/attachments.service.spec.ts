import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FileType } from '@sales-copilot/shared-contracts';
import { AttachmentsService, MAX_FILE_SIZE } from '../attachments.service';

describe('AttachmentsService (Task T-1.5.5: Attachment & Media Storage Integration)', () => {
  let service: AttachmentsService;
  let mockPrismaService: any;
  let mockStorageService: any;

  let uploadedFiles: Array<{ key: string; mimetype: string; body: any }>;
  let deletedKeys: string[];
  let attachmentsDb: Map<string, any>;
  let messagesDb: Map<string, any>;

  beforeEach(() => {
    uploadedFiles = [];
    deletedKeys = [];
    attachmentsDb = new Map();
    messagesDb = new Map();

    mockStorageService = {
      upload: async (body: any, mimetype: string, key: string) => {
        uploadedFiles.push({ key, mimetype, body });
      },
      delete: async (key: string) => {
        deletedKeys.push(key);
      },
      getPublicUrl: (key: string) => `http://localhost:9000/sales-copilot-dev/${key}`,
      getSignedUrl: async (key: string, _expires?: number) =>
        `http://localhost:9000/sales-copilot-dev/${key}?signed=true`,
    };

    const clientMock = {
      attachment: {
        findFirst: async ({ where }: { where: any }) => {
          for (const att of attachmentsDb.values()) {
            if (where.id && att.id !== where.id) continue;
            if (where.messageId && att.messageId !== where.messageId) continue;

            if (where.message?.workspaceId) {
              const msg = messagesDb.get(att.messageId);
              if (!msg || msg.workspaceId !== where.message.workspaceId) continue;
            }

            return { ...att };
          }
          return null;
        },

        findMany: async ({ where }: { where: any }) => {
          return Array.from(attachmentsDb.values())
            .filter((att: any) => {
              if (where.messageId && att.messageId !== where.messageId) return false;
              return true;
            })
            .map(att => ({ ...att }));
        },

        create: async ({ data }: { data: any }) => {
          const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const now = new Date();
          const newAttachment = {
            id,
            messageId: data.messageId,
            fileType: data.fileType,
            fileName: data.fileName,
            fileSize: data.fileSize,
            storagePath: data.storagePath,
            contentType: data.contentType,
            createdAt: now,
          };
          attachmentsDb.set(id, newAttachment);
          return { ...newAttachment };
        },

        delete: async ({ where }: { where: { id: string } }) => {
          const existing = attachmentsDb.get(where.id);
          if (existing) {
            attachmentsDb.delete(where.id);
          }
          return existing;
        },

        deleteMany: async ({ where }: { where: any }) => {
          let count = 0;
          for (const [id, att] of Array.from(attachmentsDb.entries())) {
            if (where.messageId && att.messageId === where.messageId) {
              attachmentsDb.delete(id);
              count++;
            }
          }
          return { count };
        },
      },

      message: {
        findFirst: async ({ where, include }: { where: any; include?: any }) => {
          for (const msg of messagesDb.values()) {
            if (where.id && msg.id !== where.id) continue;
            if (where.workspaceId && msg.workspaceId !== where.workspaceId) continue;

            const copy = { ...msg };
            if (include?.attachments) {
              copy.attachments = Array.from(attachmentsDb.values()).filter(
                (att: any) => att.messageId === msg.id,
              );
            }
            return copy;
          }
          return null;
        },
      },
    };

    mockPrismaService = {
      getClient: () => clientMock,
    };

    service = new AttachmentsService(mockPrismaService, mockStorageService);
  });

  describe('validateFile', () => {
    it('should correctly classify image MIME types', () => {
      const result = service.validateFile({
        mimetype: 'image/png',
        size: 1024 * 100,
        originalname: 'screenshot.png',
      });

      assert.strictEqual(result.fileType, FileType.IMAGE);
      assert.strictEqual(result.contentType, 'image/png');
      assert.strictEqual(result.fileName, 'screenshot.png');
      assert.strictEqual(result.fileSize, 1024 * 100);
    });

    it('should correctly classify audio MIME types', () => {
      const result = service.validateFile({
        mimetype: 'audio/mpeg',
        size: 1024 * 500,
        originalname: 'voice_note.mp3',
      });

      assert.strictEqual(result.fileType, FileType.AUDIO);
      assert.strictEqual(result.contentType, 'audio/mpeg');
    });

    it('should correctly classify video MIME types', () => {
      const result = service.validateFile({
        mimetype: 'video/mp4',
        size: 1024 * 1024 * 10,
        originalname: 'demo.mp4',
      });

      assert.strictEqual(result.fileType, FileType.VIDEO);
      assert.strictEqual(result.contentType, 'video/mp4');
    });

    it('should correctly classify document & archive MIME types', () => {
      const pdf = service.validateFile({
        mimetype: 'application/pdf',
        size: 1024 * 200,
        originalname: 'contract.pdf',
      });
      assert.strictEqual(pdf.fileType, FileType.FILE);

      const zip = service.validateFile({
        mimetype: 'application/zip',
        size: 1024 * 300,
        originalname: 'bundle.zip',
      });
      assert.strictEqual(zip.fileType, FileType.FILE);

      const docx = service.validateFile({
        mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024 * 400,
        originalname: 'document.docx',
      });
      assert.strictEqual(docx.fileType, FileType.FILE);
    });

    it('should reject unsupported MIME types with BadRequestException', () => {
      assert.throws(
        () => {
          service.validateFile({
            mimetype: 'application/x-msdownload',
            size: 1024,
            originalname: 'virus.exe',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'UNSUPPORTED_FILE_TYPE');
          return true;
        },
      );
    });

    it('should reject missing MIME type with BadRequestException', () => {
      assert.throws(
        () => {
          service.validateFile({
            size: 1024,
            originalname: 'unknown',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'UNSUPPORTED_FILE_TYPE');
          return true;
        },
      );
    });

    it('should reject empty files (size <= 0) with BadRequestException', () => {
      assert.throws(
        () => {
          service.validateFile({
            mimetype: 'image/png',
            size: 0,
            originalname: 'empty.png',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'EMPTY_FILE');
          return true;
        },
      );
    });

    it('should reject files exceeding MAX_FILE_SIZE (25MB)', () => {
      assert.throws(
        () => {
          service.validateFile({
            mimetype: 'video/mp4',
            size: MAX_FILE_SIZE + 1,
            originalname: 'huge_video.mp4',
          });
        },
        (err: any) => {
          assert.strictEqual(err instanceof BadRequestException, true);
          assert.strictEqual(err.response.code, 'FILE_TOO_LARGE');
          return true;
        },
      );
    });

    it('should sanitize filename removing path traversal and unsafe characters', () => {
      const result = service.validateFile({
        mimetype: 'image/png',
        size: 1024,
        originalname: '../../etc/passwd..//my picture #1!.png',
      });

      assert.strictEqual(result.fileName.includes('..'), false);
      assert.strictEqual(result.fileName.includes('/'), false);
      assert.strictEqual(result.fileName.includes('\\'), false);
    });
  });

  describe('uploadAndCreate', () => {
    it('should upload buffer to MinIO storage and create DB attachment record', async () => {
      const mockBuffer = Buffer.from('fake-image-data');
      const mockMulterFile: any = {
        buffer: mockBuffer,
        mimetype: 'image/jpeg',
        size: mockBuffer.length,
        originalname: 'avatar.jpg',
      };

      const result = await service.uploadAndCreate('ws_100', 'msg_200', mockMulterFile);

      assert.strictEqual(uploadedFiles.length, 1);
      assert.strictEqual(uploadedFiles[0].mimetype, 'image/jpeg');
      assert.strictEqual(uploadedFiles[0].body, mockBuffer);
      assert.match(uploadedFiles[0].key, /^attachments\/ws_100\/msg_200\/[a-f0-9-]+-avatar\.jpg$/);

      assert.strictEqual(result.messageId, 'msg_200');
      assert.strictEqual(result.fileType, FileType.IMAGE);
      assert.strictEqual(result.fileName, 'avatar.jpg');
      assert.strictEqual(result.fileSize, mockBuffer.length);
      assert.strictEqual(result.contentType, 'image/jpeg');
      assert.strictEqual(result.storagePath, uploadedFiles[0].key);
      assert.strictEqual(
        result.fileUrl,
        `http://localhost:9000/sales-copilot-dev/${uploadedFiles[0].key}`,
      );
    });
  });

  describe('createFromExternalUrl', () => {
    it('should create attachment record from external CDN / metadata', async () => {
      const result = await service.createFromExternalUrl('msg_200', {
        fileName: 'facebook_image.jpg',
        fileType: FileType.IMAGE,
        fileSize: 54321,
        storagePath: 'https://cdn.facebook.com/images/12345.jpg',
        contentType: 'image/jpeg',
      });

      assert.strictEqual(result.messageId, 'msg_200');
      assert.strictEqual(result.fileType, FileType.IMAGE);
      assert.strictEqual(result.fileName, 'facebook_image.jpg');
      assert.strictEqual(result.fileSize, 54321);
      assert.strictEqual(result.storagePath, 'https://cdn.facebook.com/images/12345.jpg');
      assert.strictEqual(result.fileUrl, 'https://cdn.facebook.com/images/12345.jpg');
    });
  });

  describe('deleteByMessageId', () => {
    it('should delete S3 objects and DB records for all message attachments', async () => {
      const mockBuffer = Buffer.from('file-content');
      await service.uploadAndCreate('ws_100', 'msg_1', {
        buffer: mockBuffer,
        mimetype: 'image/png',
        size: 100,
        originalname: 'img1.png',
      } as any);

      await service.uploadAndCreate('ws_100', 'msg_1', {
        buffer: mockBuffer,
        mimetype: 'application/pdf',
        size: 200,
        originalname: 'doc1.pdf',
      } as any);

      await service.createFromExternalUrl('msg_1', {
        fileName: 'external.jpg',
        fileType: FileType.IMAGE,
        fileSize: 300,
        storagePath: 'https://external.com/pic.jpg',
        contentType: 'image/jpeg',
      });

      assert.strictEqual(attachmentsDb.size, 3);
      assert.strictEqual(uploadedFiles.length, 2);

      const deleteResult = await service.deleteByMessageId('msg_1');

      assert.strictEqual(deleteResult.deletedCount, 3);
      assert.strictEqual(attachmentsDb.size, 0);
      assert.strictEqual(deletedKeys.length, 2); // External URL was not sent to MinIO delete
    });
  });

  describe('deleteById & tenant isolation', () => {
    it('should delete a single attachment when tenant context matches', async () => {
      messagesDb.set('msg_1', { id: 'msg_1', workspaceId: 'ws_1' });

      const mockBuffer = Buffer.from('single-file');
      const att = await service.uploadAndCreate('ws_1', 'msg_1', {
        buffer: mockBuffer,
        mimetype: 'image/png',
        size: mockBuffer.length,
        originalname: 'photo.png',
      } as any);

      const result = await service.deleteById('ws_1', att.id);
      assert.deepStrictEqual(result, { success: true });
      assert.strictEqual(deletedKeys.includes(att.storagePath), true);
      assert.strictEqual(attachmentsDb.has(att.id), false);
    });

    it('should throw NotFoundException when deleting attachment belonging to another workspace', async () => {
      messagesDb.set('msg_other', { id: 'msg_other', workspaceId: 'ws_other' });

      const mockBuffer = Buffer.from('other-file');
      const att = await service.uploadAndCreate('ws_other', 'msg_other', {
        buffer: mockBuffer,
        mimetype: 'image/png',
        size: mockBuffer.length,
        originalname: 'secret.png',
      } as any);

      await assert.rejects(
        async () => {
          await service.deleteById('ws_1', att.id);
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'ATTACHMENT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('getSignedDownloadUrl', () => {
    it('should generate signed URL for internal storage path within tenant scope', async () => {
      messagesDb.set('msg_1', { id: 'msg_1', workspaceId: 'ws_1' });

      const mockBuffer = Buffer.from('data');
      const att = await service.uploadAndCreate('ws_1', 'msg_1', {
        buffer: mockBuffer,
        mimetype: 'application/pdf',
        size: 50,
        originalname: 'doc.pdf',
      } as any);

      const signedUrl = await service.getSignedDownloadUrl(att.id, 'ws_1', 600);
      assert.strictEqual(
        signedUrl,
        `http://localhost:9000/sales-copilot-dev/${att.storagePath}?signed=true`,
      );
    });

    it('should return raw URL for external CDN attachment', async () => {
      messagesDb.set('msg_1', { id: 'msg_1', workspaceId: 'ws_1' });

      const att = await service.createFromExternalUrl('msg_1', {
        fileName: 'cdn.png',
        fileType: FileType.IMAGE,
        fileSize: 100,
        storagePath: 'https://cdn.telegram.org/file_123.png',
        contentType: 'image/png',
      });

      const signedUrl = await service.getSignedDownloadUrl(att.id, 'ws_1');
      assert.strictEqual(signedUrl, 'https://cdn.telegram.org/file_123.png');
    });

    it('should throw NotFoundException on cross-tenant getSignedDownloadUrl access', async () => {
      messagesDb.set('msg_secret', { id: 'msg_secret', workspaceId: 'ws_company_a' });

      const att = await service.createFromExternalUrl('msg_secret', {
        fileName: 'secret.pdf',
        fileType: FileType.FILE,
        fileSize: 500,
        storagePath: 'attachments/ws_company_a/msg_secret/uuid-secret.pdf',
        contentType: 'application/pdf',
      });

      await assert.rejects(
        async () => {
          await service.getSignedDownloadUrl(att.id, 'ws_company_b');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'ATTACHMENT_NOT_FOUND');
          return true;
        },
      );
    });
  });

  describe('getAttachmentById & listByMessageId', () => {
    beforeEach(async () => {
      messagesDb.set('msg_shared', { id: 'msg_shared', workspaceId: 'ws_main' });

      const mockBuffer = Buffer.from('data');
      await service.uploadAndCreate('ws_main', 'msg_shared', {
        buffer: mockBuffer,
        mimetype: 'image/jpeg',
        size: 50,
        originalname: 'img1.jpg',
      } as any);

      await service.uploadAndCreate('ws_main', 'msg_shared', {
        buffer: mockBuffer,
        mimetype: 'video/mp4',
        size: 500,
        originalname: 'video1.mp4',
      } as any);
    });

    it('should get attachment by id within workspace', async () => {
      const all = await service.listByMessageId('msg_shared', 'ws_main');
      assert.strictEqual(all.length, 2);

      const single = await service.getAttachmentById(all[0].id, 'ws_main');
      assert.strictEqual(single.id, all[0].id);
      assert.strictEqual(single.fileName, all[0].fileName);
    });

    it('should throw NotFoundException when listing attachments for message in different workspace', async () => {
      await assert.rejects(
        async () => {
          await service.listByMessageId('msg_shared', 'ws_other');
        },
        (err: any) => {
          assert.strictEqual(err instanceof NotFoundException, true);
          assert.strictEqual(err.response.code, 'MESSAGE_NOT_FOUND');
          return true;
        },
      );
    });
  });
});
