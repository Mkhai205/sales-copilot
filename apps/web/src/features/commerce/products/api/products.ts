import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  CreateProductDto,
  InventoryTransactionResponseDto,
  ListInventoryTransactionsQueryDto,
  ListProductsQueryDto,
  ProductResponseDto,
  UpdateProductDto,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

export interface PaginatedResult<T> {
  items: T[];
  meta?: PaginationMeta;
}

export function normalizePaginatedResponse<T>(res: any): {
  success: boolean;
  data: PaginatedResult<T>;
  meta?: PaginationMeta;
} {
  const rawData = res.data;
  let items: T[] = [];
  let meta: PaginationMeta | undefined = res.meta;

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (rawData && typeof rawData === 'object' && Array.isArray(rawData.items)) {
    items = rawData.items;
    meta = rawData.meta || meta;
  }

  return {
    ...res,
    data: {
      items,
      meta,
    },
    meta,
  };
}

export const productsApi = {
  listProducts: (workspaceId: string, query?: ListProductsQueryDto) =>
    fetchApi<ProductResponseDto[]>(
      `/workspaces/${workspaceId}/products${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<ProductResponseDto>(res)),

  getProduct: (workspaceId: string, id: string) =>
    fetchApi<ProductResponseDto>(`/workspaces/${workspaceId}/products/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  createProduct: (workspaceId: string, dto: CreateProductDto) =>
    fetchApi<ProductResponseDto>(`/workspaces/${workspaceId}/products`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateProduct: (workspaceId: string, id: string, dto: UpdateProductDto) =>
    fetchApi<ProductResponseDto>(`/workspaces/${workspaceId}/products/${id}`, {
      method: 'PUT',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  deleteProduct: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/workspaces/${workspaceId}/products/${id}`, {
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
      `/workspaces/${workspaceId}/products/${productId}/variants/${variantId}/inventory`,
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
      `/workspaces/${workspaceId}/products/${productId}/variants/${variantId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryTransactionResponseDto>(res)),
};

// Compatibility export
export const commerceApi = productsApi;
