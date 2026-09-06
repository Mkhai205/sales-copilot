import { describe, it, beforeEach } from 'node:test';
import * as assert from 'node:assert';
import { BuyingSignalType } from '@sales-copilot/shared-contracts';
import { BantSignalAnalyzer } from '../analyzers/bant-signal.analyzer';

describe('BantSignalAnalyzer (Verbatim Matching & Signal Thresholds)', () => {
  let analyzer: BantSignalAnalyzer;

  beforeEach(() => {
    analyzer = new BantSignalAnalyzer();
  });

  describe('cleanSnippet', () => {
    it('should strip outer quotes, markdown symbols, and whitespace', () => {
      assert.strictEqual(analyzer.cleanSnippet('  "Ngân sách 200 triệu" '), 'Ngân sách 200 triệu');
      assert.strictEqual(
        analyzer.cleanSnippet('“Cần gấp trong tháng 11”'),
        'Cần gấp trong tháng 11',
      );
      assert.strictEqual(
        analyzer.cleanSnippet("'Tôi là Giám đốc kỹ thuật'"),
        'Tôi là Giám đốc kỹ thuật',
      );
      assert.strictEqual(analyzer.cleanSnippet('**Ngân sách 500 triệu**'), 'Ngân sách 500 triệu');
      assert.strictEqual(
        analyzer.cleanSnippet('`triển khai trước 30/11`'),
        'triển khai trước 30/11',
      );
      assert.strictEqual(analyzer.cleanSnippet('đang cân nhắc đối thủ…'), 'đang cân nhắc đối thủ');
    });
  });

  describe('verifyAndNormalizeSnippet', () => {
    const fullText =
      'Chào bạn,\nbên anh đã duyệt ngân sách 150 triệu, dự kiến triển khai trước ngày 30/11 nhé…';

    it('should match exact verbatim substring', () => {
      const snippet = 'bên anh đã duyệt ngân sách 150 triệu';
      const result = analyzer.verifyAndNormalizeSnippet(snippet, fullText);
      assert.strictEqual(result, 'bên anh đã duyệt ngân sách 150 triệu');
      assert.ok(result && fullText.includes(result));
    });

    it('should match case-insensitively and return source casing', () => {
      const snippet = 'BÊN ANH ĐÃ DUYỆT NGÂN SÁCH 150 TRIỆU';
      const result = analyzer.verifyAndNormalizeSnippet(snippet, fullText);
      assert.strictEqual(result, 'bên anh đã duyệt ngân sách 150 triệu');
      assert.ok(result && fullText.includes(result));
    });

    it('should strip surrounding quotes and markdown in candidate snippet', () => {
      const snippet = '**"dự kiến triển khai trước ngày 30/11"**';
      const result = analyzer.verifyAndNormalizeSnippet(snippet, fullText);
      assert.strictEqual(result, 'dự kiến triển khai trước ngày 30/11');
      assert.ok(result && fullText.includes(result));
    });

    it('should strip trailing punctuation and Vietnamese ellipsis in candidate snippet', () => {
      const snippet = 'trước ngày 30/11 nhé…';
      const result = analyzer.verifyAndNormalizeSnippet(snippet, fullText);
      assert.strictEqual(result, 'trước ngày 30/11 nhé');
      assert.ok(result && fullText.includes(result));
    });

    it('should match across newlines/whitespace and always return exact substring of fullText', () => {
      const snippet = 'Chào bạn bên anh đã duyệt ngân sách';
      const result = analyzer.verifyAndNormalizeSnippet(snippet, fullText);
      assert.ok(result, 'Should find matching slice across newline');
      assert.strictEqual(result, 'Chào bạn,\nbên anh đã duyệt ngân sách');
      assert.ok(fullText.includes(result), 'Result MUST be an exact substring of fullText');
    });

    it('should return null for hallucinated snippet not present in message', () => {
      const hallucinated = 'Chúng tôi sẽ thanh toán bằng chuyển khoản ngân hàng';
      const result = analyzer.verifyAndNormalizeSnippet(hallucinated, fullText);
      assert.strictEqual(result, null);
    });

    it('should return null when input is empty or null', () => {
      assert.strictEqual(analyzer.verifyAndNormalizeSnippet('', fullText), null);
      assert.strictEqual(analyzer.verifyAndNormalizeSnippet('test', ''), null);
    });
  });

  describe('verifySignals', () => {
    const messageContent =
      'Bên Chatwoot và Zendesk đang báo giá rẻ hơn 20%, nhưng bên anh duyệt ngân sách 150 triệu, dự kiến triển khai trước ngày 30/11.';

    it('should accept valid signals >= 0.70 confidence with verified verbatim snippet', () => {
      const rawSignals: any[] = [
        {
          signalType: BuyingSignalType.BUDGET_CONFIRMED,
          confidence: 0.95,
          snippet: 'ngân sách 150 triệu',
          reasoning: 'Explicit budget of 150m stated',
        },
        {
          signalType: 'TIMELINE_STATED',
          confidence: 0.88,
          snippet: 'dự kiến triển khai trước ngày 30/11',
          reasoning: 'Explicit timeline deadline',
        },
      ];

      const verified = analyzer.verifySignals(rawSignals, messageContent);
      assert.strictEqual(verified.length, 2);

      assert.strictEqual(verified[0].signalType, BuyingSignalType.BUDGET_CONFIRMED);
      assert.strictEqual(verified[0].snippet, 'ngân sách 150 triệu');
      assert.strictEqual(verified[0].confidence, 0.95);

      // Verify coercion to TIMELINE_DEFINED
      assert.strictEqual(verified[1].signalType, BuyingSignalType.TIMELINE_DEFINED);
      assert.strictEqual(verified[1].snippet, 'dự kiến triển khai trước ngày 30/11');
    });

    it('should discard signals with confidence below 0.70 threshold', () => {
      const rawSignals: any[] = [
        {
          signalType: BuyingSignalType.NEED_EXPRESSED,
          confidence: 0.65, // Below 0.70
          snippet: 'báo giá rẻ hơn 20%',
          reasoning: 'Weak signal',
        },
      ];

      const verified = analyzer.verifySignals(rawSignals, messageContent);
      assert.strictEqual(verified.length, 0);
    });

    it('should discard signals with hallucinated snippets even if confidence is high', () => {
      const rawSignals: any[] = [
        {
          signalType: BuyingSignalType.BUDGET_CONFIRMED,
          confidence: 0.99,
          snippet: 'Ngân sách 500 triệu năm sau', // Not in message
          reasoning: 'Model hallucinated amount',
        },
      ];

      const verified = analyzer.verifySignals(rawSignals, messageContent);
      assert.strictEqual(verified.length, 0);
    });

    it('should preserve competitor and objection metadata', () => {
      const rawSignals: any[] = [
        {
          signalType: BuyingSignalType.COMPETITOR_MENTION,
          confidence: 0.92,
          snippet: 'Bên Chatwoot và Zendesk',
          reasoning: 'Competitors evaluated',
          metadata: { competitors: ['Chatwoot', 'Zendesk'] },
        },
        {
          signalType: BuyingSignalType.OBJECTION_RAISED,
          confidence: 0.89,
          snippet: 'báo giá rẻ hơn 20%',
          reasoning: 'Price objection',
          metadata: { objectionCategory: 'PRICE' },
        },
      ];

      const verified = analyzer.verifySignals(rawSignals, messageContent);
      assert.strictEqual(verified.length, 2);
      assert.strictEqual(verified[0].signalType, BuyingSignalType.COMPETITOR_MENTION);
      assert.deepStrictEqual(verified[0].metadata, { competitors: ['Chatwoot', 'Zendesk'] });
      assert.strictEqual(verified[1].signalType, BuyingSignalType.OBJECTION_RAISED);
      assert.deepStrictEqual(verified[1].metadata, { objectionCategory: 'PRICE' });
    });
  });
});
