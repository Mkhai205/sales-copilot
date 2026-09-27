import { z } from 'zod';

const trimOrUndefined = (val: unknown) => {
  if (typeof val !== 'string') return val;
  const trimmed = val.trim().replace(/\/+$/, '');
  return trimmed === '' ? undefined : trimmed;
};

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().default(8000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    // Server Base URL (Single Source of Truth for backend origin)
    APP_BASE_URL: z.preprocess(
      trimOrUndefined,
      z
        .string()
        .regex(/^https?:\/\//, 'APP_BASE_URL must start with http:// or https://')
        .url('APP_BASE_URL must be a valid URL')
        .default('http://localhost:8000'),
    ),

    CORS_ORIGIN: z
      .union([z.string(), z.array(z.string())])
      .transform(val => {
        if (Array.isArray(val)) return val;
        return val
          .split(/[,\s]+/)
          .map(origin => origin.trim())
          .filter(origin => origin.length > 0);
      })
      .default(['http://localhost:3000']),

    // Database
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().default(10),
    DATABASE_POOL_MIN: z.coerce.number().default(2),
    DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().default(10000),
    DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().default(5000),

    // Authentication
    JWT_ACCESS_TOKEN_SECRET: z.string().min(1, 'JWT_ACCESS_TOKEN_SECRET is required'),
    JWT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().default(900), // 15 minutes
    REFRESH_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().default(604800), // 7 days

    // Redis / Queue / WebSocket state
    REDIS_URL: z.string().default('redis://localhost:6379'),

    // Storage (MinIO / S3)
    STORAGE_ENDPOINT: z.string().default('http://localhost:9000'),
    STORAGE_PUBLIC_ENDPOINT: z.string().default('http://localhost:9000'),
    STORAGE_REGION: z.string().default('us-east-1'),
    STORAGE_ACCESS_KEY: z.string().min(1, 'STORAGE_ACCESS_KEY is required'),
    STORAGE_SECRET_KEY: z.string().min(1, 'STORAGE_SECRET_KEY is required'),
    STORAGE_BUCKETS: z.string().default('sales-copilot'),
    STORAGE_PRESIGNED_URL_EXPIRES_IN_SECONDS: z.coerce.number().default(900),

    // Channel Credentials Encryption (AES-256-GCM - 32-byte key in hex or string)
    CHANNEL_ENCRYPTION_KEY: z
      .string()
      .min(32, 'CHANNEL_ENCRYPTION_KEY must be at least 32 characters'),

    // Public domain for webhook callbacks (Telegram setWebhook, Facebook OAuth redirect)
    // If omitted or empty, inherits APP_BASE_URL via schema transform
    WEBHOOK_BASE_URL: z.preprocess(
      trimOrUndefined,
      z
        .string()
        .regex(/^https?:\/\//, 'WEBHOOK_BASE_URL must start with http:// or https://')
        .url('WEBHOOK_BASE_URL must be a valid URL')
        .optional(),
    ),

    // Meta / Facebook Platform App (required for OAuth 1-click & Central Webhook)
    FB_APP_ID: z.string().optional(),
    FB_APP_SECRET: z.string().optional(),
    FB_VERIFY_TOKEN: z.string().optional(),

    // LLM Gateway Default API Keys & Vertex AI
    GEMINI_API_KEY: z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
    GOOGLE_VERTEX_PROJECT: z.string().optional(),
    GOOGLE_VERTEX_LOCATION: z.string().optional(),

    // Email Service (Resend)
    RESEND_API_KEY: z.string().optional(),
    RESEND_FROM_EMAIL: z.string().default('Sales Copilot <noreply@example.com>'),
  })
  .transform(data => ({
    ...data,
    WEBHOOK_BASE_URL: data.WEBHOOK_BASE_URL || data.APP_BASE_URL,
  }));

export type EnvConfig = z.infer<typeof envSchema>;
