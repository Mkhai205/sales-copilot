/**
 * Extracts order display ID from Vietnamese banking transfer memo.
 * Matches patterns: "ORD 1004", "ORD-1004", "ORD_1004", "ORD1004", "DH 1004", "SO 1004",
 * as well as full order number patterns like "ORD-20260909-1004" or "ORD_20260909_1004".
 */
export function parseOrderDisplayId(memo: string): number | null {
  if (!memo) return null;
  const match = memo.match(/(?:ORD|DH|SO)[\s_-]*(?:(?:\d{8}|\d{6})[\s_-]+)?(\d+)/i);
  if (match && match[1]) {
    const id = parseInt(match[1], 10);
    return isNaN(id) ? null : id;
  }
  return null;
}

/**
 * Extracts full order number (e.g. "ORD-20260909-1004") if present in memo.
 */
export function parseOrderNumber(memo: string): string | null {
  if (!memo) return null;
  const match = memo.match(/ORD-\d{6,8}-\d+/i);
  return match ? match[0].toUpperCase() : null;
}
