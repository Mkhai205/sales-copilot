'use client';

import * as React from 'react';
import { CircleDollarSign, UserCheck, Target, Calendar, CheckCircle2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { BuyingSignalType, type SalesEvidenceResponseDto } from '@sales-copilot/shared-contracts';

interface BantMatrixProps {
  evidences: SalesEvidenceResponseDto[];
}

export function BantMatrix({ evidences }: BantMatrixProps) {
  // Only consider non-invalidated evidences
  const activeEvidences = (evidences || []).filter(e => Boolean(e && !e.isInvalidated));

  const hasBudget = activeEvidences.some(e => e.signalType === BuyingSignalType.BUDGET_CONFIRMED);
  const hasAuthority = activeEvidences.some(
    e => e.signalType === BuyingSignalType.AUTHORITY_IDENTIFIED,
  );
  const hasNeed = activeEvidences.some(e => e.signalType === BuyingSignalType.NEED_EXPRESSED);
  const hasTimeline = activeEvidences.some(e => e.signalType === BuyingSignalType.TIMELINE_DEFINED);

  const bantItems = [
    {
      key: 'budget',
      label: 'Budget',
      sublabel: 'Ngân sách',
      confirmed: hasBudget,
      icon: CircleDollarSign,
      evidence: activeEvidences.find(e => e.signalType === BuyingSignalType.BUDGET_CONFIRMED),
    },
    {
      key: 'authority',
      label: 'Authority',
      sublabel: 'Thẩm quyền',
      confirmed: hasAuthority,
      icon: UserCheck,
      evidence: activeEvidences.find(e => e.signalType === BuyingSignalType.AUTHORITY_IDENTIFIED),
    },
    {
      key: 'need',
      label: 'Need',
      sublabel: 'Nhu cầu',
      confirmed: hasNeed,
      icon: Target,
      evidence: activeEvidences.find(e => e.signalType === BuyingSignalType.NEED_EXPRESSED),
    },
    {
      key: 'timeline',
      label: 'Timeline',
      sublabel: 'Thời hạn',
      confirmed: hasTimeline,
      icon: Calendar,
      evidence: activeEvidences.find(e => e.signalType === BuyingSignalType.TIMELINE_DEFINED),
    },
  ];

  const confirmedCount = bantItems.filter(i => i.confirmed).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Sổ cái tiêu chuẩn BANT</span>
        <span className="text-[11px] font-medium text-muted-foreground">
          {confirmedCount}/4 tiêu chí
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {bantItems.map(item => {
          const Icon = item.icon;
          return (
            <Card
              key={item.key}
              className={`p-2.5 transition-colors border ${
                item.confirmed
                  ? 'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
                  : 'border-border/60 bg-muted/20 opacity-75'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <Icon
                    className={`size-3.5 ${
                      item.confirmed
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold leading-tight text-foreground">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground leading-tight">
                      {item.sublabel}
                    </span>
                  </div>
                </div>

                {item.confirmed ? (
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="size-3.5 text-muted-foreground/40 shrink-0" />
                )}
              </div>

              {item.confirmed && item.evidence && (
                <div className="mt-1.5 pt-1.5 border-t border-emerald-500/10">
                  <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                    "{item.evidence.snippet}"
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
