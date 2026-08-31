'use client';

import * as React from 'react';
import {
  Inbox,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Users,
  CheckCircle2,
  Globe,
  Send,
  Mail,
  MessageSquare,
  MessageCircle,
} from 'lucide-react';
import { type InboxDto, ChannelType, WorkspaceRole } from '@sales-copilot/shared-contracts';
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
import { useDeleteInbox, useInboxes } from './hooks/use-inboxes';
import { InboxWizardDialog } from './inbox-wizard/inbox-wizard-dialog';
import { InboxEditDialog } from './inbox-edit-dialog';

interface InboxesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function InboxesList({ workspaceId, currentUserRole }: InboxesListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [channelFilter, setChannelFilter] = React.useState<string>('ALL');
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [inboxToEdit, setInboxToEdit] = React.useState<InboxDto | null>(null);
  const [inboxToDelete, setInboxToDelete] = React.useState<InboxDto | null>(null);

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

  const getChannelIcon = (type: ChannelType) => {
    switch (type) {
      case ChannelType.WEB_CHAT:
        return <Globe className="size-4 text-blue-500" />;
      case ChannelType.FACEBOOK_MESSENGER:
        return <MessageSquare className="size-4 text-indigo-500" />;
      case ChannelType.TELEGRAM:
        return <Send className="size-4 text-sky-500" />;
      case ChannelType.EMAIL:
        return <Mail className="size-4 text-emerald-500" />;
      case ChannelType.ZALO:
        return <MessageCircle className="size-4 text-amber-500" />;
      default:
        return <Inbox className="size-4 text-primary" />;
    }
  };

  const getChannelBadgeLabel = (type: ChannelType) => {
    switch (type) {
      case ChannelType.WEB_CHAT:
        return 'Web Chat';
      case ChannelType.FACEBOOK_MESSENGER:
        return 'Messenger';
      case ChannelType.TELEGRAM:
        return 'Telegram';
      case ChannelType.EMAIL:
        return 'Email';
      case ChannelType.ZALO:
        return 'Zalo OA';
      default:
        return type;
    }
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
              placeholder="Search inboxes..."
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
              <SelectValue placeholder="All Channels" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="ALL" className="text-xs">
                All Channels
              </SelectItem>
              <SelectItem value={ChannelType.WEB_CHAT} className="text-xs">
                Web Chat
              </SelectItem>
              <SelectItem value={ChannelType.FACEBOOK_MESSENGER} className="text-xs">
                Messenger
              </SelectItem>
              <SelectItem value={ChannelType.TELEGRAM} className="text-xs">
                Telegram
              </SelectItem>
              <SelectItem value={ChannelType.EMAIL} className="text-xs">
                Email
              </SelectItem>
              <SelectItem value={ChannelType.ZALO} className="text-xs">
                Zalo OA
              </SelectItem>
            </SelectContent>
          </Select>

          {inboxes && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {filteredInboxes.length} {filteredInboxes.length === 1 ? 'inbox' : 'inboxes'}
            </Badge>
          )}
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setWizardOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            Add Inbox
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
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Inbox className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">
            {searchQuery || channelFilter !== 'ALL'
              ? 'No inboxes match your filter'
              : 'No inboxes created yet'}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {searchQuery || channelFilter !== 'ALL'
              ? 'Try changing your search terms or reset the channel filter.'
              : 'Connect communication channels (Web Chat, Messenger, Telegram, etc.) to receive and reply to customer inquiries.'}
          </p>
          {canManage && !searchQuery && channelFilter === 'ALL' && (
            <Button
              size="sm"
              onClick={() => setWizardOpen(true)}
              className="mt-4 h-8 gap-1.5 text-xs font-medium"
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Create First Inbox
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredInboxes.map(inbox => {
            const memberCount = inbox.memberCount ?? 0;
            const isConnected = inbox.channel?.isConnected ?? true;

            return (
              <Card
                key={inbox.id}
                className="group relative flex flex-col justify-between border-border bg-card/40 hover:bg-card/70 transition-all shadow-2xs hover:shadow-sm"
              >
                <CardHeader className="pb-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-muted/40 shadow-2xs">
                        {getChannelIcon(inbox.channelType)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <CardTitle className="truncate text-sm font-semibold text-foreground">
                          {inbox.name}
                        </CardTitle>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                            {getChannelBadgeLabel(inbox.channelType)}
                          </Badge>
                          {isConnected ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-500">
                              <CheckCircle2 className="size-2.5" />
                              Active
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">Draft</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setInboxToEdit(inbox)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit inbox"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setInboxToDelete(inbox)}
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Delete inbox"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1 py-1">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {inbox.greetingMessage ||
                      (inbox.settings?.greetingMessage as string) ||
                      'No greeting message configured.'}
                  </p>
                </CardContent>

                <CardFooter className="pt-3 pb-3 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="size-3" />
                    <span>
                      {memberCount} {memberCount === 1 ? 'agent' : 'agents'}
                    </span>
                  </div>

                  {canManage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInboxToEdit(inbox)}
                      className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Settings
                    </Button>
                  )}
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
            <AlertDialogTitle className="text-sm font-semibold">Delete Inbox?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-semibold">"{inboxToDelete?.name}"</strong>?
              Its connected channel and assigned agents will be unlinked, and incoming conversations
              through this channel will stop being ingested. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
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
                  Deleting...
                </>
              ) : (
                'Delete Inbox'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
