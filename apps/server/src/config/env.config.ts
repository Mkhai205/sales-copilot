export const APP_CONFIG_KEY = {
  NODE_ENV: 'development',
  PORT: 3000,
  CORS_ORIGIN: 'http://localhost:3000',
} as const;

export const AUTH_CONFIG_KEY = {
  REFRESH_TOKEN_COOKIE_NAME: 'sales-copilot-refresh-token',
  DEFAULT_ACCESS_TOKEN_EXPIRES_IN_SECONDS: 900, // 15m
  DEFAULT_REFRESH_TOKEN_EXPIRES_IN_SECONDS: 604800, // 7d
} as const;

export const DATABASE_CONFIG_KEY = {
  POOL_MAX: 10,
  POOL_MIN: 2,
  POOL_IDLE_TIMEOUT_MS: 10000,
  POOL_CONNECTION_TIMEOUT_MS: 5000,
} as const;

export const STORAGE_CONFIG_KEY = {
  ENDPOINT: 'http://localhost:9000',
  PUBLIC_ENDPOINT: 'http://localhost:9000',
  REGION: 'us-east-1',
  BUCKETS: 'sales-copilot',
  PRESIGNED_URL_EXPIRES_IN_SECONDS: 900,
} as const;
