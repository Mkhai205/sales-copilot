export type HealthStatus = 'ok' | 'degraded' | 'down';
export type DependencyStatus = 'up' | 'down';
export type QueueStatus = 'ok' | 'down';

export interface DependencyCheckResult {
  status: DependencyStatus;
  latencyMs: number;
  error?: string;
}

export interface QueueCheckResult {
  status: QueueStatus;
  latencyMs: number;
  jobCounts?: Record<string, number>;
  error?: string;
}

export interface HealthCheckResponse {
  status: HealthStatus;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: {
    database: DependencyCheckResult;
    redis: DependencyCheckResult;
    storage: DependencyCheckResult;
    queues: {
      channelIngestion: QueueCheckResult;
      commentGuard: QueueCheckResult;
    };
  };
}

export interface LivenessResponse {
  status: 'ok';
  service: string;
  uptime: number;
  timestamp: string;
}

export interface DatabaseReadinessCheckResult extends DependencyCheckResult {
  migrationsApplied: boolean;
  migrationCount?: number;
  migrationError?: string;
}

export interface ReadinessResponse {
  status: HealthStatus;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: DatabaseReadinessCheckResult;
    redis: DependencyCheckResult;
    storage: DependencyCheckResult;
    queues: {
      channelIngestion: QueueCheckResult;
      commentGuard: QueueCheckResult;
    };
  };
}
