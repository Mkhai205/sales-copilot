// ==========================================
// Platform Overview Metrics DTOs
// ==========================================
export type SystemServiceHealthStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN';

export interface PlatformSystemHealthDto {
  postgres: SystemServiceHealthStatus;
  redis: SystemServiceHealthStatus;
}

export interface PlatformMetricsOverviewDto {
  totalWorkspaces: number;
  activeWorkspaces: number;
  suspendedWorkspaces: number;
  totalUsers: number;
  systemHealth: PlatformSystemHealthDto;
}
