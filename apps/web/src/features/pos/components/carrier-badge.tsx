'use client';

import * as React from 'react';
import { CarrierNetwork, detectCarrierNetwork } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CarrierBadgeProps {
  phone?: string;
  carrier?: CarrierNetwork;
  className?: string;
  showOther?: boolean;
}

const CARRIER_CONFIG: Record<CarrierNetwork, { label: string; className: string }> = {
  [CarrierNetwork.VIETTEL]: {
    label: 'Viettel',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  [CarrierNetwork.VINAPHONE]: {
    label: 'Vinaphone',
    className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  [CarrierNetwork.MOBIFONE]: {
    label: 'Mobifone',
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  [CarrierNetwork.VIETNAMOBILE]: {
    label: 'Vietnamobile',
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  [CarrierNetwork.GMOBILE]: {
    label: 'Gmobile',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  [CarrierNetwork.ITEL]: {
    label: 'iTel',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  [CarrierNetwork.WINTEL]: {
    label: 'Wintel',
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  },
  [CarrierNetwork.OTHER]: {
    label: 'Khác',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

export function CarrierBadge({
  phone,
  carrier: explicitCarrier,
  className,
  showOther = false,
}: CarrierBadgeProps) {
  const resolvedCarrier = React.useMemo<CarrierNetwork>(() => {
    if (explicitCarrier) return explicitCarrier;
    if (phone) return detectCarrierNetwork(phone);
    return CarrierNetwork.OTHER;
  }, [explicitCarrier, phone]);

  if (resolvedCarrier === CarrierNetwork.OTHER && !showOther) {
    return null;
  }

  const config = CARRIER_CONFIG[resolvedCarrier] || CARRIER_CONFIG[CarrierNetwork.OTHER];

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-medium tracking-tight px-1.5 py-0 h-4 border',
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
