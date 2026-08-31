'use client';

import * as React from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Send,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  WebhookDeliveryStatus,
  type WebhookDeliveryDto,
  type WebhookSubscriptionDto,
} from '@sales-copilot/shared-contracts';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { DELIVERY_STATUS_META } from './constants/webhook-options';
import { useWebhookDeliveries } from './hooks/use-webhooks';
import { WebhookDeliveryDetailDialog } from './webhook-delivery-detail-dialog';

interface WebhookDeliveryLogsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  subscription: WebhookSubscriptionDto | null;
}

export function WebhookDeliveryLogsSheet({
  open,
  onOpenChange,
  workspaceId,
  subscription,
}: WebhookDeliveryLogsSheetProps) {
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [page, setPage] = React.useState(1);
  const [inspectingDeliveryId, setInspectingDeliveryId] = React.useState<string | null>(null);

  // Reset pagination on subscription change or filter change
  React.useEffect(() => {
    setPage(1);
  }, [subscription?.id, statusFilter]);

  const queryParams = React.useMemo(() => {
    return {
      page,
      limit: 15,
      ...(statusFilter !== 'ALL' && {
        status: statusFilter as WebhookDeliveryStatus,
      }),
    };
  }, [page, statusFilter]);

  const { data, isLoading, refetch, isFetching } = useWebhookDeliveries(
    workspaceId,
    subscription?.id,
    queryParams,
  );

  const deliveries = data?.items || [];
  const meta = data?.meta;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0">
          {/* Header */}
          <SheetHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between pr-8">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Activity className="size-4" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold text-foreground">
                    Delivery History & Logs
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground font-mono truncate max-w-md">
                    {subscription?.url || 'Webhook Endpoint'}
                  </SheetDescription>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                <RefreshCw className={`size-3 ${isFetching ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </SheetHeader>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between border-b border-border/60 bg-card/30 px-6 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">Filter by Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-36 bg-background/50 text-xs">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL" className="text-xs">
                      All Statuses
                    </SelectItem>
                    {Object.values(DELIVERY_STATUS_META).map(m => (
                      <SelectItem key={m.status} value={m.status} className="text-xs">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {meta && (
              <span className="text-xs text-muted-foreground">
                Total: <strong className="text-foreground">{meta.total}</strong> deliveries
              </span>
            )}
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {isLoading ? (
              <div className="flex flex-col gap-2 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-md" />
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 p-8 text-center bg-card/20">
                <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground mb-2">
                  <Send className="size-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">No delivery logs found</h4>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {statusFilter !== 'ALL'
                    ? 'No delivery events match the selected status filter.'
                    : 'Events triggered in your workspace will automatically appear here as they are delivered.'}
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border/70">
                <Table>
                  <TableHeader className="bg-card/60">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Event</TableHead>
                      <TableHead className="text-xs">Response</TableHead>
                      <TableHead className="text-xs">Attempts</TableHead>
                      <TableHead className="text-xs">Time</TableHead>
                      <TableHead className="w-16 text-right text-xs">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deliveries.map(item => {
                      const meta =
                        DELIVERY_STATUS_META[item.status] || DELIVERY_STATUS_META.PENDING;
                      const statusCode = item.responseStatusCode || item.responseStatus;
                      const attemptNum = item.attemptCount || item.attempts || 1;

                      return (
                        <TableRow key={item.id} className="hover:bg-muted/30 text-xs">
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`py-0 text-[10px] ${meta.badgeStyle}`}
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>

                          <TableCell className="font-mono text-xs font-medium text-foreground">
                            {item.eventType || item.event}
                          </TableCell>

                          <TableCell>
                            {statusCode ? (
                              <span
                                className={`font-mono font-semibold text-xs ${
                                  statusCode >= 200 && statusCode < 300
                                    ? 'text-emerald-400'
                                    : 'text-rose-400'
                                }`}
                              >
                                {statusCode}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">-</span>
                            )}
                          </TableCell>

                          <TableCell className="text-muted-foreground">{attemptNum}</TableCell>

                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setInspectingDeliveryId(item.id)}
                              className="size-7 text-muted-foreground hover:text-foreground"
                              title="Inspect payload & response"
                            >
                              <Eye className="size-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Pagination Footer */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-card/20">
              <span className="text-xs text-muted-foreground">
                Page {meta.page} of {meta.totalPages}
              </span>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= meta.totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Inspect Delivery Detail Dialog */}
      {inspectingDeliveryId && (
        <WebhookDeliveryDetailDialog
          open={!!inspectingDeliveryId}
          onOpenChange={open => !open && setInspectingDeliveryId(null)}
          workspaceId={workspaceId}
          subscriptionId={subscription?.id || ''}
          deliveryId={inspectingDeliveryId}
          targetUrl={subscription?.url || ''}
        />
      )}
    </>
  );
}
