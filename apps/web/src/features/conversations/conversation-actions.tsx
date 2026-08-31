'use client';

import * as React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PresenceIndicator } from '@/components/ui/presence-indicator';
import { ConversationStatus, Priority, type ConversationResponseDto } from '@/lib/api/types';
import {
  useAssignConversation,
  useUpdateConversationPriority,
  useUpdateConversationStatus,
} from './hooks/use-conversation-mutations';
import { useWorkspaceMembers, useWorkspaceTeams } from './hooks/use-detail-metadata';

interface ConversationActionsProps {
  conversation: ConversationResponseDto;
  workspaceSlug?: string;
}

export function ConversationActions({ conversation, workspaceSlug }: ConversationActionsProps) {
  const updateStatus = useUpdateConversationStatus(conversation.id, { workspaceSlug });
  const updatePriority = useUpdateConversationPriority(conversation.id, { workspaceSlug });
  const assignConversation = useAssignConversation(conversation.id, { workspaceSlug });

  const { members, isLoading: isMembersLoading } = useWorkspaceMembers({ workspaceSlug });
  const { teams, isLoading: isTeamsLoading } = useWorkspaceTeams({ workspaceSlug });

  const handleStatusChange = (status: string) => {
    updateStatus.mutate({ status: status as ConversationStatus });
  };

  const handlePriorityChange = (priority: string) => {
    updatePriority.mutate({ priority: priority as Priority });
  };

  const handleAssigneeChange = (val: string) => {
    assignConversation.mutate({
      assigneeId: val === 'unassigned' ? null : val,
    });
  };

  const handleTeamChange = (val: string) => {
    assignConversation.mutate({
      teamId: val === 'none' ? null : val,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Conversation Attributes
      </h5>

      <div className="flex flex-col gap-2.5 text-xs">
        {/* Status Dropdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium shrink-0">Status</span>
          <Select
            value={conversation.status}
            onValueChange={handleStatusChange}
            disabled={updateStatus.isPending}
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value={ConversationStatus.OPEN}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Open
                  </span>
                </SelectItem>
                <SelectItem value={ConversationStatus.PENDING}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500" />
                    Pending
                  </span>
                </SelectItem>
                <SelectItem value={ConversationStatus.RESOLVED}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-slate-400" />
                    Resolved
                  </span>
                </SelectItem>
                <SelectItem value={ConversationStatus.SNOOZED}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-500" />
                    Snoozed
                  </span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Priority Dropdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium shrink-0">Priority</span>
          <Select
            value={conversation.priority || Priority.MEDIUM}
            onValueChange={handlePriorityChange}
            disabled={updatePriority.isPending}
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value={Priority.URGENT}>
                  <span className="flex items-center gap-2 text-rose-500 font-medium">
                    <span className="size-2 rounded-full bg-rose-500" />
                    Urgent
                  </span>
                </SelectItem>
                <SelectItem value={Priority.HIGH}>
                  <span className="flex items-center gap-2 text-orange-500 font-medium">
                    <span className="size-2 rounded-full bg-orange-500" />
                    High
                  </span>
                </SelectItem>
                <SelectItem value={Priority.MEDIUM}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-yellow-500" />
                    Medium
                  </span>
                </SelectItem>
                <SelectItem value={Priority.LOW}>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-slate-400" />
                    Low
                  </span>
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Assignee Dropdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium shrink-0">Assignee</span>
          <Select
            value={conversation.assigneeId || 'unassigned'}
            onValueChange={handleAssigneeChange}
            disabled={assignConversation.isPending || isMembersLoading}
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value="unassigned">
                  <span className="text-muted-foreground italic">Unassigned</span>
                </SelectItem>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.userId}>
                    <span className="flex items-center gap-2">
                      <PresenceIndicator
                        userId={member.userId}
                        workspaceSlug={workspaceSlug}
                        size="xs"
                        placement="inline"
                      />
                      <span className="truncate">
                        {member.user?.name || member.user?.email || member.userId.slice(0, 8)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Team Dropdown */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium shrink-0">Team</span>
          <Select
            value={conversation.teamId || 'none'}
            onValueChange={handleTeamChange}
            disabled={assignConversation.isPending || isTeamsLoading}
          >
            <SelectTrigger className="w-36 h-7 text-xs">
              <SelectValue placeholder="No team" />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectGroup>
                <SelectItem value="none">
                  <span className="text-muted-foreground italic">No team</span>
                </SelectItem>
                {teams.map(team => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
