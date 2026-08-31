'use client';

import * as React from 'react';
import { ArrowRight, Zap, Filter, Play } from 'lucide-react';
import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  type AutomationAction,
  type AutomationCondition,
} from '@sales-copilot/shared-contracts';
import {
  TRIGGER_OPTIONS,
  ATTRIBUTE_OPTIONS,
  OPERATOR_OPTIONS,
} from '../constants/automation-rule-options';
import { useInboxes } from '../hooks/use-inboxes';
import { useTeams } from '../hooks/use-teams';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';

interface RuleFlowPreviewProps {
  eventTrigger: AutomationEventTrigger;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  workspaceId: string;
}

export function RuleFlowPreview({
  eventTrigger,
  conditions,
  actions,
  workspaceId,
}: RuleFlowPreviewProps) {
  const { data: inboxes } = useInboxes(workspaceId);
  const { data: teams } = useTeams(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const triggerLabel = React.useMemo(() => {
    return TRIGGER_OPTIONS.find(t => t.value === eventTrigger)?.label || 'Event Occurs';
  }, [eventTrigger]);

  const formatConditionSummary = (cond: AutomationCondition): string => {
    const attr = ATTRIBUTE_OPTIONS.find(a => a.value === cond.attribute)?.label || cond.attribute;
    const op = OPERATOR_OPTIONS[cond.operator]?.label || cond.operator;

    if (cond.operator === 'IS_PRESENT' || cond.operator === 'IS_NOT_PRESENT') {
      return `${attr} ${op}`;
    }

    const rawVal = cond.values?.[0] || '';
    if (!rawVal) return `${attr} ${op} [?]`;

    if (cond.attribute === AutomationAttribute.INBOX_ID) {
      const inbox = inboxes?.find(i => i.id === rawVal);
      return `${attr} ${op} "${inbox?.name || rawVal}"`;
    }
    if (cond.attribute === AutomationAttribute.TEAM_ID) {
      const team = teams?.find(t => t.id === rawVal);
      return `${attr} ${op} "${team?.name || rawVal}"`;
    }
    if (cond.attribute === AutomationAttribute.ASSIGNEE_ID) {
      const member = members?.find(m => m.userId === rawVal);
      return `${attr} ${op} "${member?.user?.name || member?.user?.email || rawVal}"`;
    }

    return `${attr} ${op} "${rawVal}"`;
  };

  const formatActionSummary = (act: AutomationAction): string => {
    switch (act.type) {
      case AutomationActionType.ASSIGN_AGENT: {
        const member = members?.find(m => m.userId === act.params.agentId);
        return `Assign to ${member?.user?.name || member?.user?.email || 'Agent'}`;
      }
      case AutomationActionType.ASSIGN_TEAM: {
        const team = teams?.find(t => t.id === act.params.teamId);
        return `Assign to team ${team?.name || 'Team'}`;
      }
      case AutomationActionType.ADD_LABEL:
        return `Add label "${act.params.labelTitle || '...'}"`;
      case AutomationActionType.REMOVE_LABEL:
        return `Remove label "${act.params.labelTitle || '...'}"`;
      case AutomationActionType.CHANGE_STATUS:
        return `Set status to ${act.params.status}`;
      case AutomationActionType.CHANGE_PRIORITY:
        return `Set priority to ${act.params.priority}`;
      case AutomationActionType.SEND_WEBHOOK:
        return `Send webhook to ${act.params.url || '[url]'}`;
      default:
        return 'Execute Action';
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-r from-card/90 via-card/60 to-card/90 p-3.5 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Live Logic Flow Preview
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary" />
          Reactive Flow
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {/* WHEN Node */}
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 font-medium text-indigo-300">
          <Zap className="size-3 text-indigo-400" />
          <span className="font-semibold text-indigo-400">WHEN</span>
          <span>{triggerLabel}</span>
        </div>

        <ArrowRight className="size-3 text-muted-foreground/60" />

        {/* IF Node */}
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 font-medium text-sky-300">
          <Filter className="size-3 text-sky-400" />
          <span className="font-semibold text-sky-400">IF</span>
          {conditions.length === 0 ? (
            <span className="italic text-sky-300/80">Always matches (No conditions)</span>
          ) : (
            <span className="truncate max-w-[280px]">
              {conditions.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="font-semibold text-sky-400"> AND </span>}
                  <span>{formatConditionSummary(c)}</span>
                </React.Fragment>
              ))}
            </span>
          )}
        </div>

        <ArrowRight className="size-3 text-muted-foreground/60" />

        {/* THEN Node */}
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300">
          <Play className="size-3 text-emerald-400" />
          <span className="font-semibold text-emerald-400">THEN</span>
          {actions.length === 0 ? (
            <span className="italic text-destructive">No action defined</span>
          ) : (
            <span className="truncate max-w-[300px]">
              {actions.map((a, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="font-semibold text-emerald-400">, </span>}
                  <span>{formatActionSummary(a)}</span>
                </React.Fragment>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
