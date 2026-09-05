'use client';

import * as React from 'react';
import Image from 'next/image';
import { Check, Search, X, Users, Zap } from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
import type { ChannelConfigState } from './step-channel-config';
import { getChannelMeta } from '@/lib/channels';

interface StepMembersReviewProps {
  workspaceId: string;
  channelType: ChannelType;
  config: ChannelConfigState;
  selectedMemberIds: string[];
  onToggleMember: (userId: string) => void;
}

export function StepMembersReview({
  workspaceId,
  channelType,
  config,
  selectedMemberIds,
  onToggleMember,
}: StepMembersReviewProps) {
  const [searchMemberQuery, setSearchMemberQuery] = React.useState('');
  const { data: workspaceMembers, isLoading: isLoadingMembers } = useWorkspaceMembers(workspaceId);

  const meta = getChannelMeta(channelType);

  const filteredMembers = React.useMemo(() => {
    if (!workspaceMembers) return [];
    if (!searchMemberQuery.trim()) return workspaceMembers;

    const query = searchMemberQuery.trim().toLowerCase();
    return workspaceMembers.filter(m => {
      const name = m.user?.name?.toLowerCase() || '';
      const email = m.user?.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    });
  }, [workspaceMembers, searchMemberQuery]);

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
    <div className="flex flex-col gap-4 py-1">
      {/* Configuration Summary Card */}
      <Card className="border-border bg-muted/20">
        <CardContent className="p-3.5 flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Configuration Summary
          </span>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="flex items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-card p-1 shadow-2xs">
                <Image
                  src={meta.iconSrc}
                  alt={meta.label}
                  width={20}
                  height={20}
                  unoptimized
                  className="size-4 object-contain"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] text-muted-foreground">Channel</span>
                <span className="truncate text-xs font-semibold text-foreground">{meta.label}</span>
              </div>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-muted-foreground">Inbox Name</span>
              <span className="truncate text-xs font-semibold text-foreground">
                {config.name || 'Unnamed Inbox'}
              </span>
            </div>

            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-muted-foreground">Auto-Assignment</span>
              <div className="flex items-center gap-1 mt-0.5">
                {config.isAutoAssignmentEnabled ? (
                  <Badge
                    variant="outline"
                    className="h-4 gap-1 px-1 text-[9px] text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
                  >
                    <Zap className="size-2.5" />
                    Enabled
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="h-4 px-1 text-[9px] text-muted-foreground">
                    Disabled
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Assign Members Section */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              Assign Agents to this Inbox
            </span>
          </div>
          <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px]">
            {selectedMemberIds.length} agents selected
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Assigned agents will receive and respond to conversations in this inbox.
        </p>

        {/* Search Members Bar */}
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchMemberQuery}
            onChange={e => setSearchMemberQuery(e.target.value)}
            placeholder="Search agents by name or email..."
            className="h-7 pl-7 pr-7 text-xs bg-muted/30"
          />
          {searchMemberQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSearchMemberQuery('')}
              className="absolute right-1 top-1/2 size-5 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-2.5" />
            </Button>
          )}
        </div>

        {/* Scrollable Members List */}
        <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
          <ScrollArea className="h-44 p-1">
            {isLoadingMembers ? (
              <div className="flex flex-col gap-2 p-2">
                <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex h-32 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                No workspace members found.
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {filteredMembers.map(member => {
                  const isSelected = selectedMemberIds.includes(member.userId);
                  return (
                    <button
                      type="button"
                      key={member.id}
                      onClick={() => onToggleMember(member.userId)}
                      className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-foreground'
                          : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-6 border border-border/60">
                          <AvatarImage
                            src={member.user?.avatarUrl || undefined}
                            alt={member.user?.name || 'User'}
                          />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(member.user?.name, member.user?.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-xs font-medium text-foreground">
                            {member.user?.name || 'Unnamed'}
                          </span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {member.user?.email}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant="outline" className="px-1 text-[9px] uppercase">
                          {member.role}
                        </Badge>
                        <div
                          className={`flex size-4 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40 bg-background'
                          }`}
                        >
                          {isSelected && <Check className="size-3" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
