'use client';

import * as React from 'react';
import {
  Zap,
  Plus,
  Search,
  Pencil,
  Trash2,
  AlertTriangle,
  X,
  Filter,
  Play,
  Copy,
  MoreVertical,
  ArrowRight,
} from 'lucide-react';
import {
  type AutomationRuleDto,
  AutomationEventTrigger,
  WorkspaceRole,
  AutomationActionType,
  AutomationAttribute,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  TRIGGER_OPTIONS,
  ATTRIBUTE_OPTIONS,
  OPERATOR_OPTIONS,
  ACTION_TYPE_OPTIONS,
} from './constants/automation-rule-options';
import {
  useAutomationRules,
  useDeleteAutomationRule,
  useToggleAutomationRuleActive,
} from './hooks/use-automation-rules';
import { useInboxes } from './hooks/use-inboxes';
import { useTeams } from './hooks/use-teams';
import { useWorkspaceMembers } from './hooks/use-workspace-members';
import { RuleBuilderDialog } from './automation-rule-builder/rule-builder-dialog';

interface AutomationRulesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function AutomationRulesList({ workspaceId, currentUserRole }: AutomationRulesListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [triggerFilter, setTriggerFilter] = React.useState<string>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  const [builderOpen, setBuilderOpen] = React.useState(false);
  const [ruleToEdit, setRuleToEdit] = React.useState<AutomationRuleDto | null>(null);
  const [ruleToDelete, setRuleToDelete] = React.useState<AutomationRuleDto | null>(null);

  const { data: rules, isLoading } = useAutomationRules(workspaceId);
  const { mutate: deleteRule, isPending: isDeleting } = useDeleteAutomationRule(workspaceId);
  const { mutate: toggleActive } = useToggleAutomationRuleActive(workspaceId);

  const { data: inboxes } = useInboxes(workspaceId);
  const { data: teams } = useTeams(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  // OWNER and ADMIN can manage automation rules
  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredRules = React.useMemo(() => {
    if (!rules) return [];

    return rules.filter(rule => {
      const name = rule.name.toLowerCase();
      const desc = (rule.description || '').toLowerCase();
      const q = searchQuery.trim().toLowerCase();

      const matchesSearch = !q || name.includes(q) || desc.includes(q);
      const matchesTrigger = triggerFilter === 'ALL' || rule.eventTrigger === triggerFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ACTIVE' && rule.isActive) ||
        (statusFilter === 'INACTIVE' && !rule.isActive);

      return matchesSearch && matchesTrigger && matchesStatus;
    });
  }, [rules, searchQuery, triggerFilter, statusFilter]);

  const handleCreateNew = () => {
    setRuleToEdit(null);
    setBuilderOpen(true);
  };

  const handleEdit = (rule: AutomationRuleDto) => {
    setRuleToEdit(rule);
    setBuilderOpen(true);
  };

  const handleDuplicate = (rule: AutomationRuleDto) => {
    // Clone rule without ID
    const cloned: AutomationRuleDto = {
      ...rule,
      id: '',
      name: `${rule.name} (Copy)`,
    };
    setRuleToEdit(cloned);
    setBuilderOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!ruleToDelete) return;
    deleteRule(ruleToDelete.id, {
      onSuccess: () => setRuleToDelete(null),
    });
  };

  const formatConditionChip = (cond: any): string => {
    const attr = ATTRIBUTE_OPTIONS.find(a => a.value === cond.attribute)?.label || cond.attribute;
    const op =
      OPERATOR_OPTIONS[cond.operator as keyof typeof OPERATOR_OPTIONS]?.label || cond.operator;
    const rawVal = cond.values?.[0];

    if (cond.operator === 'IS_PRESENT' || cond.operator === 'IS_NOT_PRESENT') {
      return `${attr} ${op}`;
    }
    if (!rawVal) return `${attr} ${op}`;

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

  const formatActionChip = (act: any): string => {
    switch (act.type) {
      case AutomationActionType.ASSIGN_AGENT: {
        const member = members?.find(m => m.userId === act.params.agentId);
        return `Assign: ${member?.user?.name || member?.user?.email || 'Agent'}`;
      }
      case AutomationActionType.ASSIGN_TEAM: {
        const team = teams?.find(t => t.id === act.params.teamId);
        return `Assign: ${team?.name || 'Team'}`;
      }
      case AutomationActionType.ADD_LABEL:
        return `Add Label: "${act.params.labelTitle}"`;
      case AutomationActionType.REMOVE_LABEL:
        return `Remove Label: "${act.params.labelTitle}"`;
      case AutomationActionType.CHANGE_STATUS:
        return `Status ➔ ${act.params.status}`;
      case AutomationActionType.CHANGE_PRIORITY:
        return `Priority ➔ ${act.params.priority}`;
      case AutomationActionType.SEND_WEBHOOK:
        return `Webhook: ${act.params.url}`;
      default:
        return 'Execute Action';
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
              placeholder="Search automation rules..."
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

          {/* Trigger Filter */}
          <Select value={triggerFilter} onValueChange={setTriggerFilter}>
            <SelectTrigger className="h-8 w-44 bg-card/40 text-xs">
              <SelectValue placeholder="All Triggers" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs">
                  All Triggers
                </SelectItem>
                {TRIGGER_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 w-32 bg-card/40 text-xs">
              <SelectValue placeholder="All States" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs">
                  All States
                </SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">
                  Active only
                </SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">
                  Inactive only
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {rules && (
            <Badge variant="secondary" className="h-7 px-2 text-[11px] font-normal">
              {filteredRules.length} of {rules.length} rules
            </Badge>
          )}
        </div>

        {canManage && (
          <Button onClick={handleCreateNew} size="sm" className="h-8 gap-1.5 text-xs shrink-0">
            <Plus className="size-3.5" />
            New Automation Rule
          </Button>
        )}
      </div>

      {/* Rules Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/40">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="size-8 rounded-lg" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Skeleton className="h-10 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredRules.length === 0 ? (
        /* Empty State */
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/30">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground mb-3">
            <Zap className="size-6 text-primary/80" />
          </div>
          {searchQuery || triggerFilter !== 'ALL' || statusFilter !== 'ALL' ? (
            <>
              <h3 className="text-sm font-semibold text-foreground">
                No matching automation rules
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                No rules matched your search filters. Try clearing your filters or search terms.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setTriggerFilter('ALL');
                  setStatusFilter('ALL');
                }}
                className="mt-4 h-8 text-xs"
              >
                Clear Filters
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">
                No automation rules configured
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Automation rules automatically route incoming messages, tag VIP conversations,
                assign agents/teams, and trigger webhooks without manual intervention.
              </p>
              {canManage && (
                <Button onClick={handleCreateNew} size="sm" className="mt-4 h-8 gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Create First Rule
                </Button>
              )}
            </>
          )}
        </div>
      ) : (
        /* List of Rule Cards */
        <div className="grid grid-cols-1 gap-3.5">
          {filteredRules.map(rule => {
            const triggerMeta =
              TRIGGER_OPTIONS.find(t => t.value === rule.eventTrigger) || TRIGGER_OPTIONS[0];

            return (
              <Card
                key={rule.id}
                className={`overflow-hidden border transition-all hover:border-border ${
                  rule.isActive
                    ? 'border-border/80 bg-card/60'
                    : 'border-border/40 bg-card/20 opacity-75'
                }`}
              >
                <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start">
                  {/* Left: Info & Badges */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{rule.name}</h4>
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-medium ${triggerMeta.badgeColor}`}
                      >
                        <Zap className="size-2.5 mr-1 inline" />
                        {triggerMeta.label}
                      </Badge>
                      {!rule.isActive && (
                        <Badge
                          variant="secondary"
                          className="bg-muted text-muted-foreground text-[10px]"
                        >
                          Inactive
                        </Badge>
                      )}
                    </div>

                    {rule.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {rule.description}
                      </p>
                    )}

                    {/* Summary Logic Strip */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                      {/* Conditions */}
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                        <Filter className="size-3" /> IF:
                      </span>
                      {rule.conditions && rule.conditions.length > 0 ? (
                        rule.conditions.map((cond, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && (
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                AND
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className="border-sky-500/30 bg-sky-500/10 text-sky-300 text-[10px] font-normal py-0"
                            >
                              {formatConditionChip(cond)}
                            </Badge>
                          </React.Fragment>
                        ))
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground">
                          All trigger events
                        </span>
                      )}

                      <ArrowRight className="size-3 text-muted-foreground/50 mx-1" />

                      {/* Actions */}
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <Play className="size-3" /> THEN:
                      </span>
                      {rule.actions.map((act, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-normal py-0"
                        >
                          {formatActionChip(act)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Right: Quick Active Switch & Actions */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-start">
                    {canManage && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-muted-foreground">
                            {rule.isActive ? 'Active' : 'Off'}
                          </span>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={checked =>
                              toggleActive({ ruleId: rule.id, isActive: checked })
                            }
                            aria-label={`Toggle ${rule.name}`}
                          />
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-foreground"
                            >
                              <MoreVertical className="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-36 text-xs">
                            <DropdownMenuItem
                              onClick={() => handleEdit(rule)}
                              className="cursor-pointer gap-2 text-xs"
                            >
                              <Pencil className="size-3.5 text-muted-foreground" />
                              Edit Rule
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(rule)}
                              className="cursor-pointer gap-2 text-xs"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setRuleToDelete(rule)}
                              className="cursor-pointer gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rule Builder Dialog */}
      {builderOpen && (
        <RuleBuilderDialog
          open={builderOpen}
          onOpenChange={open => {
            setBuilderOpen(open);
            if (!open) setRuleToEdit(null);
          }}
          workspaceId={workspaceId}
          ruleToEdit={ruleToEdit}
        />
      )}

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!ruleToDelete} onOpenChange={open => !open && setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete Automation Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the automation rule{' '}
              <strong className="text-foreground">"{ruleToDelete?.name}"</strong>? This rule will no
              longer evaluate or execute actions on future events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              {isDeleting && <Spinner className="size-3.5" data-icon="inline-start" />}
              Delete Rule
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
