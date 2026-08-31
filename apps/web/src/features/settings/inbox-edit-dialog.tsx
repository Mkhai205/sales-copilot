'use client';

import * as React from 'react';
import { Inbox, UserPlus, Trash2, Lock, Users, Settings, AlertCircle } from 'lucide-react';
import { type InboxDto, ChannelType } from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAddInboxMember,
  useInboxMembers,
  useRemoveInboxMember,
  useUpdateInbox,
} from './hooks/use-inboxes';
import { useWorkspaceMembers } from './hooks/use-workspace-members';

interface InboxEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  inboxToEdit: InboxDto | null;
}

export function InboxEditDialog({
  open,
  onOpenChange,
  workspaceId,
  inboxToEdit,
}: InboxEditDialogProps) {
  const [name, setName] = React.useState('');
  const [greetingMessage, setGreetingMessage] = React.useState('');
  const [isAutoAssignmentEnabled, setIsAutoAssignmentEnabled] = React.useState(false);
  const [credentials, setCredentials] = React.useState<Record<string, string>>({});
  const [selectedAddUserId, setSelectedAddUserId] = React.useState<string>('');
  const [touched, setTouched] = React.useState(false);

  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const { data: inboxMembers, isLoading: isLoadingMembers } = useInboxMembers(
    workspaceId,
    inboxToEdit?.id,
  );
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceId);
  const { mutate: addMember, isPending: isAddingMember } = useAddInboxMember(
    workspaceId,
    inboxToEdit?.id,
  );
  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveInboxMember(
    workspaceId,
    inboxToEdit?.id,
  );

  // Initialize values when opened
  React.useEffect(() => {
    if (open && inboxToEdit) {
      setName(inboxToEdit.name);
      setGreetingMessage(
        ((inboxToEdit.greetingMessage || inboxToEdit.settings?.greetingMessage) as string) || '',
      );
      setIsAutoAssignmentEnabled(inboxToEdit.isAutoAssignmentEnabled ?? false);
      setCredentials({});
      setSelectedAddUserId('');
      setTouched(false);
    }
  }, [open, inboxToEdit]);

  const channelType = inboxToEdit?.channelType || ChannelType.WEB_CHAT;

  // Available workspace members not yet in this inbox
  const availableMembers = React.useMemo(() => {
    if (!workspaceMembers || !inboxMembers) return [];
    const currentMemberUserIds = new Set(inboxMembers.map(m => m.userId));
    return workspaceMembers.filter(m => !currentMemberUserIds.has(m.userId));
  }, [workspaceMembers, inboxMembers]);

  const nameError = touched && !name.trim() ? 'Inbox name is required' : null;

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !inboxToEdit || isUpdating) return;

    // Filter out empty credentials so we only send updated values
    const cleanCredentials: Record<string, string> = {};
    for (const [k, v] of Object.entries(credentials)) {
      if (v && v.trim()) {
        cleanCredentials[k] = v.trim();
      }
    }

    updateInbox(
      {
        inboxId: inboxToEdit.id,
        dto: {
          name: name.trim(),
          greetingMessage: greetingMessage.trim() || undefined,
          isAutoAssignmentEnabled,
          channelCredentials:
            Object.keys(cleanCredentials).length > 0 ? cleanCredentials : undefined,
        },
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  const handleAddMember = () => {
    if (!selectedAddUserId) return;
    addMember(selectedAddUserId, {
      onSuccess: () => setSelectedAddUserId(''),
    });
  };

  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.slice(0, 2).toUpperCase();
    }
    if (email) {
      return email.slice(0, 2).toUpperCase();
    }
    return 'U';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-primary" />
            <DialogTitle className="text-sm font-semibold">
              Edit Inbox: {inboxToEdit?.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Manage channel settings, secure credentials, and assigned agents.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="settings" className="flex-1 min-h-0 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="settings" className="text-xs gap-1.5">
              <Settings className="size-3.5" />
              General & Credentials
            </TabsTrigger>
            <TabsTrigger value="members" className="text-xs gap-1.5">
              <Users className="size-3.5" />
              Agents ({inboxMembers?.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="overflow-y-auto flex-1 pr-1">
            <form
              id="edit-inbox-form"
              onSubmit={handleSaveSettings}
              className="flex flex-col gap-4"
            >
              <FieldGroup className="gap-4">
                {/* Inbox Name */}
                <Field data-invalid={!!nameError}>
                  <FieldLabel htmlFor="edit-name">Inbox Name</FieldLabel>
                  <Input
                    id="edit-name"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    maxLength={100}
                    required
                    className="text-xs"
                  />
                  {nameError && <FieldError errors={[{ message: nameError }]} />}
                </Field>

                {/* Greeting Message */}
                <Field>
                  <FieldLabel htmlFor="edit-greeting">Greeting Message</FieldLabel>
                  <Textarea
                    id="edit-greeting"
                    value={greetingMessage}
                    onChange={e => setGreetingMessage(e.target.value)}
                    rows={2}
                    className="text-xs"
                  />
                </Field>

                {/* Auto Assignment Toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border/70 p-3 bg-muted/20">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-foreground">
                      Auto-assign Conversations
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Distribute new conversations round-robin to assigned agents.
                    </span>
                  </div>
                  <Switch
                    checked={isAutoAssignmentEnabled}
                    onCheckedChange={setIsAutoAssignmentEnabled}
                  />
                </div>

                {/* Channel Credentials (Masked) */}
                <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-3 bg-card/40">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Lock className="size-3.5 text-amber-500" />
                    Channel Credentials (Encrypted)
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <AlertCircle className="size-3 text-muted-foreground" />
                    Leave credential fields empty to keep existing encrypted tokens.
                  </div>

                  {channelType === ChannelType.TELEGRAM && (
                    <Field>
                      <FieldLabel htmlFor="edit-tg-token">Bot Token</FieldLabel>
                      <Input
                        id="edit-tg-token"
                        type="password"
                        value={credentials.botToken || ''}
                        onChange={e =>
                          setCredentials(prev => ({
                            ...prev,
                            botToken: e.target.value,
                          }))
                        }
                        placeholder="••••••••••••••••••••••••••••"
                        className="text-xs font-mono"
                      />
                    </Field>
                  )}

                  {channelType === ChannelType.FACEBOOK_MESSENGER && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="edit-fb-page">Page ID</FieldLabel>
                        <Input
                          id="edit-fb-page"
                          value={credentials.pageId || ''}
                          onChange={e =>
                            setCredentials(prev => ({
                              ...prev,
                              pageId: e.target.value,
                            }))
                          }
                          placeholder={inboxToEdit?.channel?.providerAccountId || '••••••••'}
                          className="text-xs font-mono"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="edit-fb-token">Page Access Token</FieldLabel>
                        <Input
                          id="edit-fb-token"
                          type="password"
                          value={credentials.pageAccessToken || ''}
                          onChange={e =>
                            setCredentials(prev => ({
                              ...prev,
                              pageAccessToken: e.target.value,
                            }))
                          }
                          placeholder="••••••••••••••••••••••••••••"
                          className="text-xs font-mono"
                        />
                      </Field>
                    </>
                  )}

                  {channelType === ChannelType.ZALO && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="edit-zalo-oa">Zalo OA ID</FieldLabel>
                        <Input
                          id="edit-zalo-oa"
                          value={credentials.oaId || ''}
                          onChange={e =>
                            setCredentials(prev => ({
                              ...prev,
                              oaId: e.target.value,
                            }))
                          }
                          placeholder={inboxToEdit?.channel?.providerAccountId || '••••••••'}
                          className="text-xs font-mono"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="edit-zalo-token">Access Token</FieldLabel>
                        <Input
                          id="edit-zalo-token"
                          type="password"
                          value={credentials.accessToken || ''}
                          onChange={e =>
                            setCredentials(prev => ({
                              ...prev,
                              accessToken: e.target.value,
                            }))
                          }
                          placeholder="••••••••••••••••••••••••••••"
                          className="text-xs font-mono"
                        />
                      </Field>
                    </>
                  )}
                </div>
              </FieldGroup>
            </form>
          </TabsContent>

          {/* Members Tab */}
          <TabsContent value="members" className="overflow-y-auto flex-1 pr-1 flex flex-col gap-4">
            {/* Add Member Row */}
            <div className="flex items-center gap-2">
              <Select value={selectedAddUserId} onValueChange={setSelectedAddUserId}>
                <SelectTrigger className="flex-1 h-8 text-xs">
                  <SelectValue placeholder="Select workspace agent to add..." />
                </SelectTrigger>
                <SelectContent position="popper">
                  {availableMembers.map(m => (
                    <SelectItem key={m.userId} value={m.userId} className="text-xs">
                      {m.user?.name || m.user?.email} ({m.role})
                    </SelectItem>
                  ))}
                  {availableMembers.length === 0 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      All workspace members already assigned.
                    </div>
                  )}
                </SelectContent>
              </Select>

              <Button
                type="button"
                size="sm"
                onClick={handleAddMember}
                disabled={!selectedAddUserId || isAddingMember}
                className="h-8 gap-1 text-xs"
              >
                {isAddingMember ? (
                  <Spinner className="size-3" />
                ) : (
                  <UserPlus className="size-3.5" data-icon="inline-start" />
                )}
                Add
              </Button>
            </div>

            {/* Members List */}
            <div className="rounded-lg border border-border bg-card/40 overflow-hidden flex-1 min-h-[160px]">
              <ScrollArea className="h-56 p-1">
                {isLoadingMembers ? (
                  <div className="flex flex-col gap-2 p-2">
                    <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                    <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                  </div>
                ) : !inboxMembers || inboxMembers.length === 0 ? (
                  <div className="flex h-36 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                    No agents assigned to this inbox yet.
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {inboxMembers.map(m => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-muted/40 transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-7 border border-border/60">
                            <AvatarImage
                              src={m.user?.avatarUrl || undefined}
                              alt={m.user?.name || 'Agent'}
                            />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.user?.name, m.user?.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate text-xs font-medium text-foreground">
                              {m.user?.name || 'Agent'}
                            </span>
                            <span className="truncate text-[10px] text-muted-foreground">
                              {m.user?.email}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="px-1 text-[9px] uppercase">
                            {m.user?.role || 'AGENT'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeMember(m.userId)}
                            disabled={isRemovingMember}
                            className="size-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title="Remove agent from inbox"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="edit-inbox-form"
            variant="default"
            size="sm"
            disabled={isUpdating || !name.trim()}
            className="text-xs font-medium"
          >
            {isUpdating ? (
              <>
                <Spinner className="size-3.5" data-icon="inline-start" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
