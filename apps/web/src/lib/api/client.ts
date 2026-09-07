import type {
  ApiErrorPayload,
  ApiErrorResponse,
  PaginationMeta,
} from '@sales-copilot/shared-contracts';

/**
 * Resolves the backend API base URL for server-side environments (SSR, Server Actions, Middleware).
 * - In Docker production: uses INTERNAL_API_URL (http://server:8000/api/v1) for direct container-to-container calls.
 * - On host machine (local dev / dev tunnel): uses http://localhost:8000/api/v1 because NestJS runs directly on host.
 * - Ensures a relative URL (like /api/v1) is NEVER returned on the server (Node.js fetch requires absolute URLs).
 */
export function getServerApiBase(): string {
  const internalUrl = process.env.INTERNAL_API_URL;
  if (internalUrl && internalUrl.startsWith('http')) {
    const parsed = new URL(internalUrl);
    // If internalUrl points to container name 'server', but we are running on host machine (Win/Mac),
    // fallback to localhost:8000 because 'server' cannot be resolved outside Docker.
    if (
      parsed.hostname === 'server' &&
      (process.platform === 'win32' || process.platform === 'darwin')
    ) {
      return 'http://localhost:8000/api/v1';
    }
    return internalUrl.replace(/\/+$/, '');
  }

  const publicUrl = process.env.NEXT_PUBLIC_API_URL;
  // Node.js fetch requires an absolute URL (starting with http:// or https://)
  if (publicUrl && publicUrl.startsWith('http')) {
    return publicUrl.replace(/\/+$/, '');
  }

  // Default fallback for native host execution
  return 'http://localhost:8000/api/v1';
}

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Local dev: direct cross-origin access to backend
    if (host === 'localhost' || host === '127.0.0.1') {
      return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
    }
    // Production / tunnel: same-origin via nginx reverse proxy
    return '/api/v1';
  }
  // Server-side rendering / Server Actions
  return getServerApiBase();
}

export const API_BASE = getServerApiBase();

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
