import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { HttpExceptionFilter } from '../http-exception.filter';
import { Prisma } from '../../../infrastructure/database';

describe('HttpExceptionFilter (Global Exception Normalization)', () => {
  let filter: HttpExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;
  let responseStatusCode: number;
  let responseBody: any;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    responseStatusCode = 0;
    responseBody = null;

    mockResponse = {
      status: (code: number) => {
        responseStatusCode = code;
        return mockResponse;
      },
      json: (body: any) => {
        responseBody = body;
        return mockResponse;
      },
    };

    mockRequest = {
      method: 'POST',
      url: '/test',
      headers: {
        'x-request-id': 'req_test_123',
      },
    };

    mockHost = {
      getType: () => 'http',
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('should ignore non-http context', () => {
    const nonHttpHost = {
      getType: () => 'ws',
    } as unknown as ArgumentsHost;

    filter.catch(new Error('WS error'), nonHttpHost);
    expect(responseStatusCode).toBe(0);
    expect(responseBody).toBe(null);
  });

  it('should catch ZodError and format as 400 VALIDATION_FAILED with field issues', () => {
    const testSchema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    let zodError: ZodError | null = null;
    try {
      testSchema.parse({ email: 'not-an-email', age: 10 });
    } catch (err) {
      if (err instanceof ZodError) {
        zodError = err;
      }
    }

    expect(zodError).toBeTruthy();

    filter.catch(zodError, mockHost);

    expect(responseStatusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('VALIDATION_FAILED');
    expect(responseBody.error.message).toBe('Request validation failed');
    expect(Array.isArray(responseBody.error.details)).toBe(true);
    expect(responseBody.error.details.length).toBe(2);
    expect(responseBody.error.details[0].field).toBe('email');
    expect(responseBody.error.details[1].field).toBe('age');
  });

  it('should handle standard HttpException with structured response', () => {
    const exception = new BadRequestException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      details: { attemptsRemaining: 2 },
    });

    filter.catch(exception, mockHost);

    expect(responseStatusCode).toBe(HttpStatus.BAD_REQUEST);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INVALID_CREDENTIALS');
    expect(responseBody.error.message).toBe('Invalid email or password');
    expect(responseBody.error.details).toEqual({ attemptsRemaining: 2 });
  });

  it('should derive error code when HttpException contains plain string response', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost);

    expect(responseStatusCode).toBe(HttpStatus.NOT_FOUND);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('NOT_FOUND');
    expect(responseBody.error.message).toBe('Resource not found');
  });

  it('should sanitize unhandled Error message in production (FINDING-P5-03)', () => {
    process.env.NODE_ENV = 'production';
    const secretError = new Error(
      'SELECT * FROM users WHERE password_hash = ... syntax error at line 1',
    );

    filter.catch(secretError, mockHost);

    expect(responseStatusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(responseBody.error.message).toBe('An unexpected internal error occurred');
    expect(responseBody.error.details).toBe(null);
  });

  it('should expose error message in development mode for debugging', () => {
    process.env.NODE_ENV = 'development';
    const debugError = new Error('Debug stack info');

    filter.catch(debugError, mockHost);

    expect(responseStatusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(responseBody.success).toBe(false);
    expect(responseBody.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(responseBody.error.message).toBe('Debug stack info');
  });

  describe('Prisma Known Request Errors', () => {
    it('should map P2002 to 409 RESOURCE_ALREADY_EXISTS', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.x',
        meta: { target: ['workspaceId', 'email'] },
      });

      filter.catch(prismaError, mockHost);

      expect(responseStatusCode).toBe(HttpStatus.CONFLICT);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('RESOURCE_ALREADY_EXISTS');
      expect(responseBody.error.message).toContain(
        'Dữ liệu bị trùng lặp ở trường: workspaceId, email',
      );
      expect(responseBody.error.details).toEqual({ target: ['workspaceId', 'email'] });
    });

    it('should map P2025 to 404 NOT_FOUND', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.x',
        meta: { cause: 'Record to update not found.' },
      });

      filter.catch(prismaError, mockHost);

      expect(responseStatusCode).toBe(HttpStatus.NOT_FOUND);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('NOT_FOUND');
      expect(responseBody.error.message).toContain('Không tìm thấy tài nguyên');
    });

    it('should map P2003 to 400 FOREIGN_KEY_VIOLATION', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.x',
          meta: { field_name: 'contactId' },
        },
      );

      filter.catch(prismaError, mockHost);

      expect(responseStatusCode).toBe(HttpStatus.BAD_REQUEST);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('FOREIGN_KEY_VIOLATION');
      expect(responseBody.error.message).toContain('Dữ liệu liên kết không hợp lệ');
    });

    it('should map P2024 to 503 DATABASE_TIMEOUT', () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Connection pool timeout', {
        code: 'P2024',
        clientVersion: '5.x',
      });

      filter.catch(prismaError, mockHost);

      expect(responseStatusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.code).toBe('DATABASE_TIMEOUT');
      expect(responseBody.error.message).toContain('Kết nối cơ sở dữ liệu bị quá tải');
    });
  });
});
