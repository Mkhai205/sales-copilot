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
import { Skeleton } from '@/components/ui/skeleton';
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
import { useDeleteInbox, useInboxes } from './hooks/use-inboxes';
import { InboxWizardDialog } from './inbox-wizard/inbox-wizard-dialog';
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
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [inboxToEdit, setInboxToEdit] = React.useState<InboxDto | null>(null);
  const [inboxToDelete, setInboxToDelete] = React.useState<InboxDto | null>(null);

  const handleAddInbox = () => {
    if (workspaceSlug) {
      router.push(`/${workspaceSlug}/settings/inboxes/new`);
    } else {
      setWizardOpen(true);
    }
  };

  const { data: inboxes, isLoading } = useInboxes(workspaceId);
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
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, idx) => (
            <Card key={idx} className="border-border bg-card/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton className="size-8 rounded-lg" />
                  <div className="flex flex-col gap-1 flex-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-4">
                <Skeleton className="h-6 w-20 rounded-full" />
              </CardContent>
              <CardFooter className="pt-0">
                <Skeleton className="h-6 w-24 rounded-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : filteredInboxes.length === 0 ? (
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
              } else {
                setInboxToEdit(inbox);
              }
            };

            return (
              <Card
                key={inbox.id}
                onClick={handleCardClick}
                className="group relative flex flex-col justify-between border-border bg-card/40 hover:bg-card/70 transition-all shadow-2xs hover:shadow-sm cursor-pointer hover:border-primary/40"
              >
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    {/* Left: Channel Icon + Inbox Name & Meta */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <InboxAvatar
                        avatarUrl={inbox.avatarUrl}
                        channelType={inbox.channelType}
                        name={inbox.name}
                        size="md"
                      />
                      <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                        <CardTitle
                          className="truncate text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors"
                          title={inbox.name}
                        >
                          {inbox.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-medium border-border/70"
                          >
                            {meta.label}
                          </Badge>
                          {isConnected ? (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px] font-medium border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
                            >
                              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              {'Hoạt động'}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="px-1.5 py-0 text-[10px] font-medium border-border text-muted-foreground gap-1"
                            >
                              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                              {'Bản nháp'}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons */}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0 -mr-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={e => {
                            e.stopPropagation();
                            handleCardClick();
                          }}
                          className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                          title={'Chỉnh sửa cài đặt hộp thư'}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">{'Chỉnh sửa hộp thư'}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={e => {
                            e.stopPropagation();
                            setInboxToDelete(inbox);
                          }}
                          className="size-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title={'Xóa hộp thư'}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">{'Xóa hộp thư'}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 py-1 px-4">
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                    {inbox.greetingMessage ||
                      (inbox.settings?.greetingMessage as string) ||
                      'Chưa cấu hình lời chào.'}
                  </p>
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

      {/* Creation Wizard Dialog */}
      <InboxWizardDialog open={wizardOpen} onOpenChange={setWizardOpen} workspaceId={workspaceId} />

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
