/**
 * Zero-dependency pure SVG Code128 (Subset B) Barcode Generator.
 * Optimized for 203 DPI thermal printers with `shape-rendering="crispEdges"`
 * to eliminate blurriness and guarantee 100% optical scanner readability.
 */

// Code128 pattern widths: 6 widths for 0..105 (B,S,B,S,B,S), 7 widths for 106 (B,S,B,S,B,S,B)
const CODE128_PATTERNS: string[] = [
  '212222',
  '222122',
  '222221',
  '121223',
  '121322',
  '131222',
  '122213',
  '122312',
  '132212',
  '221213',
  '221312',
  '231212',
  '112232',
  '122132',
  '122231',
  '113222',
  '123122',
  '123221',
  '223211',
  '221132',
  '221231',
  '213212',
  '223112',
  '312131',
  '311222',
  '321122',
  '321221',
  '312212',
  '322112',
  '322211',
  '212123',
  '212321',
  '232121',
  '111323',
  '131123',
  '131321',
  '112313',
  '132113',
  '132311',
  '211313',
  '231113',
  '231311',
  '112133',
  '112331',
  '132131',
  '113123',
  '113321',
  '133121',
  '313121',
  '211331',
  '231131',
  '213113',
  '213311',
  '213131',
  '311123',
  '311321',
  '331121',
  '312113',
  '312311',
  '332111',
  '314111',
  '221411',
  '431111',
  '111224',
  '111422',
  '121124',
  '121421',
  '141122',
  '141221',
  '112214',
  '112412',
  '122114',
  '122411',
  '142112',
  '142211',
  '241211',
  '221114',
  '413111',
  '241112',
  '134111',
  '111242',
  '121142',
  '121241',
  '114212',
  '124112',
  '124211',
  '411212',
  '421112',
  '421211',
  '212141',
  '214121',
  '412121',
  '111143',
  '111341',
  '131141',
  '114113',
  '114311',
  '411113',
  '411311',
  '113141',
  '114131',
  '311141',
  '411131',
  '211412',
  '211214',
  '211232',
  '2331112',
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface Code128SvgOptions {
  height?: number;
  barWidth?: number;
  quietZone?: number;
  showText?: boolean;
  fontSize?: number;
}

/**
 * Encodes text into a crisp Code128 SVG string.
 */
export function generateCode128Svg(text: string, options?: Code128SvgOptions): string {
  const height = options?.height ?? 50;
  const barWidth = options?.barWidth ?? 2;
  const quietZone = options?.quietZone ?? 10;
  const showText = options?.showText ?? true;
  const fontSize = options?.fontSize ?? 12;

  // 1. Sanitize text to ASCII range 32-126
  const cleanText = (text || 'EMPTY').replace(/[^\x20-\x7E]/g, '');

  // 2. Compute symbol codes and modulo 103 checksum
  const codes: number[] = [START_CODE_B];
  let checksum = START_CODE_B;

  for (let i = 0; i < cleanText.length; i++) {
    const code = cleanText.charCodeAt(i) - 32;
    codes.push(code);
    checksum += code * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  // 3. Build bar modules
  const bars: Array<{ x: number; width: number }> = [];
  let currentX = quietZone;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    if (!pattern) continue;

    for (let p = 0; p < pattern.length; p++) {
      const width = parseInt(pattern[p], 10) * barWidth;
      const isBar = p % 2 === 0;

      if (isBar) {
        bars.push({ x: currentX, width });
      }
      currentX += width;
    }
  }

  currentX += quietZone;
  const totalWidth = currentX;
  const totalHeight = showText ? height + fontSize + 4 : height;

  // 4. Render crisp SVG elements
  const rects = bars
    .map(b => `<rect x="${b.x}" y="0" width="${b.width}" height="${height}" fill="black" />`)
    .join('');

  const textElement = showText
    ? `<text x="${totalWidth / 2}" y="${height + fontSize}" font-family="monospace, Courier, sans-serif" font-size="${fontSize}" font-weight="bold" text-anchor="middle" fill="black">${cleanText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" shape-rendering="crispEdges" style="display:block;margin:0 auto;">${rects}${textElement}</svg>`;
}
