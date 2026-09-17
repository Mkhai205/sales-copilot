import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Team name is required')
    .max(100, 'Team name must not exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(500, 'Description must not exceed 500 characters')
    .optional()
    .nullable(),
});
export type CreateTeamDto = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;

export const addTeamMembersSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid user UUID')).min(1, 'At least one userId is required'),
});
export type AddTeamMembersDto = z.infer<typeof addTeamMembersSchema>;

export const removeTeamMembersSchema = z.object({
  userIds: z.array(z.string().uuid('Invalid user UUID')).min(1, 'At least one userId is required'),
});
export type RemoveTeamMembersDto = z.infer<typeof removeTeamMembersSchema>;

export interface TeamMemberUserDto {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface TeamMemberDto {
  id: string;
  teamId: string;
  userId: string;
  user?: TeamMemberUserDto;
  createdAt: string | Date;
}

export interface TeamDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  memberCount?: number;
  members?: TeamMemberDto[];
  createdAt: string | Date;
  updatedAt?: string | Date;
}
