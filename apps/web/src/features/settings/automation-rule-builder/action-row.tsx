'use client';

import * as React from 'react';
import {
  Trash2,
  UserCheck,
  Users,
  Tag,
  MinusCircle,
  CheckCircle2,
  Flag,
  Webhook,
} from 'lucide-react';
import {
  AutomationActionType,
  ConversationPriority,
  ConversationStatus,
  type AutomationAction,
} from '@sales-copilot/shared-contracts';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ACTION_TYPE_OPTIONS,
  STATUS_SELECT_OPTIONS,
  PRIORITY_SELECT_OPTIONS,
} from '../constants/automation-rule-options';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';
import { useTeams } from '../hooks/use-teams';
import { useLabels } from '../hooks/use-labels';

interface ActionRowProps {
  index: number;
  action: AutomationAction;
  workspaceId: string;
  isOnlyAction: boolean;
  onChange: (updated: AutomationAction) => void;
  onRemove: () => void;
}

export function ActionRow({
  index,
  action,
  workspaceId,
  isOnlyAction,
  onChange,
  onRemove,
}: ActionRowProps) {
  const { data: members } = useWorkspaceMembers(workspaceId);
  const { data: teams } = useTeams(workspaceId);
  const { data: labels } = useLabels(workspaceId);

  const getActionIcon = (type: AutomationActionType) => {
    switch (type) {
      case AutomationActionType.ASSIGN_AGENT:
        return <UserCheck className="size-3.5 text-blue-400" />;
      case AutomationActionType.ASSIGN_TEAM:
        return <Users className="size-3.5 text-indigo-400" />;
      case AutomationActionType.ADD_LABEL:
        return <Tag className="size-3.5 text-emerald-400" />;
      case AutomationActionType.REMOVE_LABEL:
        return <MinusCircle className="size-3.5 text-rose-400" />;
      case AutomationActionType.CHANGE_STATUS:
        return <CheckCircle2 className="size-3.5 text-amber-400" />;
      case AutomationActionType.CHANGE_PRIORITY:
        return <Flag className="size-3.5 text-purple-400" />;
      case AutomationActionType.SEND_WEBHOOK:
        return <Webhook className="size-3.5 text-cyan-400" />;
      default:
        return null;
    }
  };

  const handleTypeChange = (newType: string) => {
    const typeEnum = newType as AutomationActionType;
    let defaultAction: AutomationAction;

    switch (typeEnum) {
      case AutomationActionType.ASSIGN_AGENT:
        defaultAction = {
          type: AutomationActionType.ASSIGN_AGENT,
          params: { agentId: members?.[0]?.userId || '' },
        };
        break;
      case AutomationActionType.ASSIGN_TEAM:
        defaultAction = {
          type: AutomationActionType.ASSIGN_TEAM,
          params: { teamId: teams?.[0]?.id || '' },
        };
        break;
      case AutomationActionType.ADD_LABEL:
        defaultAction = {
          type: AutomationActionType.ADD_LABEL,
          params: { labelTitle: labels?.[0]?.title || '' },
        };
        break;
      case AutomationActionType.REMOVE_LABEL:
        defaultAction = {
          type: AutomationActionType.REMOVE_LABEL,
          params: { labelTitle: labels?.[0]?.title || '' },
        };
        break;
      case AutomationActionType.CHANGE_STATUS:
        defaultAction = {
          type: AutomationActionType.CHANGE_STATUS,
          params: { status: ConversationStatus.OPEN },
        };
        break;
      case AutomationActionType.CHANGE_PRIORITY:
        defaultAction = {
          type: AutomationActionType.CHANGE_PRIORITY,
          params: { priority: ConversationPriority.MEDIUM },
        };
        break;
      case AutomationActionType.SEND_WEBHOOK:
        defaultAction = {
          type: AutomationActionType.SEND_WEBHOOK,
          params: { url: '' },
        };
        break;
      default:
        return;
    }

    onChange(defaultAction);
  };

  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3 transition-colors hover:border-border sm:flex-row sm:items-center">
      {/* Step Indicator */}
      <div className="flex shrink-0 items-center justify-between sm:w-14">
        <Badge
          variant="secondary"
          className="border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400"
        >
          DO
        </Badge>
        <span className="text-xs text-muted-foreground sm:hidden">Action #{index + 1}</span>
      </div>

      {/* Grid of Action Type & Parameter Input */}
      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
        {/* Action Type Selector */}
        <Select value={action.type} onValueChange={handleTypeChange}>
          <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
            <div className="flex items-center gap-2">
              {getActionIcon(action.type)}
              <SelectValue placeholder="Select action" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ACTION_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* Dynamic Parameter Input */}
        <div className="w-full">
          {action.type === AutomationActionType.ASSIGN_AGENT && (
            <Select
              value={action.params.agentId}
              onValueChange={agentId =>
                onChange({
                  type: AutomationActionType.ASSIGN_AGENT,
                  params: { agentId },
                })
              }
            >
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {members && members.length > 0 ? (
                    members.map(member => (
                      <SelectItem key={member.userId} value={member.userId} className="text-xs">
                        {member.user?.name || member.user?.email || member.userId}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled className="text-xs">
                      No members available
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {action.type === AutomationActionType.ASSIGN_TEAM && (
            <Select
              value={action.params.teamId}
              onValueChange={teamId =>
                onChange({
                  type: AutomationActionType.ASSIGN_TEAM,
                  params: { teamId },
                })
              }
            >
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose team" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {teams && teams.length > 0 ? (
                    teams.map(team => (
                      <SelectItem key={team.id} value={team.id} className="text-xs">
                        {team.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled className="text-xs">
                      No teams available
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {(action.type === AutomationActionType.ADD_LABEL ||
            action.type === AutomationActionType.REMOVE_LABEL) && (
            <div className="flex gap-1.5">
              <Input
                value={action.params.labelTitle}
                onChange={e =>
                  onChange({
                    type: action.type,
                    params: { labelTitle: e.target.value },
                  } as AutomationAction)
                }
                placeholder="Enter label title (e.g. VIP, Urgent)..."
                className="h-8 bg-background/50 text-xs"
              />
              {labels && labels.length > 0 && (
                <Select
                  value=""
                  onValueChange={title => {
                    if (title) {
                      onChange({
                        type: action.type,
                        params: { labelTitle: title },
                      } as AutomationAction);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 w-24 shrink-0 bg-background/50 text-xs text-muted-foreground">
                    <SelectValue placeholder="Pick..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {labels.map(l => (
                        <SelectItem key={l.id} value={l.title} className="text-xs">
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: l.color }}
                            />
                            {l.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {action.type === AutomationActionType.CHANGE_STATUS && (
            <Select
              value={action.params.status}
              onValueChange={status =>
                onChange({
                  type: AutomationActionType.CHANGE_STATUS,
                  params: { status: status as ConversationStatus },
                })
              }
            >
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose status" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {STATUS_SELECT_OPTIONS.map(st => (
                    <SelectItem key={st.value} value={st.value} className="text-xs">
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {action.type === AutomationActionType.CHANGE_PRIORITY && (
            <Select
              value={action.params.priority}
              onValueChange={priority =>
                onChange({
                  type: AutomationActionType.CHANGE_PRIORITY,
                  params: { priority: priority as ConversationPriority },
                })
              }
            >
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {PRIORITY_SELECT_OPTIONS.map(pr => (
                    <SelectItem key={pr.value} value={pr.value} className="text-xs">
                      {pr.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}

          {action.type === AutomationActionType.SEND_WEBHOOK && (
            <Input
              type="url"
              value={action.params.url}
              onChange={e =>
                onChange({
                  type: AutomationActionType.SEND_WEBHOOK,
                  params: { url: e.target.value },
                })
              }
              placeholder="https://api.domain.com/webhook"
              className="h-8 bg-background/50 text-xs"
            />
          )}
        </div>
      </div>

      {/* Delete Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={isOnlyAction}
        onClick={onRemove}
        className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
        title={isOnlyAction ? 'Rule must have at least one action' : 'Remove action'}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
