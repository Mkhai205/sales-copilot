'use client';

import * as React from 'react';
import { Copy, Check, RefreshCw, Send, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import {
  WebhookDeliveryStatus,
  type WebhookDeliveryDetailDto,
} from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DELIVERY_STATUS_META } from './constants/webhook-options';
import { useWebhookDeliveryDetail, useRetryWebhookDelivery } from './hooks/use-webhooks';
import { toast } from 'sonner';

interface WebhookDeliveryDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  subscriptionId: string;
  deliveryId: string | null;
  targetUrl: string;
}

export function WebhookDeliveryDetailDialog({
  open,
  onOpenChange,
  workspaceId,
  subscriptionId,
  deliveryId,
  targetUrl,
}: WebhookDeliveryDetailDialogProps) {
  const [copied, setCopied] = React.useState(false);

  const { data: detail, isLoading } = useWebhookDeliveryDetail(
    workspaceId,
    subscriptionId,
    deliveryId ?? undefined,
  );

  const { mutate: retryDelivery, isPending: isRetrying } = useRetryWebhookDelivery(
    workspaceId,
    subscriptionId,
  );

  const handleCopyPayload = () => {
    if (!detail?.payload) return;
    const jsonStr = JSON.stringify(detail.payload, null, 2);
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    toast.success('Payload copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    if (!deliveryId) return;
    retryDelivery(deliveryId);
  };

  const statusMeta = detail?.status
    ? DELIVERY_STATUS_META[detail.status]
    : DELIVERY_STATUS_META[WebhookDeliveryStatus.PENDING];

  const formattedPayload = React.useMemo(() => {
    if (!detail?.payload) return '';
    try {
      return typeof detail.payload === 'string'
        ? detail.payload
        : JSON.stringify(detail.payload, null, 2);
    } catch {
      return String(detail.payload);
    }
  }, [detail?.payload]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center justify-between pr-6">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Send className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-foreground">
                  Webhook Delivery Details
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-mono truncate max-w-md">
                  {targetUrl}
                </DialogDescription>
              </div>
            </div>

            {detail && (
              <Badge variant="outline" className={`text-xs ${statusMeta.badgeStyle}`}>
                {statusMeta.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-140px)] overflow-y-auto px-6 py-4">
          {isLoading || !detail ? (
            <div className="flex min-h-[250px] items-center justify-center">
              <Spinner className="size-6 text-primary" />
            </div>
          ) : (
            <div className="flex flex-col gap-5 text-xs">
              {/* Overview Metrics Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Event Type
                  </span>
                  <p className="mt-1 font-mono text-xs font-semibold text-foreground truncate">
                    {detail.eventType}
                  </p>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    HTTP Response
                  </span>
                  <p className="mt-1 font-mono text-xs font-semibold">
                    {detail.responseStatus ? (
                      <span
                        className={
                          detail.responseStatus >= 200 && detail.responseStatus < 300
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }
                      >
                        {detail.responseStatus}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </p>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Attempts
                  </span>
                  <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                    {detail.attemptCount} attempt(s)
                  </p>
                </div>

                <div className="rounded-lg border border-border/70 bg-card/60 p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Delivery Time
                  </span>
                  <p className="mt-1 font-mono text-xs text-muted-foreground truncate">
                    {new Date(detail.createdAt).toLocaleTimeString()}
                  </p>
                </div>
              </div>

              {/* Request Payload Section */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Event Request Payload (JSON)
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyPayload}
                    className="h-7 gap-1.5 text-[11px]"
                  >
                    {copied ? (
                      <Check className="size-3 text-emerald-400" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {copied ? 'Copied' : 'Copy JSON'}
                  </Button>
                </div>

                <pre className="max-h-64 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                  {formattedPayload || '{}'}
                </pre>
              </div>

              {/* Response Body Section */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    Endpoint Response Body
                  </span>
                </div>

                {detail.responseBody ? (
                  <pre className="max-h-48 overflow-x-auto rounded-lg border border-border/60 bg-muted/40 p-3 font-mono text-[11px] leading-relaxed text-foreground">
                    {detail.responseBody}
                  </pre>
                ) : (
                  <div className="flex h-16 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs italic text-muted-foreground">
                    No response body returned from endpoint
                  </div>
                )}
              </div>
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="border-t border-border px-6 py-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Close
          </Button>

          {detail && detail.status !== WebhookDeliveryStatus.DELIVERED && (
            <Button
              type="button"
              size="sm"
              disabled={isRetrying}
              onClick={handleRetry}
              className="gap-1.5 text-xs"
            >
              {isRetrying ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Retry Delivery
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
