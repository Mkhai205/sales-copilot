'use client';

import * as React from 'react';
import { Check, Trash2, UserPlus, Users, Zap } from 'lucide-react';
import type { InboxDetailDto, InboxAutoAssignmentConfig } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
} from '../hooks/use-inboxes';
import { useWorkspaceMembers } from '@/features/identity';

interface TabCollaboratorsProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

export function TabCollaborators({ inbox, workspaceId }: TabCollaboratorsProps) {
  const { data: inboxMembers, isLoading: isLoadingMembers } = useInboxMembers(
    workspaceId,
    inbox.id,
  );
  const { data: workspaceMembers } = useWorkspaceMembers(workspaceId);
  const { mutate: addMember, isPending: isAddingMember } = useAddInboxMember(workspaceId, inbox.id);
  const { mutate: removeMember, isPending: isRemovingMember } = useRemoveInboxMember(
    workspaceId,
    inbox.id,
  );
  const { mutate: updateInbox, isPending: isSavingAssignment } = useUpdateInbox(workspaceId);

  const [selectedAddUserId, setSelectedAddUserId] = React.useState<string>('');

  // Auto-assignment configuration state
  const existingAutoConfig = inbox.settings?.autoAssignment as
    InboxAutoAssignmentConfig | undefined;
  const [autoAssignmentEnabled, setAutoAssignmentEnabled] = React.useState<boolean>(
    inbox.isAutoAssignmentEnabled ?? existingAutoConfig?.enabled ?? false,
  );
  const [strategy, setStrategy] = React.useState<'ROUND_ROBIN'>(
    existingAutoConfig?.strategy ?? 'ROUND_ROBIN',
  );
  const [maxConcurrentChats, setMaxConcurrentChats] = React.useState<number | string>(
    existingAutoConfig?.maxConcurrentChats ?? 10,
  );

  React.useEffect(() => {
    const config = inbox.settings?.autoAssignment as InboxAutoAssignmentConfig | undefined;
    setAutoAssignmentEnabled(inbox.isAutoAssignmentEnabled ?? config?.enabled ?? false);
    setStrategy(config?.strategy ?? 'ROUND_ROBIN');
    setMaxConcurrentChats(config?.maxConcurrentChats ?? 10);
  }, [inbox]);

  // Available workspace members not yet in this inbox
  const availableMembers = React.useMemo(() => {
    if (!workspaceMembers || !inboxMembers) return [];
    const currentMemberUserIds = new Set(inboxMembers.map(m => m.userId));
    return workspaceMembers.filter(m => !currentMemberUserIds.has(m.userId));
  }, [workspaceMembers, inboxMembers]);

  const handleAddMember = () => {
    if (!selectedAddUserId) return;
    addMember(selectedAddUserId, {
      onSuccess: () => {
        setSelectedAddUserId('');
      },
    });
  };

  const handleSaveAutoAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    const chats = Math.max(1, Math.min(100, Number(maxConcurrentChats) || 10));
    const updatedAutoAssignment: InboxAutoAssignmentConfig = {
      enabled: autoAssignmentEnabled,
      strategy,
      maxConcurrentChats: chats,
    };

    const updatedSettings = {
      ...(inbox.settings || {}),
      autoAssignment: updatedAutoAssignment,
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        isAutoAssignmentEnabled: autoAssignmentEnabled,
        settings: updatedSettings,
      },
      successMessage: 'Cập nhật chính sách phân bổ tự động thành công',
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
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Assigned Members Section */}
      <Card className="border-border bg-card/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Đội ngũ nhân viên tiếp nhận</CardTitle>
              <CardDescription className="text-xs">
                Chỉ định các nhân viên có quyền tiếp nhận và phản hồi các cuộc trò chuyện trong hộp
                thư này.
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-xs font-normal">
              {inboxMembers?.length ?? 0} nhân sự
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Add member row */}
          <div className="flex items-center gap-2.5">
            <Select
              value={selectedAddUserId || undefined}
              onValueChange={setSelectedAddUserId}
              disabled={availableMembers.length === 0}
            >
              <SelectTrigger className="flex-1 h-9 text-xs">
                <SelectValue
                  placeholder={
                    availableMembers.length === 0
                      ? 'Tất cả nhân viên trong Workspace đã được gán'
                      : 'Chọn nhân viên từ không gian làm việc...'
                  }
                />
              </SelectTrigger>
              <SelectContent position="popper">
                {availableMembers.length === 0 ? (
                  <SelectItem value="_empty" disabled className="text-xs text-muted-foreground">
                    Tất cả nhân viên đã được gán
                  </SelectItem>
                ) : (
                  availableMembers.map(m => (
                    <SelectItem key={m.userId} value={m.userId} className="text-xs">
                      {m.user?.name || m.user?.email} ({m.role})
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            <Button
              type="button"
              size="sm"
              onClick={handleAddMember}
              disabled={!selectedAddUserId || isAddingMember}
              className="h-9 gap-1.5 text-xs font-medium shrink-0"
            >
              {isAddingMember ? (
                <Spinner className="size-3.5" data-icon="inline-start" />
              ) : (
                <UserPlus className="size-3.5" data-icon="inline-start" />
              )}
              Thêm nhân viên
            </Button>
          </div>

          {/* Members list */}
          <div className="rounded-lg border border-border bg-card/20 divide-y divide-border/60">
            {isLoadingMembers ? (
              <div className="flex flex-col gap-2 p-4">
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
                <div className="h-10 w-full animate-pulse rounded-md bg-muted/60" />
              </div>
            ) : !inboxMembers || inboxMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-xs text-muted-foreground gap-2">
                <Users className="size-8 text-muted-foreground/40" />
                <span>Chưa có nhân viên nào được phân bổ cho hộp thư này.</span>
              </div>
            ) : (
              inboxMembers.map(m => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="size-8 border border-border/80">
                      <AvatarImage
                        src={m.user?.avatarUrl || undefined}
                        alt={m.user?.name || 'Agent'}
                      />
                      <AvatarFallback className="text-[10px] font-semibold">
                        {getInitials(m.user?.name, m.user?.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs font-medium text-foreground">
                        {m.user?.name || 'Chưa đặt tên'}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {m.user?.email}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                      {m.user?.role || 'AGENT'}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => removeMember(m.userId)}
                      disabled={isRemovingMember}
                      className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      title="Xóa nhân viên khỏi hộp thư"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Auto Assignment Policy Section */}
      <Card className="border-border bg-card/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-amber-500" />
            <CardTitle className="text-base font-semibold">
              Tự động phân bổ hội thoại (Auto-Assignment)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Hệ thống sẽ tự động gán hội thoại mới đến cho các nhân sự trực tuyến theo thuật toán
            xoay vòng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveAutoAssignment} className="flex flex-col gap-5">
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
              <div className="flex flex-col gap-0.5 pr-4">
                <span className="text-xs font-medium text-foreground">
                  Bật tự động phân bổ hội thoại
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Khi có tin nhắn mới từ khách hàng chưa được chỉ định nhân viên, hệ thống sẽ tự
                  động tìm nhân viên phù hợp để bàn giao.
                </span>
              </div>
              <Switch checked={autoAssignmentEnabled} onCheckedChange={setAutoAssignmentEnabled} />
            </div>

            {autoAssignmentEnabled && (
              <FieldGroup className="gap-4 pt-1">
                <Field>
                  <FieldLabel htmlFor="strategy-select" className="text-xs font-medium">
                    Chiến lược phân bổ
                  </FieldLabel>
                  <Select value={strategy} onValueChange={(val: 'ROUND_ROBIN') => setStrategy(val)}>
                    <SelectTrigger id="strategy-select" className="h-9 text-xs">
                      <SelectValue placeholder="Chọn thuật toán phân bổ" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="ROUND_ROBIN" className="text-xs">
                        Xoay vòng cân bằng (Round-Robin) — Chia đều lần lượt cho từng nhân viên
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Đảm bảo khối lượng công việc được phân bổ đồng đều giữa các nhân viên trong ca
                    trực.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="max-concurrent" className="text-xs font-medium">
                    Giới hạn số hội thoại mở đồng thời (Concurrency Limit)
                  </FieldLabel>
                  <Input
                    id="max-concurrent"
                    type="number"
                    min={1}
                    max={100}
                    value={maxConcurrentChats}
                    onChange={e => setMaxConcurrentChats(e.target.value)}
                    className="h-9 text-xs max-w-xs"
                  />
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Khi nhân viên đạt đến số lượng hội thoại đang mở này, hệ thống sẽ tạm dừng phân
                    bổ thêm hội thoại mới cho họ cho đến khi các cuộc hội thoại cũ được giải quyết.
                  </FieldDescription>
                </Field>
              </FieldGroup>
            )}

            <div className="flex items-center justify-end pt-2">
              <Button
                type="submit"
                size="sm"
                disabled={isSavingAssignment}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isSavingAssignment ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" data-icon="inline-start" />
                    Lưu cấu hình phân bổ
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
