import { tool, type Tool } from 'ai';
import { z } from 'zod';
import type { ProductsService } from '../../../../commerce/products/products.service';

export interface SearchProductsToolOptions {
  workspaceId: string;
  productsService: ProductsService;
}

export const searchProductsInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Tên sản phẩm hoặc từ khóa tìm kiếm (ví dụ: áo polo trắng, giày sneaker, Áo thun đen L)',
    ),
});

export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>;

export function createSearchProductsTool({
  workspaceId,
  productsService,
}: SearchProductsToolOptions): Tool {
  return tool({
    description:
      'Tìm kiếm sản phẩm trong catalog cửa hàng theo tên hoặc từ khóa. Trả về danh sách tên sản phẩm, giá, ảnh và tồn kho khả dụng của các biến thể.',
    inputSchema: searchProductsInputSchema,
    execute: async ({ query }: SearchProductsInput) => {
      try {
        const trimmed = query?.trim() || '';
        if (!trimmed) {
          return [];
        }

        const result = await productsService.listProducts(workspaceId, {
          search: trimmed,
          isActive: true,
          limit: 10,
          page: 1,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });

        return result.items.map(product => ({
          productId: product.id,
          name: product.name,
          basePrice: product.basePrice,
          imageUrl: product.imageUrl,
          variants: (product.variants || [])
            .filter(v => v.isActive)
            .map(v => ({
              variantId: v.id,
              name: v.name,
              sku: v.sku,
              price: v.price,
              availableStock: v.availableStock,
            })),
        }));
      } catch (error: any) {
        return {
          error: 'SEARCH_PRODUCTS_FAILED',
          message: error?.message || 'Không thể tìm kiếm sản phẩm',
        };
      }
    },
  });
}
