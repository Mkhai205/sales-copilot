'use client';

import * as React from 'react';
import Image from 'next/image';
import { Link2, Plus, Trash2, Loader2 } from 'lucide-react';
import { type ChannelIdentityDto } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWorkspaces } from '@/features/identity';
import { useInboxes } from '@/features/omnichannel';
import {
  useContactIdentities,
  useLinkContactIdentity,
  useUnlinkContactIdentity,
} from './hooks/use-contact-identities';

export interface ContactIdentitiesProps {
  contactId?: string | null;
  workspaceSlug?: string;
  initialIdentities?: ChannelIdentityDto[];
}

export function ContactIdentities({
  contactId,
  workspaceSlug,
  initialIdentities,
}: ContactIdentitiesProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug) || workspaces?.[0];
  const workspaceId = currentWorkspace?.id;

  const { identities: fetchedIdentities, isLoading: isIdentitiesLoading } = useContactIdentities(
    contactId,
    {
      workspaceSlug,
      workspaceId,
      enabled: Boolean(contactId),
    },
  );

  const { data: inboxes, isLoading: isInboxesLoading } = useInboxes(workspaceId);
  const linkIdentityMutation = useLinkContactIdentity(contactId || '', {
    workspaceSlug,
    workspaceId,
  });
  const unlinkIdentityMutation = useUnlinkContactIdentity(contactId || '', {
    workspaceSlug,
    workspaceId,
  });

  const identities: ChannelIdentityDto[] =
    (fetchedIdentities && fetchedIdentities.length > 0 ? fetchedIdentities : initialIdentities) ||
    [];

  // Dialog states
  const [isLinkDialogOpen, setIsLinkDialogOpen] = React.useState(false);
  const [identityToUnlink, setIdentityToUnlink] = React.useState<ChannelIdentityDto | null>(null);

  // Form state
  const [selectedChannelId, setSelectedChannelId] = React.useState<string>('');
  const [externalContactId, setExternalContactId] = React.useState<string>('');
  const [username, setUsername] = React.useState<string>('');

  const handleOpenLinkDialog = () => {
    setSelectedChannelId('');
    setExternalContactId('');
    setUsername('');
    setIsLinkDialogOpen(true);
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactId || !selectedChannelId || !externalContactId.trim()) return;

    await linkIdentityMutation.mutateAsync({
      channelId: selectedChannelId,
      externalContactId: externalContactId.trim(),
      username: username.trim() || undefined,
    });

    setIsLinkDialogOpen(false);
  };

  const handleConfirmUnlink = async () => {
    if (!contactId || !identityToUnlink) return;
    await unlinkIdentityMutation.mutateAsync(identityToUnlink.id);
    setIdentityToUnlink(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Kênh định danh kết nối ({identities.length})
        </h5>
        {contactId && (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleOpenLinkDialog}
            className="h-6 text-[11px] gap-1 px-2 cursor-pointer"
          >
            <Plus className="size-3" />
            <span>Liên kết kênh</span>
          </Button>
        )}
      </div>

      {isIdentitiesLoading ? (
        <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Đang tải danh tính...</span>
        </div>
      ) : identities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border/70 p-4 text-center">
          <Link2 className="size-6 text-muted-foreground/40 mb-1" />
          <p className="text-xs font-medium text-foreground">Chưa liên kết kênh chat nào</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
            Liên kết với Facebook PSID, Telegram Chat ID để tự động nhận diện khách hàng.
          </p>
          {contactId && (
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={handleOpenLinkDialog}
              className="mt-2.5 text-xs gap-1 cursor-pointer"
            >
              <Plus className="size-3" />
              <span>Liên kết kênh đầu tiên</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {identities.map(identity => {
            const meta = getChannelMeta(identity.channelType);
            const displayHandle = identity.username
              ? `@${identity.username}`
              : identity.externalContactId;

            return (
              <div
                key={identity.id || `${identity.channelId}-${identity.externalContactId}`}
                className="group flex items-center justify-between gap-2 p-2 rounded-md border border-border/60 bg-card/50 hover:bg-card/90 transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="size-8 rounded-lg flex items-center justify-center border border-border/60 bg-muted/40 p-1.5 shrink-0">
                    <Image
                      src={meta.iconSrc}
                      alt={meta.label}
                      width={20}
                      height={20}
                      unoptimized
                      style={{ width: '20px', height: '20px' }}
                      className="size-5 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground text-xs">{meta.label}</p>
                    <p
                      className="truncate text-[11px] text-muted-foreground"
                      title={identity.externalContactId}
                    >
                      {displayHandle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setIdentityToUnlink(identity)}
                    className="size-7 text-muted-foreground hover:text-destructive cursor-pointer"
                    title="Hủy liên kết kênh này"
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Hủy liên kết</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Link Identity Dialog */}
      <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleLinkSubmit}>
            <DialogHeader>
              <DialogTitle>Liên kết kênh hội thoại</DialogTitle>
              <DialogDescription>
                Gán định danh người dùng từ các nền tảng mạng xã hội vào hồ sơ khách hàng này.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="channel-select">Hộp thư / Kênh tiếp nhận *</Label>
                <Select
                  value={selectedChannelId}
                  onValueChange={setSelectedChannelId}
                  disabled={isInboxesLoading}
                >
                  <SelectTrigger id="channel-select" className="w-full">
                    <SelectValue placeholder="Chọn hộp thư kết nối" />
                  </SelectTrigger>
                  <SelectContent>
                    {(inboxes || [])
                      .filter(inbox => inbox.channel?.id)
                      .map(inbox => {
                        const meta = getChannelMeta(inbox.channelType);
                        return (
                          <SelectItem key={inbox.channel!.id} value={inbox.channel!.id}>
                            <div className="flex items-center gap-2">
                              <Image
                                src={meta.iconSrc}
                                alt={meta.label}
                                width={16}
                                height={16}
                                unoptimized
                                className="size-4 object-contain"
                              />
                              <span>{inbox.name}</span>
                              <span className="text-muted-foreground text-[10px]">
                                ({meta.label})
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="external-id">External User ID / PSID *</Label>
                <Input
                  id="external-id"
                  placeholder="Ví dụ: 549382103848123"
                  value={externalContactId}
                  onChange={e => setExternalContactId(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  ID định danh duy nhất của người dùng trên nền tảng (Facebook Page Scoped ID,
                  Telegram User ID...)
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="identity-username">Tên người dùng / Handle (Tùy chọn)</Label>
                <Input
                  id="identity-username"
                  placeholder="Ví dụ: nguyenvana hoặc @vana"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLinkDialogOpen(false)}
                disabled={linkIdentityMutation.isPending}
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={
                  !selectedChannelId || !externalContactId.trim() || linkIdentityMutation.isPending
                }
              >
                {linkIdentityMutation.isPending && (
                  <Loader2 className="mr-2 size-3.5 animate-spin" />
                )}
                Xác nhận liên kết
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Unlink Alert Dialog */}
      <AlertDialog
        open={Boolean(identityToUnlink)}
        onOpenChange={open => !open && setIdentityToUnlink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy liên kết kênh này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn hủy liên kết kênh{' '}
              <strong className="text-foreground">
                {identityToUnlink?.username || identityToUnlink?.externalContactId}
              </strong>{' '}
              khỏi khách hàng này? Các tin nhắn mới từ tài khoản này có thể tạo ra khách hàng mới
              nếu không có định danh trùng khớp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkIdentityMutation.isPending}>
              Bỏ qua
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUnlink}
              disabled={unlinkIdentityMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unlinkIdentityMutation.isPending && (
                <Loader2 className="mr-2 size-3.5 animate-spin" />
              )}
              Hủy liên kết
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
