import { z } from 'zod';
import type { ProductResponseDto } from '@sales-copilot/shared-contracts';

export interface AttributeGroup {
  id: string;
  name: string; // e.g. "Kích cỡ"
  values: string[]; // e.g. ["S", "M", "L"]
}

export const variantRowSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Tên biến thể bắt buộc'),
  sku: z.string().trim().min(1, 'SKU biến thể bắt buộc'),
  barcode: z.string().trim().optional(),
  price: z.coerce.number().min(0, 'Giá biến thể không được âm'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm'),
  stockQuantity: z.coerce.number().int().min(0, 'Tồn kho không được âm'),
  attributes: z.record(z.any()),
});

export type VariantFormRow = z.infer<typeof variantRowSchema>;

export const productFormSchema = z.object({
  name: z.string().trim().min(1, 'Tên sản phẩm là bắt buộc'),
  sku: z.string().trim().min(1, 'Mã SKU là bắt buộc'),
  category: z.string().trim().optional(),
  basePrice: z.coerce.number().min(0, 'Giá bán không được âm'),
  costPrice: z.coerce.number().min(0, 'Giá vốn không được âm'),
  barcode: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
  simpleStock: z.coerce.number().int().min(0, 'Tồn kho không được âm'),
  hasVariants: z.boolean(),
  variants: z.array(variantRowSchema),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export function buildProductDefaultValues(product?: ProductResponseDto | null): ProductFormValues {
  if (product) {
    const existingVars = product.variants || [];
    const hasMultiVariants =
      existingVars.length > 1 ||
      (existingVars.length === 1 && existingVars[0].name !== 'Tiêu chuẩn');

    return {
      name: product.name || '',
      sku: product.sku || '',
      category: product.category || '',
      basePrice: Number(product.basePrice) || 0,
      costPrice: Number(product.costPrice) || 0,
      barcode: product.barcode || '',
      imageUrl: product.imageUrl || '',
      description: product.description || '',
      hasVariants: hasMultiVariants,
      simpleStock: hasMultiVariants ? 0 : existingVars[0]?.stockQuantity || 0,
      variants: hasMultiVariants
        ? existingVars.map(v => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            barcode: v.barcode || '',
            price: Number(v.price) || 0,
            costPrice: Number(v.costPrice) || 0,
            stockQuantity: v.stockQuantity || 0,
            attributes: (v.attributes as Record<string, string>) || {},
          }))
        : [],
    };
  }

  return {
    name: '',
    sku: '',
    category: '',
    basePrice: 100000,
    costPrice: 50000,
    barcode: '',
    imageUrl: '',
    description: '',
    hasVariants: false,
    simpleStock: 0,
    variants: [],
  };
}
