import type {
  ApiErrorPayload,
  ApiErrorResponse,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host.includes('kakadev.xyz')) {
      return 'https://api-sales-copilot.kakadev.xyz/api/v1';
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
}

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export type ApiResponseMeta = PaginationMeta;

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiResponseMeta;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly error: ApiErrorPayload,
  ) {
    super(error.message || `API request failed with status ${status}`);
    this.name = 'ApiClientError';
  }
}

export function workspaceHeaders(workspaceId?: string): HeadersInit {
  return workspaceId ? { 'X-Workspace-Id': workspaceId } : {};
}

export function buildQueryString(params?: Record<string, any>): string {
  if (!params) return '';
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const base = getApiBase();
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData;
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  if (options?.headers) {
    if (Array.isArray(options.headers)) {
      options.headers.forEach(([k, v]) => {
        headers[k] = v;
      });
    } else if (options.headers instanceof Headers) {
      options.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  const res = await fetch(url, {
    ...options,
    credentials: 'include', // Automatically send cookies for session/auth
    headers,
  });

  if (!res.ok) {
    let errorPayload: ApiErrorPayload;
    try {
      const errorBody = (await res.json()) as ApiErrorResponse;
      errorPayload = errorBody.error || {
        code: `HTTP_${res.status}`,
        message: res.statusText || 'Unknown error occurred',
      };
    } catch {
      errorPayload = {
        code: `HTTP_${res.status}`,
        message: res.statusText || 'Network request failed',
      };
    }
    throw new ApiClientError(res.status, errorPayload);
  }

  return (await res.json()) as ApiResponse<T>;
}
