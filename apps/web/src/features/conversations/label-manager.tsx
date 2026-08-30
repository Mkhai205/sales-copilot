'use client';

import * as React from 'react';
import { Plus, X, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ConversationResponseDto } from '@/lib/api/types';
import {
  useAssignConversationLabels,
  useRemoveConversationLabel,
} from './hooks/use-conversation-mutations';
import { useWorkspaceLabels } from './hooks/use-detail-metadata';

interface LabelManagerProps {
  conversation: ConversationResponseDto;
  workspaceSlug?: string;
}

export function LabelManager({ conversation, workspaceSlug }: LabelManagerProps) {
  const assignLabels = useAssignConversationLabels(conversation.id, { workspaceSlug });
  const removeLabel = useRemoveConversationLabel(conversation.id, { workspaceSlug });
  const { labels: allLabels, isLoading: isLabelsLoading } = useWorkspaceLabels({ workspaceSlug });

  const assignedLabels = conversation.labels || [];
  const assignedLabelIds = new Set(assignedLabels.map(l => l.id));
  const availableLabels = allLabels.filter(l => !assignedLabelIds.has(l.id));

  const handleAddLabel = (labelId: string) => {
    assignLabels.mutate({ labelIds: [labelId] });
  };

  const handleRemoveLabel = (labelId: string) => {
    removeLabel.mutate(labelId);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Labels
        </h5>

        {/* Add Label Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="xs"
              className="h-5 gap-1 text-[10px] text-primary hover:text-primary/80 px-1.5"
              disabled={assignLabels.isPending || isLabelsLoading}
            >
              <Plus className="size-3" />
              Add
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 text-xs">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground font-medium">
              Assign Label
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {availableLabels.length === 0 ? (
                <div className="p-2 text-center text-muted-foreground italic text-[11px]">
                  {allLabels.length === 0 ? 'No labels in workspace' : 'All labels assigned'}
                </div>
              ) : (
                availableLabels.map(label => (
                  <DropdownMenuItem
                    key={label.id}
                    onClick={() => handleAddLabel(label.id)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color || '#3b82f6' }}
                    />
                    <span className="truncate">{label.title}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Label Chips */}
      {assignedLabels.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {assignedLabels.map(label => (
            <Badge
              key={label.id}
              variant="secondary"
              className="group flex items-center gap-1.5 text-[11px] py-0.5 px-2 font-normal border border-border/50"
            >
              <span
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: label.color || '#3b82f6' }}
              />
              <span className="truncate max-w-[120px]">{label.title}</span>
              <button
                type="button"
                onClick={() => handleRemoveLabel(label.id)}
                disabled={removeLabel.isPending}
                className="text-muted-foreground hover:text-foreground ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="size-3" />
                <span className="sr-only">Remove label {label.title}</span>
              </button>
            </Badge>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/70 py-1">
          <Tag className="size-3.5 text-muted-foreground/40 shrink-0" />
          <span className="italic">No labels attached</span>
        </div>
      )}
    </div>
  );
}
