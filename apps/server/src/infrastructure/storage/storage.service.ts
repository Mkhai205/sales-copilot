import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleInit, UnsupportedMediaTypeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Prefixes allowed for public read access (without presigned URL) */
const PUBLIC_BUCKET_PREFIXES = ['avatars', 'attachments', 'public'] as const;

/** Map MIME type → file extension */
const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
  'video/mp4': 'mp4',
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly bucketName: string;
  private readonly presignedUrlExpiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.getOrThrow<string>('STORAGE_ENDPOINT');
    this.publicEndpoint = this.configService.getOrThrow<string>('STORAGE_PUBLIC_ENDPOINT');
    this.bucketName = this.configService.getOrThrow<string>('STORAGE_BUCKETS');
    this.presignedUrlExpiresInSeconds = this.configService.getOrThrow<number>(
      'STORAGE_PRESIGNED_URL_EXPIRES_IN_SECONDS',
    );

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region: this.configService.get<string>('STORAGE_REGION', 'us-east-1'),
      forcePathStyle: true, // Required for MinIO
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('STORAGE_ACCESS_KEY'),
        secretAccessKey: this.configService.getOrThrow<string>('STORAGE_SECRET_KEY'),
      },
    });

    this.logger.log(
      `Initialized S3 client with endpoint: ${this.endpoint}, bucket: ${this.bucketName}`,
    );
  }

  async onModuleInit() {
    await this.ensureBucketExists();
    await this.setBucketPublicReadPolicy();
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`👌 Bucket "${this.bucketName}" already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.warn(`🔃 Bucket "${this.bucketName}" not found, creating...`);
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          this.logger.log(`✅ Bucket "${this.bucketName}" created successfully`);
        } catch (createError) {
          this.logger.error(`❌ Failed to create bucket: ${createError}`);
          throw createError;
        }
      } else {
        // Log warning but don't crash the app - bucket will be created on first upload
        this.logger.warn(
          `Could not verify bucket existence (MinIO may not be running): ${error.message || error}`,
        );
        this.logger.warn('Bucket will be created automatically on first file upload');
      }
    }
  }

  private async setBucketPublicReadPolicy() {
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Effect: 'Allow',
          Principal: '*',
          Action: ['s3:GetObject'],
          Resource: PUBLIC_BUCKET_PREFIXES.map(
            prefix => `arn:aws:s3:::${this.bucketName}/${prefix}/*`,
          ),
        },
      ],
    };

    try {
      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucketName,
          Policy: JSON.stringify(bucketPolicy),
        }),
      );
      this.logger.log(
        `👌 Bucket policy set successfully - public read access enabled for: ${PUBLIC_BUCKET_PREFIXES.join(', ')}`,
      );
    } catch (error) {
      this.logger.error(`Failed to set bucket policy: ${error}`);
      // Don't throw - bucket is created, policy can be set manually
    }
  }

  async upload(buffer: Buffer, mimetype: string, key: string) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
        CacheControl: 'public, max-age=31536000',
      }),
    );

    this.logger.debug(`File uploaded successfully: ${key}`);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );

      this.logger.debug(`File deleted successfully: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error}`);
      throw error;
    }
  }

  getPublicUrl(key: string) {
    return `${this.publicEndpoint}/${this.bucketName}/${key}`;
  }

  async getSignedUrl(key: string, expires = this.presignedUrlExpiresInSeconds) {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: expires,
    });
  }

  private getExtension(mimetype: string): string {
    const ext = MIME_EXTENSION_MAP[mimetype];
    if (!ext) {
      throw new UnsupportedMediaTypeException(
        `Unsupported MIME type: "${mimetype}". Allowed types: ${Object.keys(MIME_EXTENSION_MAP).join(', ')}`,
      );
    }
    return ext;
  }
}
