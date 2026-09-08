import { z } from 'zod';
import { InventoryTransactionType } from './pos-enums';

export const adjustInventorySchema = z.object({
  type: z.nativeEnum(InventoryTransactionType),
  quantity: z.coerce.number().int('Số lượng phải là số nguyên').positive('Số lượng phải lớn hơn 0'),
  reason: z.string().trim().min(2, 'Lý do điều chỉnh là bắt buộc'),
});

export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;

export interface InventoryTransactionResponseDto {
  id: string;
  workspaceId: string;
  variantId: string;
  orderId: string | null;
  type: InventoryTransactionType;
  quantity: number;
  previousStock: number;
  newStock: number;
  previousReserved: number;
  newReserved: number;
  reason: string | null;
  performedByUserId: string | null;
  createdAt: Date | string;
}
