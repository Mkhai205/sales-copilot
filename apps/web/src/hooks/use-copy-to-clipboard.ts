'use client';

import * as React from 'react';

/**
 * Copy-to-clipboard with a transient "copied" flag keyed by value — replaces
 * the copiedId + setTimeout pattern previously repeated per table.
 */
export function useCopyToClipboard(resetDelayMs = 2000) {
  const [copiedValue, setCopiedValue] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = React.useCallback(
    (value: string) => {
      navigator.clipboard
        .writeText(value)
        .then(() => {
          setCopiedValue(value);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setCopiedValue(null), resetDelayMs);
        })
        .catch(() => {
          // Clipboard unavailable (permissions/insecure context) — no-op
        });
    },
    [resetDelayMs],
  );

  return { copiedValue, copy };
}
