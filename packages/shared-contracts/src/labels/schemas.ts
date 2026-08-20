import { z } from 'zod';

export const createLabelSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#4F46E5'),
  showOnSidebar: z.boolean().default(true),
});
export type CreateLabelDto = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = createLabelSchema.partial();
export type UpdateLabelDto = z.infer<typeof updateLabelSchema>;

export interface LabelDto {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  color: string;
  showOnSidebar: boolean;
  createdAt: string;
}
