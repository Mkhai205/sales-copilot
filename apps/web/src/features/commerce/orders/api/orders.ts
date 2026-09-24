import { buildQueryString, fetchApi, workspaceHeaders } from '@/lib/api/client';
import type {
  CancelOrderDto,
  CompleteOrderDto,
  CreateOrderDto,
  GenerateVietQrDto,
  ListOrdersQueryDto,
  ManualPayOrderDto,
  OrderResponseDto,
  UpdateOrderDto,
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

export const ordersApi = {
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

// Compatibility export
export const commerceApi = ordersApi;
