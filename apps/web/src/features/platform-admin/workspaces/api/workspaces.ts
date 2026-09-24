import { fetchApi, buildQueryString, type ApiResponse } from '@/lib/api/client';
import type {
  QueryPlatformWorkspacesDto,
  PlatformWorkspaceListItemDto,
  PlatformWorkspaceDetailDto,
  UpdateWorkspacePlanDto,
  ToggleWorkspaceStatusDto,
} from '@sales-copilot/shared-contracts';

export const workspacesApi = {
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
};
