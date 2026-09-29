'use client';

import * as React from 'react';
import type { AttachmentDto } from '@sales-copilot/shared-contracts';

export interface LightboxState {
  isOpen: boolean;
  images: AttachmentDto[];
  initialIndex: number;
}

export function useLightbox() {
  const [lightboxState, setLightboxState] = React.useState<LightboxState>({
    isOpen: false,
    images: [],
    initialIndex: 0,
  });

  const openLightbox = React.useCallback((images: AttachmentDto[], index = 0) => {
    setLightboxState({
      isOpen: true,
      images,
      initialIndex: index,
    });
  }, []);

  const closeLightbox = React.useCallback(() => {
    setLightboxState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return { lightboxState, openLightbox, closeLightbox };
}
