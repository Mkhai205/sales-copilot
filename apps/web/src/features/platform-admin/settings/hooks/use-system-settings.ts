'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type {
  SystemSettingCategory,
  SystemSettingItemDto,
  UpdateSystemSettingDto,
} from '@sales-copilot/shared-contracts';
import { systemSettingsApi } from '../api/settings';
import { platformAdminKeys } from '@/lib/query-keys';

export function useSystemSettings(category?: SystemSettingCategory | string) {
  return useQuery<SystemSettingItemDto[]>({
    queryKey: platformAdminKeys.settings.list(category),
    queryFn: async () => {
      const res = await systemSettingsApi.getSettings(category);
      return res.data;
    },
    staleTime: 30_000,
  });
}

export interface UpdateSettingParams {
  key: string;
  payload: UpdateSystemSettingDto;
  silent?: boolean;
}

export function useUpdateSystemSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, payload }: UpdateSettingParams) => {
      const res = await systemSettingsApi.updateSetting(key, payload);
      return res.data;
    },
    onMutate: async ({ key, payload }) => {
      await queryClient.cancelQueries({ queryKey: platformAdminKeys.settings.all });

      // Snapshot previous caches
      const previousData = queryClient.getQueriesData<SystemSettingItemDto[]>({
        queryKey: platformAdminKeys.settings.all,
      });

      // Optimistically update all matching cached queries
      queryClient.setQueriesData<SystemSettingItemDto[]>(
        { queryKey: platformAdminKeys.settings.all },
        old => {
          if (!old) return old;
          return old.map(setting =>
            setting.key === key
              ? {
                  ...setting,
                  value: payload.value !== undefined ? payload.value : setting.value,
                  description:
                    payload.description !== undefined ? payload.description : setting.description,
                  updatedAt: new Date(),
                }
              : setting,
          );
        },
      );

      return { previousData };
    },
    onError: (error: Error, _variables, context) => {
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
      toast.error(error.message || 'Cập nhật cấu hình thất bại');
    },
    onSuccess: (_data, variables) => {
      if (!variables.silent) {
        toast.success('Cập nhật cấu hình thành công');
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: platformAdminKeys.settings.all });
    },
  });
}
