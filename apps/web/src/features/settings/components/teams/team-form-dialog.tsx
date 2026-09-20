'use client';

import * as React from 'react';
import { Users2, Check, Search, X } from 'lucide-react';
import type { TeamDto } from '@sales-copilot/shared-contracts';
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
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { useWorkspaceMembers } from '../../hooks/use-workspace-members';
import { useCreateTeam, useUpdateTeam } from '../../hooks/use-teams';

interface TeamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  teamToEdit?: TeamDto | null;
}

export function TeamFormDialog({
  open,
  onOpenChange,
  workspaceId,
  teamToEdit,
}: TeamFormDialogProps) {
  const isEditing = !!teamToEdit;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [memberSearchQuery, setMemberSearchQuery] = React.useState('');
  const [touched, setTouched] = React.useState(false);

  const { data: workspaceMembers, isLoading: isLoadingMembers } = useWorkspaceMembers(workspaceId);

  const { mutate: createTeam, isPending: isCreating } = useCreateTeam(workspaceId);
  const { mutate: updateTeam, isPending: isUpdating } = useUpdateTeam(workspaceId);

  const isPending = isCreating || isUpdating;

  // Initialize or reset form values
  React.useEffect(() => {
    if (open) {
      if (teamToEdit) {
        setName(teamToEdit.name);
        setDescription(teamToEdit.description || '');
        const memberIds = teamToEdit.members?.map(m => m.userId) || [];
        setSelectedUserIds(memberIds);
      } else {
        setName('');
        setDescription('');
        setSelectedUserIds([]);
      }
      setMemberSearchQuery('');
      setTouched(false);
    }
  }, [open, teamToEdit]);

  // Validation
  const trimmedName = name.trim();
  const nameError = React.useMemo(() => {
    if (!touched) return null;
    if (trimmedName.length === 0) {
      return 'Tên nhóm là bắt buộc';
    }
    if (trimmedName.length > 100) {
      return 'Tên nhóm không được vượt quá 100 ký tự';
    }
    return null;
  }, [trimmedName, touched]);

  const descError = React.useMemo(() => {
    if (description.length > 500) {
      return 'Mô tả không được vượt quá 500 ký tự';
    }
    return null;
  }, [description]);

  const isValid = !nameError && !descError && trimmedName.length > 0;

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  const filteredMembers = React.useMemo(() => {
    if (!workspaceMembers) return [];
    if (!memberSearchQuery.trim()) return workspaceMembers;

    const query = memberSearchQuery.trim().toLowerCase();
    return workspaceMembers.filter(m => {
      const name = m.user?.name?.toLowerCase() || '';
      const email = m.user?.email?.toLowerCase() || '';
      return name.includes(query) || email.includes(query);
    });
  }, [workspaceMembers, memberSearchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid || isPending) return;

    if (isEditing && teamToEdit) {
      updateTeam(
        {
          teamId: teamToEdit.id,
          dto: {
            name: trimmedName,
            description: description.trim() || undefined,
          },
          memberUserIds: selectedUserIds,
          currentMemberUserIds: teamToEdit.members?.map(m => m.userId) || [],
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    } else {
      createTeam(
        {
          dto: {
            name: trimmedName,
            description: description.trim() || undefined,
          },
          memberUserIds: selectedUserIds,
        },
        {
          onSuccess: () => onOpenChange(false),
        },
      );
    }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 min-h-0 flex-1">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Users2 className="size-4 text-primary" />
              <DialogTitle className="text-sm font-semibold">
                {isEditing ? 'Chỉnh sửa nhóm' : 'Tạo nhóm mới'}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              {isEditing
                ? 'Cập nhật thông tin nhóm và quản lý các thành viên được gán.'
                : 'Tổ chức các nhân viên hỗ trợ thành các nhóm làm việc.'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto pr-1 py-1">
            <FieldGroup className="gap-4">
              {/* Team Name */}
              <Field data-invalid={!!nameError}>
                <FieldLabel htmlFor="team-name">Tên nhóm</FieldLabel>
                <Input
                  id="team-name"
                  value={name}
                  onChange={e => {
                    setName(e.target.value);
                    if (!touched) setTouched(true);
                  }}
                  placeholder="Ví dụ: Hỗ trợ cấp 1, Bán lẻ, Khách hàng VIP..."
                  maxLength={100}
                  aria-invalid={!!nameError}
                  required
                  className="text-xs"
                />
                {nameError && <FieldError errors={[{ message: nameError }]} />}
              </Field>

              {/* Team Description */}
              <Field data-invalid={!!descError}>
                <FieldLabel htmlFor="team-desc">Mô tả</FieldLabel>
                <Textarea
                  id="team-desc"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mục đích và trách nhiệm của nhóm này..."
                  rows={2}
                  maxLength={500}
                  className="text-xs"
                />
                <FieldDescription>Mô tả ngắn gọn tùy chọn (tối đa 500 ký tự).</FieldDescription>
                {descError && <FieldError errors={[{ message: descError }]} />}
              </Field>

              {/* Members Selection List */}
              <Field>
                <div className="flex items-center justify-between">
                  <FieldLabel>Thành viên nhóm</FieldLabel>
                  <Badge variant="secondary" className="px-1.5 py-0.2 text-[10px]">
                    Đã chọn {selectedUserIds.length}
                  </Badge>
                </div>

                {/* Member Search Bar */}
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={memberSearchQuery}
                    onChange={e => setMemberSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm thành viên trong workspace..."
                    className="h-7 pl-7 pr-7 text-xs bg-muted/30"
                  />
                  {memberSearchQuery && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setMemberSearchQuery('')}
                      className="absolute right-1 top-1/2 size-5 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-2.5" />
                    </Button>
                  )}
                </div>

                {/* Scrollable Members Selection */}
                <div className="mt-2 rounded-lg border border-border bg-card/40 overflow-hidden">
                  <ScrollArea className="h-44 p-1">
                    {isLoadingMembers ? (
                      <div className="flex flex-col gap-2 p-2">
                        <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                        <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                        <div className="h-8 w-full animate-pulse rounded-md bg-muted/60" />
                      </div>
                    ) : filteredMembers.length === 0 ? (
                      <div className="flex h-32 items-center justify-center p-4 text-center text-xs text-muted-foreground">
                        Không tìm thấy thành viên nào.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {filteredMembers.map(member => {
                          const isSelected = selectedUserIds.includes(member.userId);
                          return (
                            <button
                              type="button"
                              key={member.id}
                              onClick={() => toggleUserSelection(member.userId)}
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
                                    alt={member.user?.name || 'Thành viên'}
                                  />
                                  <AvatarFallback className="text-[10px]">
                                    {getInitials(member.user?.name, member.user?.email)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate text-xs font-medium text-foreground">
                                    {member.user?.name || 'Chưa đặt tên'}
                                  </span>
                                  <span className="truncate text-[10px] text-muted-foreground">
                                    {member.user?.email}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="px-1 text-[9px] uppercase">
                                  {member.role === 'OWNER'
                                    ? 'Chủ sở hữu'
                                    : member.role === 'ADMIN'
                                      ? 'Quản trị'
                                      : member.role === 'AGENT'
                                        ? 'Nhân viên'
                                        : member.role}
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
              </Field>
            </FieldGroup>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="default"
              size="sm"
              disabled={isPending || !trimmedName}
              className="text-xs font-medium"
            >
              {isPending ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  {isEditing ? 'Đang lưu...' : 'Đang tạo...'}
                </>
              ) : isEditing ? (
                'Lưu thay đổi'
              ) : (
                'Tạo nhóm'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
