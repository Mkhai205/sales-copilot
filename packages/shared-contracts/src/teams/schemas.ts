import { z } from 'zod';

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allowAutoAssign: z.boolean().default(true),
});
export type CreateTeamDto = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = createTeamSchema.partial();
export type UpdateTeamDto = z.infer<typeof updateTeamSchema>;

export interface TeamDto {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  allowAutoAssign: boolean;
  memberCount?: number;
  createdAt: string;
}

export interface TeamMemberDto {
  id: string;
  teamId: string;
  userId: string;
  createdAt: string;
}
