import { RequestIdMiddleware } from '../request-id.middleware';

describe('RequestIdMiddleware (Common Middleware — FINDING-P9-02)', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('should generate a new UUID and set headers when x-request-id is not provided', () => {
    const req: any = { headers: {} };
    const responseHeaders: Record<string, string> = {};
    const res: any = {
      setHeader: (key: string, value: string) => {
        responseHeaders[key.toLowerCase()] = value;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.headers['x-request-id']).toBeTruthy();
    // Standard UUID v4 format: 8-4-4-4-12 hex characters
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(req.headers['x-request-id']).toMatch(uuidRegex);
    expect(responseHeaders['x-request-id']).toBe(req.headers['x-request-id']);
  });

  it('should preserve and forward existing x-request-id header when already provided', () => {
    const existingTraceId = 'trace-external-12345-abcde';
    const req: any = {
      headers: {
        'x-request-id': existingTraceId,
      },
    };
    const responseHeaders: Record<string, string> = {};
    const res: any = {
      setHeader: (key: string, value: string) => {
        responseHeaders[key.toLowerCase()] = value;
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware.use(req, res, next);

    expect(nextCalled).toBe(true);
    expect(req.headers['x-request-id']).toBe(existingTraceId);
    expect(responseHeaders['x-request-id']).toBe(existingTraceId);
  });
});
