import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  CreateProductDto,
  InventoryTransactionResponseDto,
  ListInventoryTransactionsQueryDto,
  ListProductsQueryDto,
  ProductResponseDto,
  UpdateProductDto,
} from '@sales-copilot/shared-contracts';
import { normalizePaginatedResponse } from '@/lib/api/pagination';

export const productsApi = {
  listProducts: (workspaceId: string, query?: ListProductsQueryDto) =>
    fetchApi<ProductResponseDto[]>(`/products${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }).then(res => normalizePaginatedResponse<ProductResponseDto>(res)),

  getProduct: (workspaceId: string, id: string) =>
    fetchApi<ProductResponseDto>(`/products/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  createProduct: (workspaceId: string, dto: CreateProductDto) =>
    fetchApi<ProductResponseDto>(`/products`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateProduct: (workspaceId: string, id: string, dto: UpdateProductDto) =>
    fetchApi<ProductResponseDto>(`/products/${id}`, {
      method: 'PUT',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  deleteProduct: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/products/${id}`, {
      method: 'DELETE',
      headers: workspaceHeaders(workspaceId),
    }),

  adjustVariantInventory: (
    workspaceId: string,
    productId: string,
    variantId: string,
    dto: AdjustInventoryDto,
  ) =>
    fetchApi<InventoryTransactionResponseDto>(
      `/products/${productId}/variants/${variantId}/inventory`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify(dto),
      },
    ),

  getVariantTransactions: (
    workspaceId: string,
    productId: string,
    variantId: string,
    query?: ListInventoryTransactionsQueryDto,
  ) =>
    fetchApi<InventoryTransactionResponseDto[]>(
      `/products/${productId}/variants/${variantId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryTransactionResponseDto>(res)),
};
