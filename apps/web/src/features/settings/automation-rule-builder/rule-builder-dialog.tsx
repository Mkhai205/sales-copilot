'use client';

import * as React from 'react';
import { Plus, Sparkles, Zap, Filter, Play, CheckCircle2 } from 'lucide-react';
import {
  AutomationActionType,
  AutomationAttribute,
  AutomationEventTrigger,
  AutomationOperator,
  ConversationStatus,
  type AutomationAction,
  type AutomationCondition,
  type AutomationRuleDto,
  type CreateAutomationRuleDto,
  type UpdateAutomationRuleDto,
} from '@sales-copilot/shared-contracts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { TRIGGER_OPTIONS, OPERATOR_OPTIONS } from '../constants/automation-rule-options';
import { ConditionRow } from './condition-row';
import { ActionRow } from './action-row';
import { RuleFlowPreview } from './rule-flow-preview';
import { useCreateAutomationRule, useUpdateAutomationRule } from '../hooks/use-automation-rules';

interface RuleBuilderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  ruleToEdit?: AutomationRuleDto | null;
}

export function RuleBuilderDialog({
  open,
  onOpenChange,
  workspaceId,
  ruleToEdit,
}: RuleBuilderDialogProps) {
  const isEditing = !!ruleToEdit;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);
  const [eventTrigger, setEventTrigger] = React.useState<AutomationEventTrigger>(
    AutomationEventTrigger.MESSAGE_CREATED,
  );
  const [conditions, setConditions] = React.useState<AutomationCondition[]>([]);
  const [actions, setActions] = React.useState<AutomationAction[]>([
    {
      type: AutomationActionType.CHANGE_STATUS,
      params: { status: ConversationStatus.OPEN },
    },
  ]);
  const [touched, setTouched] = React.useState(false);

  const { mutate: createRule, isPending: isCreating } = useCreateAutomationRule(workspaceId);
  const { mutate: updateRule, isPending: isUpdating } = useUpdateAutomationRule(workspaceId);

  const isPending = isCreating || isUpdating;

  // Initialize or reset form state
  React.useEffect(() => {
    if (open) {
      if (ruleToEdit) {
        setName(ruleToEdit.name);
        setDescription(ruleToEdit.description || '');
        setIsActive(ruleToEdit.isActive ?? true);
        setEventTrigger(ruleToEdit.eventTrigger);
        setConditions(
          ruleToEdit.conditions ? JSON.parse(JSON.stringify(ruleToEdit.conditions)) : [],
        );
        setActions(
          ruleToEdit.actions && ruleToEdit.actions.length > 0
            ? JSON.parse(JSON.stringify(ruleToEdit.actions))
            : [
                {
                  type: AutomationActionType.CHANGE_STATUS,
                  params: { status: ConversationStatus.OPEN },
                },
              ],
        );
      } else {
        setName('');
        setDescription('');
        setIsActive(true);
        setEventTrigger(AutomationEventTrigger.MESSAGE_CREATED);
        setConditions([]);
        setActions([
          {
            type: AutomationActionType.CHANGE_STATUS,
            params: { status: ConversationStatus.OPEN },
          },
        ]);
      }
      setTouched(false);
    }
  }, [open, ruleToEdit]);

  // Validation
  const trimmedName = name.trim();
  const nameError = React.useMemo(() => {
    if (!touched) return null;
    if (!trimmedName) return 'Rule name is required';
    if (trimmedName.length > 100) return 'Rule name cannot exceed 100 characters';
    return null;
  }, [touched, trimmedName]);

  const validationErrors = React.useMemo(() => {
    if (!touched) return [];
    const errors: string[] = [];

    if (!trimmedName) {
      errors.push('Rule name is required');
    }

    if (actions.length === 0) {
      errors.push('At least one action is required');
    }

    // Validate conditions
    conditions.forEach((cond, idx) => {
      const opMeta = OPERATOR_OPTIONS[cond.operator];
      if (opMeta?.requiresValue) {
        const val = cond.values?.[0]?.trim();
        if (!val) {
          errors.push(`Condition #${idx + 1} is missing a value.`);
        }
      }
    });

    // Validate actions
    actions.forEach((act, idx) => {
      switch (act.type) {
        case AutomationActionType.ASSIGN_AGENT:
          if (!act.params.agentId?.trim()) {
            errors.push(`Action #${idx + 1}: Select an agent.`);
          }
          break;
        case AutomationActionType.ASSIGN_TEAM:
          if (!act.params.teamId?.trim()) {
            errors.push(`Action #${idx + 1}: Select a team.`);
          }
          break;
        case AutomationActionType.ADD_LABEL:
        case AutomationActionType.REMOVE_LABEL:
          if (!act.params.labelTitle?.trim()) {
            errors.push(`Action #${idx + 1}: Enter a label title.`);
          }
          break;
        case AutomationActionType.SEND_WEBHOOK: {
          const url = act.params.url?.trim();
          if (!url) {
            errors.push(`Action #${idx + 1}: Enter a webhook URL.`);
          } else {
            try {
              new URL(url);
            } catch {
              errors.push(`Action #${idx + 1}: Invalid webhook URL format.`);
            }
          }
          break;
        }
      }
    });

    return errors;
  }, [touched, trimmedName, conditions, actions]);

  const isValid = validationErrors.length === 0;

  // Add / remove conditions
  const handleAddCondition = () => {
    setConditions(prev => [
      ...prev,
      {
        attribute: AutomationAttribute.CONTENT,
        operator: AutomationOperator.CONTAINS,
        values: [],
      },
    ]);
  };

  const handleUpdateCondition = (index: number, updated: AutomationCondition) => {
    setConditions(prev => prev.map((c, i) => (i === index ? updated : c)));
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(prev => prev.filter((_, i) => i !== index));
  };

  // Add / remove actions
  const handleAddAction = () => {
    setActions(prev => [
      ...prev,
      {
        type: AutomationActionType.ADD_LABEL,
        params: { labelTitle: '' },
      },
    ]);
  };

  const handleUpdateAction = (index: number, updated: AutomationAction) => {
    setActions(prev => prev.map((a, i) => (i === index ? updated : a)));
  };

  const handleRemoveAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);

    if (!trimmedName || !isValid) {
      return;
    }

    if (isEditing && ruleToEdit) {
      const updateDto: UpdateAutomationRuleDto = {
        name: trimmedName,
        description: description.trim() || null,
        eventTrigger,
        conditions,
        actions,
        isActive,
      };

      updateRule(
        { ruleId: ruleToEdit.id, dto: updateDto },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      const createDto: CreateAutomationRuleDto = {
        name: trimmedName,
        description: description.trim() || null,
        eventTrigger,
        conditions,
        actions,
        isActive,
      };

      createRule(createDto, {
        onSuccess: () => onOpenChange(false),
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl p-0">
        <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <DialogHeader className="border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Zap className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground">
                    {isEditing ? 'Edit Automation Rule' : 'Create Automation Rule'}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Define trigger events, condition filters, and automated routing actions.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2 pr-6">
                <span className="text-xs font-medium text-muted-foreground">Rule Active</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} disabled={isPending} />
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable Form Body */}
          <ScrollArea className="flex-1 overflow-y-auto px-6 py-4">
            <div className="flex flex-col gap-6">
              {/* Live Flow Preview Ribbon */}
              <RuleFlowPreview
                eventTrigger={eventTrigger}
                conditions={conditions}
                actions={actions}
                workspaceId={workspaceId}
              />

              {/* Section 1: Basic Information */}
              <FieldGroup className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  1. Rule Overview
                </div>

                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field data-invalid={!!nameError}>
                    <FieldLabel className="text-xs">
                      Rule Name <span className="text-destructive">*</span>
                    </FieldLabel>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g., Auto-assign VIP tickets, Tag billing inquiries"
                      className="mt-1 h-8 text-xs"
                      aria-invalid={!!nameError}
                    />
                    {nameError && <FieldError className="text-xs">{nameError}</FieldError>}
                  </Field>

                  <Field>
                    <FieldLabel className="text-xs">Description (Optional)</FieldLabel>
                    <Input
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Explain when or why this rule executes..."
                      className="mt-1 h-8 text-xs"
                    />
                  </Field>
                </div>
              </FieldGroup>

              {/* Section 2: Event Trigger Selector */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-indigo-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      2. When this event occurs (Trigger)
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {TRIGGER_OPTIONS.map(opt => {
                    const isSelected = eventTrigger === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setEventTrigger(opt.value)}
                        className={`flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500'
                            : 'border-border/80 bg-card/70 hover:border-border hover:bg-card'
                        }`}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-xs font-semibold text-foreground">{opt.label}</span>
                          {isSelected && <CheckCircle2 className="size-3.5 text-indigo-400" />}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                          {opt.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Conditions Builder */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Filter className="size-4 text-sky-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      3. If following conditions are met (Filters)
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCondition}
                    className="h-7 gap-1.5 text-xs text-sky-400 border-sky-500/30 hover:bg-sky-500/10"
                  >
                    <Plus className="size-3" />
                    Add Condition
                  </Button>
                </div>

                <div className="mt-3 flex flex-col gap-2.5">
                  {conditions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 p-5 text-center bg-card/20">
                      <p className="text-xs font-medium text-foreground">
                        No condition filters added
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        This rule will automatically match all events that trigger it.
                      </p>
                    </div>
                  ) : (
                    conditions.map((cond, idx) => (
                      <ConditionRow
                        key={idx}
                        index={idx}
                        condition={cond}
                        workspaceId={workspaceId}
                        onChange={updated => handleUpdateCondition(idx, updated)}
                        onRemove={() => handleRemoveCondition(idx)}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* Section 4: Actions Builder */}
              <div className="rounded-xl border border-border/80 bg-card/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Play className="size-4 text-emerald-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      4. Then execute these actions
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddAction}
                    className="h-7 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                  >
                    <Plus className="size-3" />
                    Add Action
                  </Button>
                </div>

                <div className="mt-3 flex flex-col gap-2.5">
                  {actions.map((act, idx) => (
                    <ActionRow
                      key={idx}
                      index={idx}
                      action={act}
                      workspaceId={workspaceId}
                      isOnlyAction={actions.length <= 1}
                      onChange={updated => handleUpdateAction(idx, updated)}
                      onRemove={() => handleRemoveAction(idx)}
                    />
                  ))}
                </div>
              </div>

              {/* Validation error summaries if touched */}
              {touched && validationErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <span className="font-semibold">Please fix the following issues:</span>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Footer */}
          <DialogFooter className="border-t border-border px-6 py-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending} className="text-xs gap-1.5">
              {isPending && <Spinner className="size-3.5" data-icon="inline-start" />}
              {isEditing ? 'Save Changes' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
