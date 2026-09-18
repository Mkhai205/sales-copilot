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
  WorkspaceRole,
  AutomationActionType,
  AutomationAttribute,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from './constants/automation-rule-options';
import {
  useAutomationRules,
  useDeleteAutomationRule,
  useToggleAutomationRuleActive,
} from './hooks/use-automation-rules';
import { useInboxes } from '@/features/omnichannel';
import { useTeams, useWorkspaceMembers } from '@/features/identity';
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
      name: `${rule.name} (Bản sao)`,
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
        return `Phân công: ${member?.user?.name || member?.user?.email || 'Nhân viên'}`;
      }
      case AutomationActionType.ASSIGN_TEAM: {
        const team = teams?.find(t => t.id === act.params.teamId);
        return `Chuyển nhóm: ${team?.name || 'Nhóm'}`;
      }
      case AutomationActionType.ADD_LABEL:
        return `Gắn nhãn: "${act.params.labelTitle}"`;
      case AutomationActionType.REMOVE_LABEL:
        return `Gỡ nhãn: "${act.params.labelTitle}"`;
      case AutomationActionType.CHANGE_STATUS:
        return `Trạng thái ➔ ${act.params.status}`;
      case AutomationActionType.CHANGE_PRIORITY:
        return `Độ ưu tiên ➔ ${act.params.priority}`;
      case AutomationActionType.SEND_WEBHOOK:
        return `Webhook: ${act.params.url}`;
      default:
        return 'Thực hiện hành động';
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
              placeholder="Tìm kiếm quy tắc tự động hóa..."
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
              <SelectValue placeholder="Tất cả kích hoạt" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs">
                  Tất cả kích hoạt
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
              <SelectValue placeholder="Tất cả trạng thái" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs">
                  Tất cả trạng thái
                </SelectItem>
                <SelectItem value="ACTIVE" className="text-xs">
                  Đang hoạt động
                </SelectItem>
                <SelectItem value="INACTIVE" className="text-xs">
                  Đã tắt
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          {rules && (
            <Badge variant="secondary" className="h-7 px-2 text-[11px] font-normal">
              {filteredRules.length} / {rules.length} quy tắc
            </Badge>
          )}
        </div>

        {canManage && (
          <Button onClick={handleCreateNew} size="sm" className="h-8 gap-1.5 text-xs shrink-0">
            <Plus className="size-3.5" />
            Thêm quy tắc mới
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
                Không tìm thấy quy tắc tự động hóa nào
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                Không có quy tắc nào khớp với bộ lọc tìm kiếm. Thử xóa bộ lọc hoặc từ khóa tìm kiếm.
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
                Xóa bộ lọc
              </Button>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-foreground">
                Chưa có quy tắc tự động hóa nào
              </h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-md">
                Quy tắc tự động hóa giúp tự động điều phối tin nhắn đến, gắn nhãn hội thoại VIP,
                phân công nhân viên/nhóm và kích hoạt webhook mà không cần thao tác thủ công.
              </p>
              {canManage && (
                <Button onClick={handleCreateNew} size="sm" className="mt-4 h-8 gap-1.5 text-xs">
                  <Plus className="size-3.5" />
                  Tạo quy tắc đầu tiên
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
                          Đã tắt
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
                        <Filter className="size-3" /> NẾU:
                      </span>
                      {rule.conditions && rule.conditions.length > 0 ? (
                        rule.conditions.map((cond, i) => (
                          <React.Fragment key={i}>
                            {i > 0 && (
                              <span className="text-[10px] font-semibold text-muted-foreground">
                                VÀ
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
                          Mọi sự kiện kích hoạt
                        </span>
                      )}

                      <ArrowRight className="size-3 text-muted-foreground/50 mx-1" />

                      {/* Actions */}
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <Play className="size-3" /> THÌ:
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
                            {rule.isActive ? 'Bật' : 'Tắt'}
                          </span>
                          <Switch
                            checked={rule.isActive}
                            onCheckedChange={checked =>
                              toggleActive({ ruleId: rule.id, isActive: checked })
                            }
                            aria-label={`Bật/tắt ${rule.name}`}
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
                              Chỉnh sửa quy tắc
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(rule)}
                              className="cursor-pointer gap-2 text-xs"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              Nhân bản
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setRuleToDelete(rule)}
                              className="cursor-pointer gap-2 text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Xóa
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
            <AlertDialogTitle>Xóa quy tắc tự động hóa</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn có chắc chắn muốn xóa quy tắc tự động hóa{' '}
              <strong className="text-foreground">"{ruleToDelete?.name}"</strong>? Quy tắc này sẽ
              không còn đánh giá hoặc thực hiện hành động trên các sự kiện sau này.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Hủy</AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="gap-1.5"
            >
              {isDeleting && <Spinner className="size-3.5" data-icon="inline-start" />}
              Xóa quy tắc
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
