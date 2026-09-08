'use client';

import * as React from 'react';
import type { PosDraftSuggestedEventPayload } from '@sales-copilot/shared-contracts';
import { Sparkles, ArrowRight, X, User, Phone, MapPin, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AiAutofillBannerProps {
  suggestion: PosDraftSuggestedEventPayload | null;
  onApply: (suggestion: PosDraftSuggestedEventPayload) => void;
  onDismiss: () => void;
}

export function AiAutofillBanner({ suggestion, onApply, onDismiss }: AiAutofillBannerProps) {
  if (!suggestion || suggestion.confidenceScore < 80) return null;

  const { suggestedCustomer, suggestedItems } = suggestion;

  const addressSummary = [
    suggestedCustomer?.streetAddress,
    suggestedCustomer?.ward,
    suggestedCustomer?.district,
    suggestedCustomer?.province,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="relative overflow-hidden rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-background to-primary/5 p-2.5 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
      <div className="flex items-start justify-between gap-2">
        {/* Main Content */}
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="size-3.5" />
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-foreground">
                AI phát hiện thông tin đơn hàng
              </span>
              <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                {suggestion.confidenceScore}% tin cậy
              </span>
            </div>

            {/* Extracted Details Pill Grid */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {suggestedCustomer?.recipientName && (
                <span className="flex items-center gap-1">
                  <User className="size-3 text-primary/70" />
                  <strong className="text-foreground font-medium">
                    {suggestedCustomer.recipientName}
                  </strong>
                </span>
              )}

              {suggestedCustomer?.phoneNumber && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3 text-primary/70" />
                  <span className="font-mono text-foreground font-medium">
                    {suggestedCustomer.phoneNumber}
                  </span>
                </span>
              )}

              {addressSummary && (
                <span
                  className="flex items-center gap-1 truncate max-w-[260px]"
                  title={addressSummary}
                >
                  <MapPin className="size-3 shrink-0 text-primary/70" />
                  <span className="truncate">{addressSummary}</span>
                </span>
              )}

              {suggestedItems && suggestedItems.length > 0 && (
                <span className="flex items-center gap-1">
                  <Package className="size-3 text-primary/70" />
                  <span>
                    {suggestedItems.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-7 text-xs px-2.5 font-semibold gap-1 shadow-xs"
            onClick={() => onApply(suggestion)}
          >
            Áp dụng vào POS (F4)
            <ArrowRight className="size-3" />
          </Button>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-7 text-muted-foreground hover:text-foreground"
            onClick={onDismiss}
            title="Bỏ qua gợi ý"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
