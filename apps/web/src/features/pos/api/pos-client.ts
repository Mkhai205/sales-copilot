import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  CancelOrderDto,
  CarrierQuoteResultDto,
  CarrierRateQuoteDto,
  CreateOrderDto,
  DispatchOrderDto,
  GenerateVietQrDto,
  ListOrdersQueryOutput,
  ListProductsQueryOutput,
  ManualPayOrderDto,
  OrderResponseDto,
  ProductResponseDto,
  ShippingLabelDataDto,
  TrackingStatusDto,
  UpdateOrderDto,
  PaginationMeta,
  VietQrResponseDto,
} from '@sales-copilot/shared-contracts';

export const posApi = {
  // Products
  listProducts: (workspaceId: string, query?: ListProductsQueryOutput) =>
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
