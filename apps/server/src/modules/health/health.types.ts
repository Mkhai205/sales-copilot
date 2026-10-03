export type HealthStatus = 'ok' | 'degraded' | 'down';
type DependencyStatus = 'up' | 'down';
type QueueStatus = 'ok' | 'down';

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

/** Every BullMQ queue the API hosts, keyed for health/readiness reports. */
export type MonitoredQueueChecks = {
  channelIngestion: QueueCheckResult;
  commentGuard: QueueCheckResult;
  messageOutbound: QueueCheckResult;
  commerceReconciliation: QueueCheckResult;
  aiAutopilot: QueueCheckResult;
  knowledgeEmbedding: QueueCheckResult;
};

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
    queues: MonitoredQueueChecks;
  };
}

export interface LivenessResponse {
  status: 'ok';
  service: string;
  uptime: number;
  timestamp: string;
}

interface DatabaseReadinessCheckResult extends DependencyCheckResult {
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
    queues: MonitoredQueueChecks;
  };
}
