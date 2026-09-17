export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION_FAILED'
  | 'UNPROCESSABLE_ENTITY'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_SERVER_ERROR'
  | string;

export interface ErrorDetails {
  field?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ApiErrorPayload {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}
