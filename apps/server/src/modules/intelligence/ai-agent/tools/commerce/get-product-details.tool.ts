import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { ProductsService } from '../../../../commerce/products/products.service';

export interface GetProductDetailsToolOptions {
  workspaceId: string;
  productsService: ProductsService;
}

export const getProductDetailsInputSchema = z.object({
  productId: z.string().describe('ID của sản phẩm cần lấy thông tin chi tiết'),
});

export type GetProductDetailsInput = z.infer<typeof getProductDetailsInputSchema>;

export function createGetProductDetailsTool({
  workspaceId,
  productsService,
}: GetProductDetailsToolOptions): Tool {
  return tool({
    description:
      'Lấy thông tin chi tiết của 1 sản phẩm: tên, mô tả, ảnh, tất cả các biến thể (size, màu sắc), giá và tồn kho khả dụng của từng biến thể.',
    inputSchema: getProductDetailsInputSchema,
    execute: async ({ productId }: GetProductDetailsInput) => {
      try {
        const product = await productsService.getProductById(workspaceId, productId);
        if (!product || !product.isActive) {
          return null;
        }

        return {
          productId: product.id,
          name: product.name,
          description: product.description,
          basePrice: product.basePrice,
          imageUrl: product.imageUrl,
          images: product.images,
          variants: (product.variants || [])
            .filter(v => v.isActive)
            .map(v => ({
              variantId: v.id,
              name: v.name,
              sku: v.sku,
              price: v.price,
              availableStock: v.availableStock,
            })),
        };
      } catch (error: any) {
        if (error?.status === 404 || error?.code === 'PRODUCT_NOT_FOUND') {
          return null;
        }
        return {
          error: 'GET_PRODUCT_DETAILS_FAILED',
          message: error?.message || 'Không thể lấy thông tin chi tiết sản phẩm',
        };
      }
    },
  });
}
