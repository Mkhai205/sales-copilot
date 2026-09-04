import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Readable } from 'stream';

/** Prefixes allowed for public read access (without presigned URL) */
const PUBLIC_BUCKET_PREFIXES = ['avatars', 'attachments', 'public'] as const;

export type StorageUploadBody = Buffer | Uint8Array | Readable | Blob | string;

@Injectable()
export class StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StorageService.name);
  private readonly s3Client: S3Client;
  private readonly signerClient: S3Client;
  private readonly endpoint: string;
  private readonly publicEndpoint: string;
  private readonly bucketName: string;
  private readonly presignedUrlExpiresInSeconds: number;

  constructor(private readonly configService: ConfigService) {
    this.endpoint = this.configService.getOrThrow<string>('STORAGE_ENDPOINT').replace(/\/+$/, '');
    this.publicEndpoint = this.configService
      .getOrThrow<string>('STORAGE_PUBLIC_ENDPOINT')
      .replace(/\/+$/, '');
    this.bucketName = this.configService.getOrThrow<string>('STORAGE_BUCKETS');
    this.presignedUrlExpiresInSeconds = this.configService.get<number>(
      'STORAGE_PRESIGNED_URL_EXPIRES_IN_SECONDS',
      900,
    );

    const region = this.configService.get<string>('STORAGE_REGION', 'us-east-1');
    const credentials = {
      accessKeyId: this.configService.getOrThrow<string>('STORAGE_ACCESS_KEY'),
      secretAccessKey: this.configService.getOrThrow<string>('STORAGE_SECRET_KEY'),
    };

    this.s3Client = new S3Client({
      endpoint: this.endpoint,
      region,
      forcePathStyle: true, // Required for MinIO
      credentials,
    });

    this.signerClient =
      this.endpoint === this.publicEndpoint
        ? this.s3Client
        : new S3Client({
            endpoint: this.publicEndpoint,
            region,
            forcePathStyle: true,
            credentials,
          });

    this.logger.log(
      `Initialized S3 client with endpoint: ${this.endpoint}, publicEndpoint: ${this.publicEndpoint}, bucket: ${this.bucketName}`,
    );
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists();
    await this.setBucketPublicReadPolicy();
  }

  onModuleDestroy(): void {
    try {
      this.s3Client.destroy();
      if (this.signerClient !== this.s3Client) {
        this.signerClient.destroy();
      }
      this.logger.log('🔌 S3 client destroyed gracefully');
    } catch (err) {
      this.logger.error('Error destroying S3 client:', err);
    }
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`👌 Bucket "${this.bucketName}" already exists`);
    } catch (error: unknown) {
      const err = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
        message?: string;
      };
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
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
          `Could not verify bucket existence (MinIO may not be running): ${err.message || error}`,
        );
        this.logger.warn('Bucket will be created automatically on first file upload');
      }
    }
  }

  private async setBucketPublicReadPolicy(): Promise<void> {
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

  async upload(body: StorageUploadBody, mimetype: string, key: string): Promise<void> {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body as any,
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

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getObjectStream(key: string): Promise<Readable | null> {
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: key,
        }),
      );
      return (response.Body as Readable) ?? null;
    } catch (error) {
      this.logger.error(`Failed to get object stream for key ${key}:`, error);
      return null;
    }
  }

  getPublicUrl(key: string): string {
    return `${this.publicEndpoint}/${this.bucketName}/${key}`;
  }

  async getSignedUrl(key: string, expires = this.presignedUrlExpiresInSeconds): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.signerClient, command, {
      expiresIn: expires,
    });
  }

  /**
   * Healthcheck function to verify S3/MinIO bucket connectivity.
   */
  async ping(): Promise<{ status: 'up' | 'down'; latencyMs: number; error?: string }> {
    const start = Date.now();
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      const latencyMs = Date.now() - start;
      return { status: 'up', latencyMs };
    } catch (err) {
      const latencyMs = Date.now() - start;
      return {
        status: 'down',
        latencyMs,
        error: (err as Error)?.message || 'Storage unreachable',
      };
    }
  }
}
