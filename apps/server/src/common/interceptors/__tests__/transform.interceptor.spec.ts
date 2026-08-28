import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { of, firstValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { TransformInterceptor } from '../transform.interceptor';

describe('TransformInterceptor (Common Interceptor — FINDING-P9-02)', () => {
  let interceptor: TransformInterceptor<any>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  const createMockContext = (type: string = 'http'): ExecutionContext => {
    return {
      getType: () => type,
      switchToHttp: () => ({
        getRequest: () => ({}),
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (returnValue: any): CallHandler => {
    return {
      handle: () => of(returnValue),
    };
  };

  it('should bypass transformation for non-HTTP contexts (e.g. ws, rpc)', async () => {
    const context = createMockContext('ws');
    const rawData = { message: 'hello from websocket' };
    const handler = createMockCallHandler(rawData);

    const result$ = interceptor.intercept(context, handler);
    const result = await firstValueFrom(result$);

    assert.deepStrictEqual(result, rawData);
  });

  it('should wrap null or undefined responses in { success: true, data: null }', async () => {
    const context = createMockContext('http');

    // Test null
    const nullResult$ = interceptor.intercept(context, createMockCallHandler(null));
    const nullResult = await firstValueFrom(nullResult$);
    assert.deepStrictEqual(nullResult, { success: true, data: null });

    // Test undefined
    const undefinedResult$ = interceptor.intercept(context, createMockCallHandler(undefined));
    const undefinedResult = await firstValueFrom(undefinedResult$);
    assert.deepStrictEqual(undefinedResult, { success: true, data: null });
  });

  it('should bypass transformation when data is already an envelope with success property', async () => {
    const context = createMockContext('http');
    const enveloped = { success: false, error: { code: 'CUSTOM_ERROR', message: 'Failed' } };
    const handler = createMockCallHandler(enveloped);

    const result$ = interceptor.intercept(context, handler);
    const result = await firstValueFrom(result$);

    assert.deepStrictEqual(result, enveloped);
  });

  it('should bypass transformation when data is a binary Buffer', async () => {
    const context = createMockContext('http');
    const bufferData = Buffer.from('PDF file binary content');
    const handler = createMockCallHandler(bufferData);

    const result$ = interceptor.intercept(context, handler);
    const result = await firstValueFrom(result$);

    assert.strictEqual(Buffer.isBuffer(result), true);
    assert.deepStrictEqual(result, bufferData);
  });

  it('should transform paginated collections { items, meta } to { success: true, data: items, meta }', async () => {
    const context = createMockContext('http');
    const paginated = {
      items: [
        { id: '1', name: 'Item 1' },
        { id: '2', name: 'Item 2' },
      ],
      meta: { page: 1, limit: 10, total: 2, totalPages: 1 },
    };
    const handler = createMockCallHandler(paginated);

    const result$ = interceptor.intercept(context, handler);
    const result = (await firstValueFrom(result$)) as any;

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, paginated.items);
    assert.deepStrictEqual(result.meta, paginated.meta);
  });

  it('should transform paginated collections { data, meta } to { success: true, data, meta }', async () => {
    const context = createMockContext('http');
    const paginated = {
      data: [{ id: '10' }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    const handler = createMockCallHandler(paginated);

    const result$ = interceptor.intercept(context, handler);
    const result = (await firstValueFrom(result$)) as any;

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, paginated.data);
    assert.deepStrictEqual(result.meta, paginated.meta);
  });

  it('should transform standard single object and array responses to { success: true, data }', async () => {
    const context = createMockContext('http');

    // Single object
    const singleObj = { id: 'usr_1', name: 'Alice' };
    const singleResult$ = interceptor.intercept(context, createMockCallHandler(singleObj));
    const singleResult = await firstValueFrom(singleResult$);
    assert.deepStrictEqual(singleResult, { success: true, data: singleObj });

    // Array
    const arrayData = ['alpha', 'beta', 'gamma'];
    const arrayResult$ = interceptor.intercept(context, createMockCallHandler(arrayData));
    const arrayResult = await firstValueFrom(arrayResult$);
    assert.deepStrictEqual(arrayResult, { success: true, data: arrayData });
  });
});
