import { z } from 'zod';

// ============================================================================
// Product Variant Schemas
// ============================================================================

export const createProductVariantSchema = z.object({
  name: z.string().trim().min(1, 'Tên biến thể bắt buộc'),
  sku: z.string().trim().min(1, 'SKU biến thể bắt buộc'),
  barcode: z.string().trim().optional().nullable(),
  price: z.coerce.number().positive('Giá biến thể phải lớn hơn 0'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm').default(0),
  stockQuantity: z.coerce
    .number()
    .int('Tồn kho phải là số nguyên')
    .min(0, 'Tồn kho không được âm')
    .default(0),
  attributes: z.record(z.any()).default({}),
  imageUrl: z.string().url('URL hình ảnh không hợp lệ').optional().nullable().or(z.literal('')),
});

export type CreateProductVariantDto = z.input<typeof createProductVariantSchema>;

export const updateProductVariantSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).optional(),
  sku: z.string().trim().min(1).optional(),
  barcode: z.string().trim().optional().nullable(),
  price: z.coerce.number().positive('Giá biến thể phải lớn hơn 0').optional(),
  costPrice: z.coerce.number().min(0).optional(),
  stockQuantity: z.coerce.number().int().min(0).optional(),
  attributes: z.record(z.any()).optional(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  isActive: z.boolean().optional(),
});

export type UpdateProductVariantDto = z.input<typeof updateProductVariantSchema>;

export interface ProductVariantResponseDto {
  id: string;
  workspaceId: string;
  productId: string;
  name: string;
  sku: string;
  barcode: string | null;
  price: number | string;
  costPrice: number | string;
  stockQuantity: number;
  reservedQuantity: number;
  availableStock: number;
  attributes: Record<string, any>;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// Product Schemas
// ============================================================================

export const createProductSchema = z.object({
  name: z.string().trim().min(2, 'Tên sản phẩm tối thiểu 2 ký tự'),
  slug: z.string().trim().optional(),
  description: z.string().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  basePrice: z.coerce.number().positive('Giá bán phải lớn hơn 0'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm').default(0),
  sku: z.string().trim().min(1, 'SKU là bắt buộc'),
  barcode: z.string().trim().optional().nullable(),
  imageUrl: z.string().url('URL hình ảnh không hợp lệ').optional().nullable().or(z.literal('')),
  images: z.array(z.string().url()).default([]),
  trackInventory: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
  variants: z.array(createProductVariantSchema).min(1, 'Sản phẩm phải có ít nhất 1 biến thể'),
});

export type CreateProductDto = z.input<typeof createProductSchema>;

export const updateProductSchema = z.object({
  name: z.string().trim().min(2, 'Tên sản phẩm tối thiểu 2 ký tự').optional(),
  slug: z.string().trim().optional(),
  description: z.string().optional().nullable(),
  category: z.string().trim().optional().nullable(),
  basePrice: z.coerce.number().positive('Giá bán phải lớn hơn 0').optional(),
  costPrice: z.coerce.number().min(0).optional(),
  sku: z.string().trim().min(1).optional(),
  barcode: z.string().trim().optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal('')),
  images: z.array(z.string().url()).optional(),
  trackInventory: z.boolean().optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
  variants: z.array(updateProductVariantSchema).optional(),
});

export type UpdateProductDto = z.input<typeof updateProductSchema>;

export const listProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().optional(),
  category: z.string().trim().optional(),
  isActive: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return val;
  }, z.boolean().optional()),
  lowStock: z.preprocess(val => {
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return val;
  }, z.boolean().optional()),
  sortBy: z.enum(['name', 'createdAt', 'basePrice', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListProductsQueryDto = z.input<typeof listProductsQuerySchema>;
export type ListProductsQueryOutput = z.infer<typeof listProductsQuerySchema>;

export interface ProductResponseDto {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  basePrice: number | string;
  costPrice: number | string;
  sku: string;
  barcode: string | null;
  imageUrl: string | null;
  images: string[];
  isActive: boolean;
  trackInventory: boolean;
  totalStock?: number;
  totalReserved?: number;
  totalAvailable?: number;
  metadata: Record<string, any>;
  variants?: ProductVariantResponseDto[];
  createdAt: Date | string;
  updatedAt: Date | string;
}
