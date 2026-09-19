import { createExtractShippingInfoTool } from '../extract-shipping-info.tool';

describe('extractShippingInfo Tool (T4)', () => {
  let tool: any;

  beforeEach(() => {
    tool = createExtractShippingInfoTool();
  });

  it('should return 0 confidence when text is empty', async () => {
    const result = await tool.execute({ text: '   ' }, {} as any);
    expect(result.confidence).toBe(0);
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
  });

  it('should extract recipient name when explicit name patterns are present', async () => {
    const input =
      'Người nhận: Nguyễn Văn An, SĐT 0912345678, số 10 đường Trần Hưng Đạo, Hoàn Kiếm, Hà Nội';
    const result = await tool.execute({ text: input }, {} as any);

    expect(result.recipientName).toBe('Nguyễn Văn An');
    expect(result.phoneNumber).toBe('0912345678');
    expect(result.province).toBe('Thành phố Hà Nội');
    expect(result.district).toBe('Quận Hoàn Kiếm');
  });
});
