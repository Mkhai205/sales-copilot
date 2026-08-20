import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { ApiSuccessResponse, PaginationMeta } from '@sales-copilot/shared-contracts';

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiSuccessResponse<T> | T> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiSuccessResponse<T> | T> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    return next.handle().pipe(
      map(data => {
        // If data is null or undefined
        if (data === null || data === undefined) {
          return {
            success: true,
            data: null as unknown as T,
          };
        }

        // If response is already an envelope or is a binary buffer/stream, bypass transformation
        if (typeof data === 'object' && ('success' in data || Buffer.isBuffer(data))) {
          return data;
        }

        // Handle paginated collections: { items, meta }
        if (typeof data === 'object' && 'items' in data && 'meta' in data) {
          return {
            success: true,
            data: (data as any).items,
            meta: (data as any).meta as PaginationMeta,
          };
        }

        // Handle paginated collections: { data, meta }
        if (typeof data === 'object' && 'data' in data && 'meta' in data) {
          return {
            success: true,
            data: (data as any).data,
            meta: (data as any).meta as PaginationMeta,
          };
        }

        // Standard single object/array response
        return {
          success: true,
          data,
        };
      }),
    );
  }
}
