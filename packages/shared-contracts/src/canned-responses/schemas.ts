import { z } from 'zod';

export const createCannedResponseSchema = z.object({
  shortCode: z.string().min(1).max(50),
  content: z.string().min(1),
});
export type CreateCannedResponseDto = z.infer<typeof createCannedResponseSchema>;

export const updateCannedResponseSchema = createCannedResponseSchema.partial();
export type UpdateCannedResponseDto = z.infer<typeof updateCannedResponseSchema>;

export interface CannedResponseDto {
  id: string;
  workspaceId: string;
  shortCode: string;
  content: string;
  createdAt: string;
}
