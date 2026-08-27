import { describe, it, beforeEach, afterEach } from 'node:test';
import * as assert from 'node:assert';
import { ArgumentsHost, BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { z, ZodError } from 'zod';
import { HttpExceptionFilter } from '../http-exception.filter';

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
    assert.strictEqual(responseStatusCode, 0);
    assert.strictEqual(responseBody, null);
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

    assert.ok(zodError, 'Expected ZodError to be caught');

    filter.catch(zodError, mockHost);

    assert.strictEqual(responseStatusCode, HttpStatus.BAD_REQUEST);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'VALIDATION_FAILED');
    assert.strictEqual(responseBody.error.message, 'Request validation failed');
    assert.strictEqual(Array.isArray(responseBody.error.details), true);
    assert.strictEqual(responseBody.error.details.length, 2);
    assert.strictEqual(responseBody.error.details[0].field, 'email');
    assert.strictEqual(responseBody.error.details[1].field, 'age');
  });

  it('should handle standard HttpException with structured response', () => {
    const exception = new BadRequestException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
      details: { attemptsRemaining: 2 },
    });

    filter.catch(exception, mockHost);

    assert.strictEqual(responseStatusCode, HttpStatus.BAD_REQUEST);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'INVALID_CREDENTIALS');
    assert.strictEqual(responseBody.error.message, 'Invalid email or password');
    assert.deepStrictEqual(responseBody.error.details, { attemptsRemaining: 2 });
  });

  it('should derive error code when HttpException contains plain string response', () => {
    const exception = new NotFoundException('Resource not found');

    filter.catch(exception, mockHost);

    assert.strictEqual(responseStatusCode, HttpStatus.NOT_FOUND);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'NOT_FOUND');
    assert.strictEqual(responseBody.error.message, 'Resource not found');
  });

  it('should sanitize unhandled Error message in production (FINDING-P5-03)', () => {
    process.env.NODE_ENV = 'production';
    const secretError = new Error(
      'SELECT * FROM users WHERE password_hash = ... syntax error at line 1',
    );

    filter.catch(secretError, mockHost);

    assert.strictEqual(responseStatusCode, HttpStatus.INTERNAL_SERVER_ERROR);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(responseBody.error.message, 'An unexpected internal error occurred');
    assert.strictEqual(responseBody.error.details, null);
  });

  it('should expose error message in development mode for debugging', () => {
    process.env.NODE_ENV = 'development';
    const debugError = new Error('Debug stack info');

    filter.catch(debugError, mockHost);

    assert.strictEqual(responseStatusCode, HttpStatus.INTERNAL_SERVER_ERROR);
    assert.strictEqual(responseBody.success, false);
    assert.strictEqual(responseBody.error.code, 'INTERNAL_SERVER_ERROR');
    assert.strictEqual(responseBody.error.message, 'Debug stack info');
  });
});
