import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { createExtractShippingInfoTool } from '../extract-shipping-info.tool';

describe('extractShippingInfo Tool (T4)', () => {
  let tool: any;

  beforeEach(() => {
    tool = createExtractShippingInfoTool();
  });

  it('should return 0 confidence when text is empty', async () => {
    const result = await tool.execute({ text: '   ' }, {} as any);
    assert.strictEqual(result.confidence, 0);
  });

  it('should extract phone number and address hierarchy via Tier 1 fast path', async () => {
    const input = '15 ngõ 45 Vọng, Đồng Tâm, Hai Bà Trưng, Hà Nội. SĐT: 0988123456';
    const result = await tool.execute({ text: input }, {} as any);

    assert.strictEqual(result.phoneNumber, '0988123456');
    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Hai Bà Trưng');
    assert.strictEqual(result.ward, 'Phường Đồng Tâm');
    assert.ok(result.streetAddress?.includes('15 ngõ 45 Vọng'));
    assert.ok(result.confidence >= 70, `Expected confidence >= 70, got ${result.confidence}`);
  });

  it('should extract recipient name when explicit name patterns are present', async () => {
    const input =
      'Người nhận: Nguyễn Văn An, SĐT 0912345678, số 10 đường Trần Hưng Đạo, Hoàn Kiếm, Hà Nội';
    const result = await tool.execute({ text: input }, {} as any);

    assert.strictEqual(result.recipientName, 'Nguyễn Văn An');
    assert.strictEqual(result.phoneNumber, '0912345678');
    assert.strictEqual(result.province, 'Thành phố Hà Nội');
    assert.strictEqual(result.district, 'Quận Hoàn Kiếm');
  });
});
