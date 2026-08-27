import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorResponse, ErrorCode } from '@sales-copilot/shared-contracts';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request.headers['x-request-id'] as string) || undefined;

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: ErrorCode = 'INTERNAL_SERVER_ERROR';
    let message = 'Internal server error';
    let details: unknown = null;

    if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_FAILED';
      message = 'Request validation failed';
      details = exception.issues.map(issue => ({
        field: issue.path.join('.') || 'payload',
        message: issue.message,
        code: issue.code,
      }));
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = this.deriveErrorCode(exception);

      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;

        if (typeof resObj['code'] === 'string') {
          code = resObj['code'];
        }

        if (typeof resObj['message'] === 'string') {
          message = resObj['message'];
        } else if (Array.isArray(resObj['message'])) {
          message = resObj['message'].join('; ');
        } else if (typeof resObj['error'] === 'string') {
          message = resObj['error'];
        }

        details = resObj['errors'] || resObj['details'] || null;
      }
    } else if (exception instanceof Error) {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      const isProduction = process.env.NODE_ENV === 'production';
      message = isProduction
        ? 'An unexpected internal error occurred'
        : exception.message || 'Internal server error';
      details = null;
    }

    this.logException(request, statusCode, exception, message, requestId);

    const errorResponse: ApiErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
      },
    };

    response.status(statusCode).json(errorResponse);
  }

  private deriveErrorCode(exception: HttpException): ErrorCode {
    const name = exception.constructor.name;
    return name
      .replace(/Exception$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  private logException(
    request: Request,
    statusCode: number,
    exception: unknown,
    message: string,
    requestId?: string,
  ): void {
    const prefix = requestId ? `[${requestId}] ` : '';
    const logHeader = `${prefix}${request.method} ${request.url} -> ${statusCode}: ${message}`;

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(logHeader, stack);
    } else {
      this.logger.warn(logHeader);
    }
  }
}
