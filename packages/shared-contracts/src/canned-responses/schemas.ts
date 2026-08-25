import { z } from 'zod';

export const createCannedResponseSchema = z.object({
  shortCode: z
    .string({ required_error: 'Shortcode is required' })
    .min(1, 'Shortcode cannot be empty')
    .max(50, 'Shortcode must be at most 50 characters'),
  content: z.string({ required_error: 'Content is required' }).min(1, 'Content cannot be empty'),
});
export type CreateCannedResponseDto = z.infer<typeof createCannedResponseSchema>;

export const updateCannedResponseSchema = z.object({
  shortCode: z
    .string()
    .min(1, 'Shortcode cannot be empty')
    .max(50, 'Shortcode must be at most 50 characters')
    .optional(),
  content: z.string().min(1, 'Content cannot be empty').optional(),
});
export type UpdateCannedResponseDto = z.infer<typeof updateCannedResponseSchema>;

export const cannedResponseListQuerySchema = z.object({
  search: z.string().optional(),
  q: z.string().optional(),
});
export type CannedResponseListQueryDto = z.infer<typeof cannedResponseListQuerySchema>;

export interface CannedResponseDto {
  id: string;
  workspaceId: string;
  shortCode: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
