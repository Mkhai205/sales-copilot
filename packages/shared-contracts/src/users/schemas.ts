import { z } from 'zod';
import { PlatformRole } from '../auth/enums';

export const updateUserProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional(),
});
export type UpdateUserProfileDto = z.infer<typeof updateUserProfileSchema>;

export interface UserProfileDto {
  id: string;
  email: string;
  name: string;
  role: PlatformRole;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
}
