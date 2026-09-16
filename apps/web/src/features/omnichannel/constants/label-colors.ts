export interface LabelColorPreset {
  name: string;
  hex: string;
}

export const LABEL_PRESET_COLORS: LabelColorPreset[] = [
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Indigo', hex: '#6366f1' },
  { name: 'Purple', hex: '#8b5cf6' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'Red', hex: '#ef4444' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Amber', hex: '#f59e0b' },
  { name: 'Emerald', hex: '#10b981' },
  { name: 'Teal', hex: '#14b8a6' },
  { name: 'Cyan', hex: '#06b6d4' },
  { name: 'Slate', hex: '#64748b' },
];

/**
 * Validate whether a string is a valid 6-digit hex color format (#RRGGBB)
 */
export function isValidHexColor(hex?: string | null): boolean {
  if (!hex) return false;
  return /^#[0-9A-Fa-f]{6}$/.test(hex.trim());
}
