'use client';

import * as React from 'react';
import { Users, CheckCircle2 } from 'lucide-react';
import type { WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import type { ChannelCardItem } from './types';

interface StepCollaboratorsProps {
  selectedChannel: ChannelCardItem;
  workspaceMembers?: WorkspaceMemberDto[];
  selectedMemberUserIds: string[];
  onChangeSelectedMembers: React.Dispatch<React.SetStateAction<string[]>>;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
}

export function StepCollaborators({
  selectedChannel,
  workspaceMembers,
  selectedMemberUserIds,
  onChangeSelectedMembers,
  isSubmitting,
  onBack,
  onSubmit,
}: StepCollaboratorsProps) {
  const isAllSelected =
    Boolean(workspaceMembers && workspaceMembers.length > 0) &&
    selectedMemberUserIds.length === workspaceMembers?.length;

  const handleToggleSelectAll = (checked: boolean | 'indeterminate') => {
    if (checked && workspaceMembers) {
      onChangeSelectedMembers(workspaceMembers.map(m => m.userId));
    } else {
      onChangeSelectedMembers([]);
    }
  };

  const handleToggleMember = (userId: string) => {
    onChangeSelectedMembers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId],
    );
  };

  return (
    <Card className="border-border bg-card/40 max-w-xl">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-primary" />
          <CardTitle className="text-sm font-semibold">
            Chỉ định nhân viên tiếp nhận hộp thư
          </CardTitle>
        </div>
        <CardDescription className="text-xs">
          Chọn các nhân viên có quyền tiếp nhận và phản hồi tin nhắn trong hộp thư{' '}
          {selectedChannel.title}.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card/30 px-3.5 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-members"
              checked={isAllSelected}
              onCheckedChange={handleToggleSelectAll}
            />
            <label
              htmlFor="select-all-members"
              className="text-xs font-medium cursor-pointer select-none"
            >
              Chọn tất cả nhân viên ({workspaceMembers?.length || 0})
            </label>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Đã chọn {selectedMemberUserIds.length} nhân sự
          </span>
        </div>

        <div className="rounded-lg border border-border bg-card/20 divide-y divide-border/60 max-h-64 overflow-y-auto">
          {workspaceMembers?.map(member => {
            const isChecked = selectedMemberUserIds.includes(member.userId);
            return (
              <div
                key={member.id}
                onClick={() => handleToggleMember(member.userId)}
                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                  isChecked ? 'bg-primary/5' : 'hover:bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => handleToggleMember(member.userId)}
                  />
                  <Avatar className="size-8 border border-border">
                    <AvatarImage src={member.user?.avatarUrl || undefined} />
                    <AvatarFallback className="text-[10px] font-semibold">
                      {member.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-medium text-foreground truncate">
                      {member.user?.name || 'Chưa đặt tên'}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {member.user?.email}
                    </span>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {member.role}
                </Badge>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onBack}
            disabled={isSubmitting}
            className="text-xs h-8"
          >
            Quay lại
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="text-xs h-8 gap-1.5 font-medium"
          >
            {isSubmitting ? (
              <>
                <Spinner className="size-3.5" data-icon="inline-start" />
                Đang tạo hộp thư...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                Hoàn tất &amp; Tạo hộp thư
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
