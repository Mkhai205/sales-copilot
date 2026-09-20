import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  CancelOrderDto,
  CompleteOrderDto,
  CreateOrderDto,
  CreateProductDto,
  GenerateVietQrDto,
  InventoryTransactionResponseDto,
  InventoryVariantItemDto,
  ListInventoryTransactionsQueryDto,
  ListInventoryVariantsQueryDto,
  ListOrdersQueryDto,
  ListProductsQueryDto,
  ManualPayOrderDto,
  OrderResponseDto,
  ProductResponseDto,
  UpdateOrderDto,
  UpdateProductDto,
  PaginationMeta,
  VietQrResponseDto,
} from '@sales-copilot/shared-contracts';

export interface PaginatedResult<T> {
  items: T[];
  meta?: PaginationMeta;
}

function normalizePaginatedResponse<T>(res: any): {
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

export const commerceApi = {
  // Products
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

  // Inventory Subsystem
  listInventoryTransactions: (workspaceId: string, query?: ListInventoryTransactionsQueryDto) =>
    fetchApi<InventoryTransactionResponseDto[]>(
      `/workspaces/${workspaceId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryTransactionResponseDto>(res)),

  listInventoryVariants: (workspaceId: string, query?: ListInventoryVariantsQueryDto) =>
    fetchApi<InventoryVariantItemDto[]>(
      `/workspaces/${workspaceId}/inventory/variants${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ).then(res => normalizePaginatedResponse<InventoryVariantItemDto>(res)),

  getInventorySummary: (workspaceId: string) =>
    fetchApi<{
      totalSkus: number;
      totalPhysicalStock: number;
      totalReservedStock: number;
      totalAvailableStock: number;
      lowStockSkus: number;
      outOfStockSkus: number;
    }>(`/workspaces/${workspaceId}/inventory/summary`, {
      headers: workspaceHeaders(workspaceId),
    }),

  adjustStockDirect: (workspaceId: string, variantId: string, dto: AdjustInventoryDto) =>
    fetchApi<InventoryTransactionResponseDto>(
      `/workspaces/${workspaceId}/inventory/variants/${variantId}/adjust`,
      {
        method: 'POST',
        headers: workspaceHeaders(workspaceId),
        body: JSON.stringify(dto),
      },
    ),

  // Orders
  listOrders: (workspaceId: string, query?: ListOrdersQueryDto) =>
    fetchApi<OrderResponseDto[]>(`/workspaces/${workspaceId}/orders${buildQueryString(query)}`, {
      headers: workspaceHeaders(workspaceId),
    }).then(res => normalizePaginatedResponse<OrderResponseDto>(res)),

  getOrder: (workspaceId: string, id: string) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}`, {
      headers: workspaceHeaders(workspaceId),
    }),

  createOrder: (workspaceId: string, dto: CreateOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  updateOrder: (workspaceId: string, id: string, dto: UpdateOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}`, {
      method: 'PATCH',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  confirmOrder: (workspaceId: string, id: string) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}/confirm`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
    }),

  payOrder: (workspaceId: string, id: string, dto: ManualPayOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}/pay`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  cancelOrder: (workspaceId: string, id: string, dto: CancelOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}/cancel`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  completeOrder: (workspaceId: string, id: string, dto?: CompleteOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/orders/${id}/complete`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: dto ? JSON.stringify(dto) : undefined,
    }),

  generateVietQr: (workspaceId: string, orderId: string, dto?: GenerateVietQrDto) =>
    fetchApi<VietQrResponseDto>(`/workspaces/${workspaceId}/orders/${orderId}/vietqr`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: dto ? JSON.stringify(dto) : undefined,
    }),
};
