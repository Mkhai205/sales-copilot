import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const userAgent = request.get('user-agent') || '-';
    const requestId = (request.headers['x-request-id'] as string) || undefined;
    const prefix = requestId ? `[${requestId}] ` : '';
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const statusCode = response.statusCode || 200;
          const responseTime = Date.now() - startTime;

          this.logger.log(
            `${prefix}${method} ${url} - ${statusCode} - ${responseTime}ms - ${ip} - ${userAgent}`,
          );
        },
        error: error => {
          const responseTime = Date.now() - startTime;
          const statusCode = error?.status || error?.statusCode || 500;

          // Delegate full error/stack logging to HttpExceptionFilter, only log summary timing here
          this.logger.debug(
            `${prefix}${method} ${url} - ${statusCode} (Error) - ${responseTime}ms`,
          );
        },
      }),
    );
  }
}
