'use client';

import * as React from 'react';
import Image from 'next/image';
import { Plus, Search, Pencil, Trash2, AlertTriangle, X, Users } from 'lucide-react';
import { type InboxDto, ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
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
import { useI18n } from '@/lib/i18n';

interface InboxesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
  workspaceSlug?: string;
}

export function InboxesList({ workspaceId, currentUserRole, workspaceSlug }: InboxesListProps) {
  const router = useRouter();
  const { t } = useI18n();
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
              placeholder={t('settings.inboxes.searchPlaceholder')}
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
              <SelectValue placeholder={t('settings.inboxes.allChannels')} />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL" className="text-xs">
                {t('settings.inboxes.allChannels')}
              </SelectItem>
              <SelectItem value={ChannelType.WEB_CHAT} className="text-xs">
                {t('settings.inboxes.channelWebChat')}
              </SelectItem>
              <SelectItem value={ChannelType.FACEBOOK_MESSENGER} className="text-xs">
                {t('settings.inboxes.channelMessenger')}
              </SelectItem>
              <SelectItem value={ChannelType.TELEGRAM} className="text-xs">
                {t('settings.inboxes.channelTelegram')}
              </SelectItem>
              <SelectItem value={ChannelType.EMAIL} className="text-xs">
                {t('settings.inboxes.channelEmail')}
              </SelectItem>
              <SelectItem value={ChannelType.ZALO} className="text-xs">
                {t('settings.inboxes.channelZalo')}
              </SelectItem>
            </SelectContent>
          </Select>

          {inboxes && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {t(
                filteredInboxes.length === 1
                  ? 'settings.inboxes.inboxCount_one'
                  : 'settings.inboxes.inboxCount_other',
                { count: filteredInboxes.length },
              )}
            </Badge>
          )}
        </div>

        {canManage && (
          <Button size="sm" onClick={handleAddInbox} className="h-8 gap-1.5 text-xs font-medium">
            <Plus className="size-3.5" data-icon="inline-start" />
            {t('settings.inboxes.addInbox')}
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
              ? t('settings.inboxes.emptyFilterTitle')
              : t('settings.inboxes.emptyTitle')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery || channelFilter !== 'ALL'
              ? t('settings.inboxes.emptyFilterDesc')
              : t('settings.inboxes.emptyDesc')}
          </p>
          {canManage && !searchQuery && channelFilter === 'ALL' && (
            <Button
              size="sm"
              onClick={handleAddInbox}
              className="mt-4 h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              {t('settings.inboxes.createFirstInbox')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInboxes.map(inbox => {
            const memberCount = inbox.memberCount ?? 0;
            const isConnected = inbox.channel?.isConnected ?? true;
            const meta = getChannelMeta(inbox.channelType);

            return (
              <Card
                key={inbox.id}
                className="group relative flex flex-col justify-between border-border bg-card/40 hover:bg-card/70 transition-all shadow-2xs hover:shadow-sm"
              >
                <CardHeader className="pb-3 pt-4 px-4">
                  <div className="flex items-start justify-between gap-3 min-w-0">
                    {/* Left: Channel Icon + Inbox Name & Meta */}
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 p-2 shadow-2xs">
                        <Image
                          src={meta.iconSrc}
                          alt={meta.label}
                          width={24}
                          height={24}
                          unoptimized
                          style={{ width: '24px', height: '24px' }}
                          className="size-6 object-contain"
                        />
                      </div>
                      <div className="flex flex-col min-w-0 flex-1 pt-0.5">
                        <CardTitle
                          className="truncate text-sm font-semibold text-foreground leading-tight"
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
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-500">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              {t('settings.inboxes.activeStatus')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                              {t('settings.inboxes.draftStatus')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons (Never pushed off-screen) */}
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0 -mr-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setInboxToEdit(inbox)}
                          className="size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                          title={t('settings.inboxes.editInboxSettings')}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">{t('settings.inboxes.editInbox')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setInboxToDelete(inbox)}
                          className="size-7 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title={t('settings.inboxes.deleteInbox')}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">{t('settings.inboxes.deleteInbox')}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 py-1 px-4">
                  <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                    {inbox.greetingMessage ||
                      (inbox.settings?.greetingMessage as string) ||
                      t('settings.inboxes.noGreeting')}
                  </p>
                </CardContent>

                <CardFooter className="pt-3 pb-3 px-4 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="size-3.5 text-muted-foreground/70" />
                    <span>
                      {t(
                        memberCount === 1
                          ? 'settings.inboxes.agentCount_one'
                          : 'settings.inboxes.agentCount_other',
                        { count: memberCount },
                      )}
                    </span>
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
            <AlertDialogTitle className="text-sm font-semibold">
              {t('settings.inboxes.deleteDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {t('settings.inboxes.deleteDialog.description', {
                name: inboxToDelete?.name || '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              {t('settings.inboxes.deleteDialog.cancel')}
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
                  {t('settings.inboxes.deleteDialog.deleting')}
                </>
              ) : (
                t('settings.inboxes.deleteDialog.confirm')
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
