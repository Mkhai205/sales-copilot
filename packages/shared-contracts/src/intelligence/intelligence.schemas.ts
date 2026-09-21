import { z } from 'zod';

export const personaToneSchema = z.enum(['shop_ban', 'em_anh_chi', 'minh_ban', 'chuyen_vien']);
export type PersonaTone = z.infer<typeof personaToneSchema>;
