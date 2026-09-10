import { fetchApi, type ApiResponse } from './client';
import type {
  SystemSettingItemDto,
  UpdateSystemSettingDto,
  SystemSettingCategory,
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
};
