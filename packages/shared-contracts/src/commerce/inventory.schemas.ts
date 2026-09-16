import { z } from 'zod';
import { InventoryTransactionType } from './commerce-enums';

export const adjustInventorySchema = z
  .object({
    type: z.nativeEnum(InventoryTransactionType),
    quantity: z.coerce.number().int('Số lượng phải là số nguyên'),
    reason: z.string().trim().min(2, 'Lý do điều chỉnh là bắt buộc'),
  })
  .superRefine((data, ctx) => {
    if (data.type === InventoryTransactionType.INVENTORY_AUDIT) {
      if (data.quantity < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số lượng kiểm kê thực tế không được âm',
          path: ['quantity'],
        });
      }
    } else {
      if (data.quantity <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Số lượng điều chỉnh phải lớn hơn 0',
          path: ['quantity'],
        });
      }
    }
  });

export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;

export const listInventoryTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  variantId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  type: z.nativeEnum(InventoryTransactionType).optional(),
});

export type ListInventoryTransactionsQueryDto = z.input<
  typeof listInventoryTransactionsQuerySchema
>;
export type ListInventoryTransactionsQueryOutput = z.infer<
  typeof listInventoryTransactionsQuerySchema
>;

export const listInventoryVariantsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  lowStock: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return val;
  }, z.boolean().optional()),
  outOfStock: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return val;
  }, z.boolean().optional()),
  sortBy: z
    .enum(['sku', 'name', 'stockQuantity', 'availableStock', 'updatedAt'])
    .default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListInventoryVariantsQueryDto = z.input<typeof listInventoryVariantsQuerySchema>;
export type ListInventoryVariantsQueryOutput = z.infer<typeof listInventoryVariantsQuerySchema>;

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
  performedByUser?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    email?: string;
  } | null;
  order?: {
    id: string;
    orderNumber: string;
    displayId: number;
  } | null;
  variant?: {
    id: string;
    sku: string;
    name: string;
    productId: string;
    productName?: string;
  } | null;
  createdAt: Date | string;
}

export interface InventoryVariantItemDto {
  id: string;
  workspaceId: string;
  productId: string;
  productName: string;
  productSku: string;
  productImageUrl?: string | null;
  name: string;
  sku: string;
  barcode: string | null;
  price: number;
  costPrice: number;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
  attributes: Record<string, any>;
  isActive: boolean;
  updatedAt: Date | string;
}
