'use client';

import * as React from 'react';
import {
  Webhook,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Copy,
  Check,
  Activity,
  MoreVertical,
  ShieldCheck,
} from 'lucide-react';
import { type WebhookSubscriptionDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Card, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useWebhookSubscriptions,
  useDeleteWebhookSubscription,
  useToggleWebhookSubscriptionActive,
} from './hooks/use-webhooks';
import { WebhookFormDialog } from './webhook-form-dialog';
import { WebhookDeliveryLogsSheet } from './webhook-delivery-logs-sheet';
import { toast } from 'sonner';

interface WebhooksListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function WebhooksList({ workspaceId, currentUserRole }: WebhooksListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [formDialogOpen, setFormDialogOpen] = React.useState(false);
  const [subscriptionToEdit, setSubscriptionToEdit] = React.useState<WebhookSubscriptionDto | null>(
    null,
  );
  const [subscriptionToDelete, setSubscriptionToDelete] =
    React.useState<WebhookSubscriptionDto | null>(null);
  const [viewingLogsSubscription, setViewingLogsSubscription] =
    React.useState<WebhookSubscriptionDto | null>(null);

  const { data: subscriptions, isLoading } = useWebhookSubscriptions(workspaceId);
  const { mutate: deleteSubscription, isPending: isDeleting } =
    useDeleteWebhookSubscription(workspaceId);
  const { mutate: toggleActive } = useToggleWebhookSubscriptionActive(workspaceId);

  // OWNER and ADMIN can manage webhooks
  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredSubscriptions = React.useMemo(() => {
    if (!subscriptions) return [];

    return subscriptions.filter(sub => {
      const url = sub.url.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        url.includes(q) ||
        (sub.subscriptions && sub.subscriptions.some(s => s.toLowerCase().includes(q)));

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && sub.isActive) ||
        (statusFilter === 'INACTIVE' && !sub.isActive);

      return matchesSearch && matchesStatus;
    });
  }, [subscriptions, searchQuery, statusFilter]);

  const handleCopyUrl = (id: string, urlText: string) => {
    navigator.clipboard.writeText(urlText);
    setCopiedId(id);
    toast.success('Đã sao chép URL endpoint');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateNew = () => {
    setSubscriptionToEdit(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (sub: WebhookSubscriptionDto) => {
    setSubscriptionToEdit(sub);
    setFormDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!subscriptionToDelete) return;
    deleteSubscription(subscriptionToDelete.id, {
      onSuccess: () => setSubscriptionToDelete(null),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo URL hoặc loại sự kiện..."
              className="h-8 pl-8 pr-8 text-xs bg-card/40"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 bg-card/40 text-xs">
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs">
                  Tất cả trạng thái
                </SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">
                  Đang hoạt động
                </SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">
                  Tạm dừng
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {subscriptions && (
            <Badge variant="secondary" className="h-7 px-2 text-[11px] font-normal">
              {filteredSubscriptions.length} / {subscriptions.length} endpoint
            </Badge>
          )}
        </div>

        {canManage && (
          <Button onClick={handleCreateNew} size="sm" className="h-8 gap-1.5 text-xs shrink-0">
            <Plus className="size-3.5" />
            Thêm Webhook
          </Button>
        )}
      </div>

      {/* Subscriptions Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/40">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-64" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        /* Empty State */
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/30">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Webhook className="size-6 text-primary/80" />
          </div>
          {searchQuery || statusFilter !== 'ALL' ? (
            <>
              <h3 className="text-sm font-semibold text-foreground">Không tìm thấy webhook nào</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Không có đăng ký webhook nào khớp với bộ lọc tìm kiếm.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
                className="mt-4 h-8 text-xs"
              >
                Xóa bộ lọc
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">Chưa có webhook nào</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Webhook gửi dữ liệu cho phép máy chủ ngoài, CRM hoặc hệ thống phân tích nhận thông
                báo HTTP POST tức thời khi có sự kiện hội thoại và tin nhắn.
              </p>
              {canManage && (
                <Button onClick={handleCreateNew} size="sm" className="mt-4 h-8 gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Thêm Webhook đầu tiên
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        /* List of Webhook Cards */
        <div className="grid grid-cols-1 gap-3.5">
          {filteredSubscriptions.map(sub => {
            const hasSecret = Boolean(sub.secretKey);
            const events = sub.subscriptions || [];

            return (
              <Card
                key={sub.id}
                className={`overflow-hidden border transition-all hover:border-border ${
                  sub.isActive
                    ? 'border-border/80 bg-card/60'
                    : 'border-border/40 bg-card/20 opacity-75'
                }`}
              >
                <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                  {/* Left: URL & Event Badges */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/40 px-2.5 py-1 font-mono text-xs text-foreground max-w-md truncate">
                        <span className="truncate">{sub.url}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopyUrl(sub.id, sub.url)}
                          className="size-5 shrink-0 text-muted-foreground hover:text-foreground"
                          title="Sao chép URL"
                        >
                          {copiedId === sub.id ? (
                            <Check className="size-3 text-emerald-400" />
                          ) : (
                            <Copy className="size-3" />
                          )}
                        </Button>
                      </div>

                      {hasSecret ? (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] py-0.5"
                        >
                          <ShieldCheck className="size-3 mr-1" />
                          Bảo mật HMAC
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-muted-foreground py-0.5"
                        >
                          Không có khóa bí mật
                        </Badge>
                      )}

                      {!sub.isActive && (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground text-[10px] py-0.5"
                        >
                          Tạm dừng
                        </Badge>
                      )}
                    </div>

                    {/* Subscribed Events Chips */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Đã đăng ký:
                      </span>
                      {events.slice(0, 4).map((evt, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="border-primary/30 bg-primary/5 font-mono text-[10px] text-primary py-0"
                        >
                          {evt}
                        </Badge>
                      ))}
                      {events.length > 4 && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] text-muted-foreground py-0"
                        >
                          +{events.length - 4} sự kiện khác
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions & Log Viewer Button */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-start">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingLogsSubscription(sub)}
                      className="h-8 gap-1.5 text-xs border-border/80 hover:bg-card"
                    >
                      <Activity className="size-3.5 text-primary" />
                      Xem nhật ký
                    </Button>

                    {canManage && (
                      <>
                        <div className="flex items-center gap-1.5 pl-1">
                          <span className="text-[11px] text-muted-foreground">
                            {sub.isActive ? 'Bật' : 'Tắt'}
                          </span>
                          <Switch
                            checked={sub.isActive}
                            onCheckedChange={checked =>
                              toggleActive({ subscriptionId: sub.id, isActive: checked })
                            }
                            aria-label={`Bật/tắt ${sub.url}`}
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem
                              onClick={() => handleEdit(sub)}
                              className="cursor-pointer gap-2 text-xs"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              Chỉnh sửa Webhook
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setSubscriptionToDelete(sub)}
                              className="cursor-pointer gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Xóa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Webhook Form Dialog (Create / Edit) */}
      {formDialogOpen && (
        <WebhookFormDialog
          open={formDialogOpen}
          onOpenChange={open => {
            setFormDialogOpen(open);
            if (!open) setSubscriptionToEdit(null);
          }}
          workspaceId={workspaceId}
          subscriptionToEdit={subscriptionToEdit}
        />
      )}

      {/* Delivery Logs Sheet Panel */}
      {viewingLogsSubscription && (
        <WebhookDeliveryLogsSheet
          open={!!viewingLogsSubscription}
          onOpenChange={open => !open && setViewingLogsSubscription(null)}
          workspaceId={workspaceId}
          subscription={viewingLogsSubscription}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={!!subscriptionToDelete}
        onOpenChange={open => !open && setSubscriptionToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Xóa đăng ký Webhook</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa đăng ký webhook cho{' '}
              <strong className="font-mono text-foreground">{subscriptionToDelete?.url}</strong>?
              Endpoint của bạn sẽ không còn nhận được các thông báo sự kiện theo thời gian thực.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              {isDeleting && <Spinner className="size-3.5" data-icon="inline-start" />}
              Xóa Webhook
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
