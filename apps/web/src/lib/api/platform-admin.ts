import { fetchApi, buildQueryString, type ApiResponse } from './client';
import type {
  SystemSettingItemDto,
  UpdateSystemSettingDto,
  SystemSettingCategory,
  QueryPlatformWorkspacesDto,
  PlatformWorkspaceListItemDto,
  PlatformWorkspaceDetailDto,
  UpdateWorkspacePlanDto,
  ToggleWorkspaceStatusDto,
  QueryPlatformAuditLogsDto,
  PlatformAuditLogDto,
} from '@sales-copilot/shared-contracts';

export const platformAdminApi = {
  /**
   * Fetch all dynamic system settings or filter by category.
   */
  async getSettings(
    category?: SystemSettingCategory | string,
  ): Promise<ApiResponse<SystemSettingItemDto[]>> {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetchApi<SystemSettingItemDto[]>(`/platform-admin/settings${query}`);
  },

  /**
   * Update a specific dynamic system setting.
   */
  async updateSetting(
    key: string,
    payload: UpdateSystemSettingDto,
  ): Promise<ApiResponse<SystemSettingItemDto>> {
    return fetchApi<SystemSettingItemDto>(`/platform-admin/settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Fetch paginated workspaces with optional search, plan, status filters.
   */
  async getWorkspaces(
    params?: Partial<QueryPlatformWorkspacesDto>,
  ): Promise<ApiResponse<PlatformWorkspaceListItemDto[]>> {
    const qs = buildQueryString(params);
    return fetchApi<PlatformWorkspaceListItemDto[]>(`/platform-admin/workspaces${qs}`);
  },

  /**
   * Get single workspace technical details, quotas, and usage breakdown.
   */
  async getWorkspaceDetail(id: string): Promise<ApiResponse<PlatformWorkspaceDetailDto>> {
    return fetchApi<PlatformWorkspaceDetailDto>(
      `/platform-admin/workspaces/${encodeURIComponent(id)}`,
    );
  },

  /**
   * Update billing plan and/or custom quotas for a workspace.
   */
  async updateWorkspacePlan(
    id: string,
    payload: UpdateWorkspacePlanDto,
  ): Promise<ApiResponse<PlatformWorkspaceDetailDto>> {
    return fetchApi<PlatformWorkspaceDetailDto>(
      `/platform-admin/workspaces/${encodeURIComponent(id)}/plan`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  /**
   * Suspend or activate a workspace.
   */
  async toggleWorkspaceStatus(
    id: string,
    payload: ToggleWorkspaceStatusDto,
  ): Promise<ApiResponse<PlatformWorkspaceDetailDto>> {
    return fetchApi<PlatformWorkspaceDetailDto>(
      `/platform-admin/workspaces/${encodeURIComponent(id)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  /**
   * Fetch paginated platform audit logs with optional filtering.
   */
  async getAuditLogs(
    params?: Partial<QueryPlatformAuditLogsDto>,
  ): Promise<ApiResponse<PlatformAuditLogDto[]>> {
    const qs = buildQueryString(params);
    return fetchApi<PlatformAuditLogDto[]>(`/platform-admin/audit-logs${qs}`);
  },

  /**
   * Get single platform audit log by ID.
   */
  async getAuditLogById(id: string): Promise<ApiResponse<PlatformAuditLogDto>> {
    return fetchApi<PlatformAuditLogDto>(`/platform-admin/audit-logs/${encodeURIComponent(id)}`);
  },
};
