'use client';

import * as React from 'react';
import Image from 'next/image';
import { Plus, Search, Pencil, Trash2, AlertTriangle, X, Users } from 'lucide-react';
import { type InboxDto, ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { InboxAvatar } from '@/components/inbox-avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
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
import { useRouter } from 'next/navigation';
import { useDeleteInbox, useInboxes } from '../hooks/use-inboxes';
import { InboxEditDialog } from './inbox-edit-dialog';

interface InboxesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
  workspaceSlug?: string;
}

export function InboxesList({ workspaceId, currentUserRole, workspaceSlug }: InboxesListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [channelFilter, setChannelFilter] = React.useState<string>('ALL');
  const [inboxToEdit, setInboxToEdit] = React.useState<InboxDto | null>(null);
  const [inboxToDelete, setInboxToDelete] = React.useState<InboxDto | null>(null);

  const handleAddInbox = () => {
    if (workspaceSlug) {
      router.push(`/${workspaceSlug}/settings/inboxes/new`);
    }
  };

  const { data: inboxes } = useInboxes(workspaceId);
  const { mutate: deleteInbox, isPending: isDeleting } = useDeleteInbox(workspaceId);

  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredInboxes = React.useMemo(() => {
    if (!inboxes) return [];

    return inboxes.filter(inbox => {
      const name = inbox.name.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || name.includes(q);
      const matchesChannel = channelFilter === 'ALL' || inbox.channelType === channelFilter;

      return matchesSearch && matchesChannel;
    });
  }, [inboxes, searchQuery, channelFilter]);

  const handleConfirmDelete = () => {
    if (!inboxToDelete) return;
    deleteInbox(inboxToDelete.id, {
      onSuccess: () => setInboxToDelete(null),
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
              placeholder={'Tìm kiếm hộp thư...'}
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

          {/* Channel Type Filter */}
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="h-8 w-36 text-xs bg-card/40">
              <SelectValue placeholder={'Tất cả kênh'} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL" className="text-xs">
                {'Tất cả kênh'}
              </SelectItem>
              <SelectItem value={ChannelType.WEB_CHAT} className="text-xs">
                {'Web Chat'}
              </SelectItem>
              <SelectItem value={ChannelType.FACEBOOK_MESSENGER} className="text-xs">
                {'Messenger'}
              </SelectItem>
              <SelectItem value={ChannelType.TELEGRAM} className="text-xs">
                {'Telegram'}
              </SelectItem>
              <SelectItem value={ChannelType.EMAIL} className="text-xs">
                {'Email'}
              </SelectItem>
              <SelectItem value={ChannelType.ZALO} className="text-xs">
                {'Zalo OA'}
              </SelectItem>
            </SelectContent>
          </Select>

          {inboxes && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {`${filteredInboxes.length} hộp thư`}
            </Badge>
          )}
        </div>

        {canManage && (
          <Button size="sm" onClick={handleAddInbox} className="h-8 gap-1.5 text-xs font-medium">
            <Plus className="size-3.5" data-icon="inline-start" />
            {'Thêm hộp thư'}
          </Button>
        )}
      </div>

      {/* Inboxes Cards Grid */}
      {filteredInboxes.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20">
          <div className="mb-3 flex items-center justify-center">
            <Image
              src={
                searchQuery || channelFilter !== 'ALL' ? '/empty-search.svg' : '/empty-inboxes.svg'
              }
              alt="Empty Inboxes"
              width={160}
              height={120}
              style={{ width: 'auto', height: 'auto' }}
              className="max-h-36 w-auto object-contain"
            />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery || channelFilter !== 'ALL'
              ? 'Không tìm thấy hộp thư phù hợp'
              : 'Chưa có hộp thư nào'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery || channelFilter !== 'ALL'
              ? 'Thử thay đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc kênh.'
              : 'Kết nối các kênh giao tiếp (Web Chat, Messenger, Telegram, v.v.) để tiếp nhận và phản hồi khách hàng.'}
          </p>
          {canManage && !searchQuery && channelFilter === 'ALL' && (
            <Button
              size="sm"
              onClick={handleAddInbox}
              className="mt-4 h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              {'Tạo hộp thư đầu tiên'}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInboxes.map(inbox => {
            const memberCount = inbox.memberCount ?? 0;
            const isConnected = inbox.channel?.isConnected ?? true;
            const meta = getChannelMeta(inbox.channelType);

            const handleCardClick = () => {
              if (workspaceSlug) {
                router.push(`/${workspaceSlug}/settings/inboxes/${inbox.id}`);
              }
            };

            return (
              <Card
                key={inbox.id}
                onClick={handleCardClick}
                className="group relative flex flex-col justify-between overflow-hidden border border-border/70 hover:border-border hover:shadow-sm transition-all duration-150 cursor-pointer bg-card"
              >
                <CardHeader className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <InboxAvatar
                        channelType={inbox.channelType}
                        avatarUrl={inbox.avatarUrl}
                        name={inbox.name}
                        size="md"
                        showChannelBadge={false}
                        className="rounded-lg shrink-0 border border-border/50"
                      />
                      <div className="flex flex-col min-w-0">
                        <CardTitle className="truncate text-sm font-semibold group-hover:text-primary transition-colors">
                          {inbox.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Image
                            src={meta.iconSrc}
                            alt={meta.label}
                            width={12}
                            height={12}
                            className="size-3 object-contain shrink-0"
                            unoptimized
                          />
                          <span className="text-[11px] text-muted-foreground truncate">
                            {meta.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1"
                      onClick={e => e.stopPropagation()} // Prevent card navigation
                    >
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setInboxToEdit(inbox)}
                            className="text-muted-foreground hover:text-foreground"
                            title={'Cài đặt nhanh'}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setInboxToDelete(inbox)}
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title={'Xóa hộp thư'}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-4 py-2 flex flex-col gap-2">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{'Trạng thái kênh:'}</span>
                    {isConnected ? (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {'Đang hoạt động'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-500">
                        <span className="size-1.5 rounded-full bg-amber-500" />
                        {'Mất kết nối'}
                      </span>
                    )}
                  </div>

                  {/* Provider Account ID / Details */}
                  {inbox.channel?.providerAccountId && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[11px]">{'Định danh kênh:'}</span>
                      <span className="text-[11px] font-mono text-foreground truncate max-w-[140px]">
                        {inbox.channel.providerAccountId}
                      </span>
                    </div>
                  )}

                  {/* Auto assignment */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{'Tự động phân bổ:'}</span>
                    <span className="text-[11px] text-foreground">
                      {inbox.isAutoAssignmentEnabled ? 'Bật' : 'Tắt'}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-3 pb-3 px-4 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="size-3.5 text-muted-foreground/70" />
                    <span>{`${memberCount} nhân viên`}</span>
                  </div>

                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    ID: {inbox.id.slice(0, 8)}
                  </span>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Edit & Members Dialog */}
      <InboxEditDialog
        open={!!inboxToEdit}
        onOpenChange={open => {
          if (!open) setInboxToEdit(null);
        }}
        workspaceId={workspaceId}
        inboxToEdit={inboxToEdit}
      />

      {/* Delete Inbox AlertDialog */}
      <AlertDialog
        open={!!inboxToDelete}
        onOpenChange={open => {
          if (!open) setInboxToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">{'Xóa hộp thư?'}</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {`Bạn có chắc chắn muốn xóa "${inboxToDelete?.name || ''}"? Kênh kết nối và phân bổ nhân viên sẽ bị hủy liên kết, đồng thời các hội thoại mới từ kênh này sẽ ngừng tiếp nhận. Thao tác này không thể hoàn tác.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              {'Hủy'}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs font-medium"
            >
              {isDeleting ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  {'Đang xóa...'}
                </>
              ) : (
                'Xóa hộp thư'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
