import { z } from 'zod';

export const widgetContactRequestSchema = z.object({
  websiteToken: z.string().optional(),
  widgetToken: z.string().optional(),
  website_token: z.string().optional(),
  widget_token: z.string().optional(),
  contactToken: z.string().optional(),
  contact_token: z.string().optional(),
  identifier: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  customAttributes: z.record(z.unknown()).optional(),
});

export type WidgetContactRequestDto = z.infer<typeof widgetContactRequestSchema>;

export const widgetContactResponseSchema = z.object({
  token: z.string(),
  contactToken: z.string(),
  contact: z.record(z.unknown()),
  isNewContact: z.boolean(),
});

export type WidgetContactResponseDto = z.infer<typeof widgetContactResponseSchema>;
