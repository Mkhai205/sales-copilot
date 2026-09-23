'use client';

import * as React from 'react';
import { isValidHexColor } from '../../constants/label-colors';

interface LabelBadgePreviewProps {
  title: string;
  color?: string | null;
}

export function LabelBadgePreview({ title, color: rawColor }: LabelBadgePreviewProps) {
  const color = isValidHexColor(rawColor) ? rawColor : '#2563eb';

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-2xs"
      style={{
        backgroundColor: `${color}18`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="font-medium">{title}</span>
    </div>
  );
}
