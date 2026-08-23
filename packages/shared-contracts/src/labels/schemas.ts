import { z } from 'zod';

export const createLabelSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Label title is required')
    .max(50, 'Label title cannot exceed 50 characters'),
  description: z
    .string()
    .trim()
    .max(200, 'Description cannot exceed 200 characters')
    .optional()
    .nullable(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format (must be hex #RRGGBB)')
    .default('#2563eb'),
  showOnSidebar: z.boolean().default(true),
});

export type CreateLabelDto = z.input<typeof createLabelSchema>;

export const updateLabelSchema = createLabelSchema.partial();
export type UpdateLabelDto = z.input<typeof updateLabelSchema>;

export const labelSortBySchema = z.enum(['title', 'createdAt', 'updatedAt']);
export type LabelSortBy = z.infer<typeof labelSortBySchema>;

export const labelListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  q: z.string().optional(),
  showOnSidebar: z
    .preprocess(val => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
  sortBy: labelSortBySchema.default('title'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type LabelListQueryDto = z.input<typeof labelListQuerySchema>;
export type LabelListQueryOutput = z.output<typeof labelListQuerySchema>;

export interface LabelDto {
  id: string;
  workspaceId: string;
  title: string;
  description?: string | null;
  color: string;
  showOnSidebar: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ==========================================
// Domain Events
// ==========================================
export interface LabelCreatedEvent {
  workspaceId: string;
  label: LabelDto;
}

export interface LabelUpdatedEvent {
  workspaceId: string;
  label: LabelDto;
}

export interface LabelDeletedEvent {
  workspaceId: string;
  labelId: string;
  label: LabelDto;
}
