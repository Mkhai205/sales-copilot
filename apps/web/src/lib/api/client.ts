export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export interface ApiResponseMeta {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiResponseMeta;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
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

export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    credentials: 'include', // Automatically send cookies for session/auth
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
