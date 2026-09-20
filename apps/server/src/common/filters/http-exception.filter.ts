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
import { Prisma } from '../../infrastructure/database';

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
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          code = 'RESOURCE_ALREADY_EXISTS';
          const target = Array.isArray(exception.meta?.target)
            ? (exception.meta?.target as string[]).join(', ')
            : 'record';
          message = `Dữ liệu bị trùng lặp ở trường: ${target}`;
          details = { target: exception.meta?.target };
          break;
        }
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          code = 'NOT_FOUND';
          message = 'Không tìm thấy tài nguyên yêu cầu hoặc bản ghi đã bị xóa';
          details = exception.meta?.cause || null;
          break;
        }
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          code = 'FOREIGN_KEY_VIOLATION';
          message = 'Dữ liệu liên kết không hợp lệ hoặc không tồn tại';
          details = { field: exception.meta?.field_name };
          break;
        }
        case 'P2024': {
          statusCode = HttpStatus.SERVICE_UNAVAILABLE;
          code = 'DATABASE_TIMEOUT';
          message = 'Kết nối cơ sở dữ liệu bị quá tải, vui lòng thử lại sau';
          details = null;
          break;
        }
        default: {
          statusCode = HttpStatus.BAD_REQUEST;
          code = 'DATABASE_ERROR';
          message = 'Yêu cầu cơ sở dữ liệu không hợp lệ';
          details = process.env.NODE_ENV === 'production' ? null : { prismaCode: exception.code };
          break;
        }
      }
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
