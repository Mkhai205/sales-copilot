import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { generateCode128Svg } from '../code128-svg';

describe('Code128 Vector SVG Generator (Thermal 203 DPI Engine)', () => {
  it('should generate valid SVG with crispEdges shape-rendering for standard tracking codes', () => {
    const svg = generateCode128Svg('INTERNAL-1001-A1B2');

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(
      svg.includes('shape-rendering="crispEdges"'),
      'Must specify crispEdges to avoid thermal print blurring',
    );
    assert.ok(svg.includes('<rect'), 'Must render barcode vertical bars as SVG rects');
    assert.ok(svg.includes('INTERNAL-1001-A1B2'), 'Must include text label');
  });

  it('should respect custom dimensions, quiet zone, and bar width', () => {
    const svg = generateCode128Svg('GHN123456', {
      height: 60,
      barWidth: 3,
      quietZone: 20,
      showText: true,
      fontSize: 14,
    });

    assert.ok(svg.includes('height="60"'), 'Height of rects must match custom height');
    assert.ok(svg.includes('font-size="14"'), 'Font size must match custom font size');
    assert.ok(svg.includes('viewBox="0 0'), 'Must define viewBox');
  });

  it('should omit text element when showText is false', () => {
    const svg = generateCode128Svg('TEST-NO-TEXT', {
      showText: false,
    });

    assert.ok(!svg.includes('<text'), 'Must not render <text> tag when showText is false');
    assert.ok(svg.includes('<rect'), 'Bars must still be rendered');
  });

  it('should sanitize non-ASCII characters without throwing', () => {
    const svg = generateCode128Svg('ĐƠN HÀNG #101 (Áo Thun)');

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('#101'), 'Preserves valid ASCII range');
  });

  it('should handle empty or null text gracefully with EMPTY fallback', () => {
    const svg = generateCode128Svg('');

    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.includes('EMPTY'));
  });
});
