'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AutomationAttribute,
  AutomationOperator,
  type AutomationCondition,
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
  ATTRIBUTE_OPTIONS,
  OPERATOR_OPTIONS,
  STATUS_SELECT_OPTIONS,
  PRIORITY_SELECT_OPTIONS,
  SENDER_TYPE_SELECT_OPTIONS,
} from '../constants/automation-rule-options';
import { useInboxes } from '../hooks/use-inboxes';
import { useTeams } from '../hooks/use-teams';
import { useWorkspaceMembers } from '../hooks/use-workspace-members';

interface ConditionRowProps {
  index: number;
  condition: AutomationCondition;
  workspaceId: string;
  onChange: (updated: AutomationCondition) => void;
  onRemove: () => void;
}

export function ConditionRow({
  index,
  condition,
  workspaceId,
  onChange,
  onRemove,
}: ConditionRowProps) {
  const { data: inboxes } = useInboxes(workspaceId);
  const { data: teams } = useTeams(workspaceId);
  const { data: members } = useWorkspaceMembers(workspaceId);

  const selectedAttrMeta = React.useMemo(() => {
    return ATTRIBUTE_OPTIONS.find(a => a.value === condition.attribute) || ATTRIBUTE_OPTIONS[0];
  }, [condition.attribute]);

  const availableOperators = React.useMemo(() => {
    return selectedAttrMeta.allowedOperators.map(op => OPERATOR_OPTIONS[op]);
  }, [selectedAttrMeta]);

  const currentOperatorMeta = OPERATOR_OPTIONS[condition.operator] || availableOperators[0];

  const handleAttributeChange = (newAttr: string) => {
    const attrEnum = newAttr as AutomationAttribute;
    const targetMeta = ATTRIBUTE_OPTIONS.find(a => a.value === attrEnum) || ATTRIBUTE_OPTIONS[0];
    const defaultOp = targetMeta.allowedOperators[0];

    onChange({
      attribute: attrEnum,
      operator: defaultOp,
      values: [],
    });
  };

  const handleOperatorChange = (newOp: string) => {
    const opEnum = newOp as AutomationOperator;
    const opMeta = OPERATOR_OPTIONS[opEnum];

    onChange({
      ...condition,
      operator: opEnum,
      values: opMeta.requiresValue ? condition.values : [],
    });
  };

  const handleSingleValueChange = (val: string) => {
    onChange({
      ...condition,
      values: val ? [val] : [],
    });
  };

  const rawValue = condition.values && condition.values.length > 0 ? condition.values[0] : '';

  return (
    <div className="group relative flex flex-col gap-2 rounded-lg border border-border/70 bg-card/60 p-3 transition-colors hover:border-border sm:flex-row sm:items-center">
      {/* Logical Connector Marker */}
      <div className="flex shrink-0 items-center justify-between sm:w-14">
        <Badge
          variant={index === 0 ? 'secondary' : 'outline'}
          className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
            index === 0
              ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
              : 'border-muted-foreground/30 text-muted-foreground'
          }`}
        >
          {index === 0 ? 'IF' : 'AND'}
        </Badge>
        <span className="text-xs text-muted-foreground sm:hidden">Condition #{index + 1}</span>
      </div>

      {/* Grid of inputs */}
      <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-3">
        {/* 1. Attribute Selector */}
        <Select value={condition.attribute} onValueChange={handleAttributeChange}>
          <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
            <SelectValue placeholder="Select attribute" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {ATTRIBUTE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* 2. Operator Selector */}
        <Select value={condition.operator} onValueChange={handleOperatorChange}>
          <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
            <SelectValue placeholder="Select operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {availableOperators.map(op => (
                <SelectItem key={op.value} value={op.value} className="text-xs">
                  {op.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        {/* 3. Value Input / Select */}
        <div className="w-full">
          {!currentOperatorMeta.requiresValue ? (
            <div className="flex h-8 items-center rounded-md border border-dashed border-border/50 bg-muted/20 px-3 text-xs italic text-muted-foreground">
              (No value required)
            </div>
          ) : selectedAttrMeta.dataType === 'status' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
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
          ) : selectedAttrMeta.dataType === 'priority' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
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
          ) : selectedAttrMeta.dataType === 'sender_type' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose sender" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {SENDER_TYPE_SELECT_OPTIONS.map(st => (
                    <SelectItem key={st.value} value={st.value} className="text-xs">
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : selectedAttrMeta.dataType === 'inbox' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
              <SelectTrigger className="h-8 w-full bg-background/50 text-xs">
                <SelectValue placeholder="Choose inbox" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {inboxes && inboxes.length > 0 ? (
                    inboxes.map(inbox => (
                      <SelectItem key={inbox.id} value={inbox.id} className="text-xs">
                        {inbox.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="__none__" disabled className="text-xs">
                      No inboxes found
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : selectedAttrMeta.dataType === 'team' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
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
                      No teams found
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : selectedAttrMeta.dataType === 'agent' ? (
            <Select value={rawValue} onValueChange={handleSingleValueChange}>
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
                      No agents found
                    </SelectItem>
                  )}
                </SelectGroup>
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={rawValue}
              onChange={e => handleSingleValueChange(e.target.value)}
              placeholder="Enter text or keywords..."
              className="h-8 bg-background/50 text-xs"
            />
          )}
        </div>
      </div>

      {/* Delete button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="size-8 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        title="Remove condition"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
