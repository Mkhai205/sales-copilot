import { z } from 'zod';
import { SystemSettingCategory } from './enums';

// ==========================================
// 1. Query & Mutation Schemas
// ==========================================
export const querySystemSettingsSchema = z.object({
  category: z.nativeEnum(SystemSettingCategory).optional(),
});

export type QuerySystemSettingsDto = z.infer<typeof querySystemSettingsSchema>;

export const updateSystemSettingSchema = z.object({
  value: z.unknown(),
  description: z.string().trim().optional(),
});

export type UpdateSystemSettingDto = z.infer<typeof updateSystemSettingSchema>;

// ==========================================
// 2. Response DTOs
// ==========================================
export interface SystemSettingItemDto {
  key: string;
  value: unknown;
  category: SystemSettingCategory | string;
  description?: string | null;
  isEncrypted: boolean;
  updatedBy?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}
