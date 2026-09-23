import { generateObject } from 'ai';
import { createExtractShippingInfoTool } from '../extract-shipping-info.tool';

jest.mock('ai', () => {
  const actual = jest.requireActual('ai');
  return {
    ...actual,
    generateObject: jest.fn(),
  };
});

describe('extractShippingInfo Tool (T4)', () => {
  let tool: any;
  const mockGenerateObject = generateObject as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    tool = createExtractShippingInfoTool();
  });

  it('should return 0 confidence and _meta when text is empty', async () => {
    const result = await tool.execute({ text: '   ' }, {} as any);
    expect(result.confidence).toBe(0);
    expect(result._meta).toEqual({
      tierUsed: 1,
      duration: expect.any(Number),
    });
  });

  it('should extract phone number and address hierarchy via Tier 1 fast path', async () => {
    const input = '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội. SĐT: 0988123456';
    const result = await tool.execute({ text: input }, {} as any);

    expect(result.phoneNumber).toBe('0988123456');
    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Hai Bà Trưng');
    expect(result.ward).toBe('Phường Đồng Tâm');
    expect(result.streetAddress?.includes('15 ngõ 45 Vọng')).toBeTruthy();
    expect(result.confidence >= 70).toBeTruthy();
    expect(result._meta.tierUsed).toBe(1);
    expect(typeof result._meta.duration).toBe('number');
    expect(result._meta.tier2Duration).toBeUndefined();
    expect(mockGenerateObject).not.toHaveBeenCalled();
  });

  it('should extract recipient name when explicit name patterns are present', async () => {
    const input =
      'Người nhận: Nguyễn Văn An, SĐT 0912345678, số 10 đường Trần Hưng Đạo, Hoàn Kiếm, Hà Nội';
    const result = await tool.execute({ text: input }, {} as any);

    expect(result.recipientName).toBe('Nguyễn Văn An');
    expect(result.phoneNumber).toBe('0912345678');
    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Hoàn Kiếm');
    expect(result._meta.tierUsed).toBe(1);
  });

  it('should call Tier 2 generateObject with AbortSignal when confidence < 70 and model provided', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        recipientName: 'Trần Văn B',
        phoneNumber: '0901234567',
        province: 'Thành phố Hồ Chí Minh',
        district: 'Quận 1',
        ward: 'Phường Bến Nghé',
        streetAddress: '123 Lê Duẩn',
      },
    });

    const toolWithModel = createExtractShippingInfoTool({
      model: {} as any,
    });

    // An ambiguous text that won't match Tier 1 high confidence
    const input = 'ship về 123 Lê Duẩn giúp em';
    const result = await toolWithModel.execute({ text: input }, {} as any);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateObject.mock.calls[0][0];
    expect(callArgs.prompt).toContain(input);
    expect(callArgs.abortSignal).toBeDefined();

    expect(result.province).toBe('Thành phố Hồ Chí Minh');
    expect(result.district).toBe('Quận 1');
    expect(result.streetAddress).toBe('123 Lê Duẩn');
    expect(result._meta.tierUsed).toBe(2);
    expect(typeof result._meta.duration).toBe('number');
    expect(typeof result._meta.tier2Duration).toBe('number');
  });

  it('should fallback to Tier 1 gracefully when Tier 2 times out (TimeoutError)', async () => {
    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    mockGenerateObject.mockRejectedValueOnce(timeoutErr);

    const toolWithModel = createExtractShippingInfoTool({
      model: {} as any,
    });

    const input = 'chuyển qua 45 Lê Duẩn';
    const result = await toolWithModel.execute({ text: input }, {} as any);

    // Should not throw, should return whatever Tier 1 found
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(result._meta.tierUsed).toBe(2);
    expect(result._meta.tier2Failed).toBe(true);
    expect(typeof result._meta.tier2Duration).toBe('number');
    expect(result.error).toBeUndefined();
  });

  it('should recognize wrapped TimeoutError in error cause and fallback gracefully', async () => {
    const wrappedErr = new Error('APICallError: call failed');
    wrappedErr.cause = new Error('The operation was aborted due to timeout');
    (wrappedErr.cause as any).name = 'TimeoutError';
    mockGenerateObject.mockRejectedValueOnce(wrappedErr);

    const toolWithModel = createExtractShippingInfoTool({
      model: {} as any,
    });

    const input = 'chuyển qua 45 Lê Duẩn';
    const result = await toolWithModel.execute({ text: input }, {} as any);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(result._meta.tierUsed).toBe(2);
    expect(result._meta.tier2Failed).toBe(true);
    expect(typeof result._meta.tier2Duration).toBe('number');
    expect(result.error).toBeUndefined();
  });

  it('should fallback to Tier 1 gracefully when Tier 2 throws generic error', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('LLM connection reset'));

    const toolWithModel = createExtractShippingInfoTool({
      model: {} as any,
    });

    const input = 'giao đến 10 ngõ 5';
    const result = await toolWithModel.execute({ text: input }, {} as any);

    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
    expect(result._meta.tierUsed).toBe(2);
    expect(result._meta.tier2Failed).toBe(true);
    expect(result.error).toBeUndefined();
  });
});
