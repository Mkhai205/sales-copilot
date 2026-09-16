import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  AdjustInventoryDto,
  CancelOrderDto,
  CarrierQuoteResultDto,
  CarrierRateQuoteDto,
  CreateOrderDto,
  CreateProductDto,
  DispatchOrderDto,
  GenerateVietQrDto,
  InventoryTransactionResponseDto,
  InventoryVariantItemDto,
  ListInventoryTransactionsQueryDto,
  ListInventoryVariantsQueryDto,
  ListOrdersQueryOutput,
  ListProductsQueryDto,
  ManualPayOrderDto,
  OrderResponseDto,
  ProductResponseDto,
  ShippingLabelDataDto,
  TrackingStatusDto,
  UpdateOrderDto,
  UpdateProductDto,
  PaginationMeta,
  VietQrResponseDto,
} from '@sales-copilot/shared-contracts';

export const commerceApi = {
  // Products
  listProducts: (workspaceId: string, query?: ListProductsQueryDto) =>
    fetchApi<{ items: ProductResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/products${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

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
    fetchApi<{ items: InventoryTransactionResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/products/${productId}/variants/${variantId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  // Inventory Subsystem
  listInventoryTransactions: (workspaceId: string, query?: ListInventoryTransactionsQueryDto) =>
    fetchApi<{ items: InventoryTransactionResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/inventory/transactions${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

  listInventoryVariants: (workspaceId: string, query?: ListInventoryVariantsQueryDto) =>
    fetchApi<{ items: InventoryVariantItemDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/inventory/variants${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

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
  listOrders: (workspaceId: string, query?: ListOrdersQueryOutput) =>
    fetchApi<{ items: OrderResponseDto[]; meta: PaginationMeta }>(
      `/workspaces/${workspaceId}/orders${buildQueryString(query)}`,
      {
        headers: workspaceHeaders(workspaceId),
      },
    ),

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

  generateVietQr: (workspaceId: string, orderId: string, dto?: GenerateVietQrDto) =>
    fetchApi<VietQrResponseDto>(`/workspaces/${workspaceId}/orders/${orderId}/vietqr`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: dto ? JSON.stringify(dto) : undefined,
    }),

  // Shipping & Thermal Waybill
  getShippingLabel: (workspaceId: string, id: string) =>
    fetchApi<ShippingLabelDataDto>(`/workspaces/${workspaceId}/orders/${id}/shipping-label`, {
      headers: workspaceHeaders(workspaceId),
    }),

  calculateShippingQuote: (workspaceId: string, dto: CarrierRateQuoteDto) =>
    fetchApi<CarrierQuoteResultDto>(`/workspaces/${workspaceId}/shipping/quote`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  dispatchOrder: (workspaceId: string, id: string, dto: DispatchOrderDto) =>
    fetchApi<OrderResponseDto>(`/workspaces/${workspaceId}/shipping/orders/${id}/dispatch`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
      body: JSON.stringify(dto),
    }),

  trackOrder: (workspaceId: string, id: string) =>
    fetchApi<TrackingStatusDto>(`/workspaces/${workspaceId}/shipping/orders/${id}/track`, {
      headers: workspaceHeaders(workspaceId),
    }),

  cancelShipment: (workspaceId: string, id: string) =>
    fetchApi<{ success: boolean }>(`/workspaces/${workspaceId}/shipping/orders/${id}/cancel`, {
      method: 'POST',
      headers: workspaceHeaders(workspaceId),
    }),
};
