'use client';

import * as React from 'react';
import { Crown, Shield, ShieldCheck, UserCheck } from 'lucide-react';
import {
  type AssignableWorkspaceRole,
  type WorkspaceMemberDto,
  WorkspaceRole,
} from '@sales-copilot/shared-contracts';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MemberRoleSelectProps {
  member: WorkspaceMemberDto;
  canEdit: boolean;
  isUpdating: boolean;
  onRoleChange: (member: WorkspaceMemberDto, newRole: AssignableWorkspaceRole) => void;
}

export function MemberRoleSelect({
  member,
  canEdit,
  isUpdating,
  onRoleChange,
}: MemberRoleSelectProps) {
  const isOwner = member.role === WorkspaceRole.OWNER;

  if (isOwner) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-warning/30 bg-warning/10 text-warning dark:text-warning px-2 py-0.5 text-xs font-semibold"
      >
        <Crown className="size-3" />
        Chủ sở hữu
      </Badge>
    );
  }

  if (canEdit) {
    return (
      <Select
        value={member.role}
        onValueChange={(newRole: AssignableWorkspaceRole) => onRoleChange(member, newRole)}
        disabled={isUpdating}
      >
        <SelectTrigger className="h-7 w-32 text-xs bg-background/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectItem value={WorkspaceRole.ADMIN} className="text-xs">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3 text-primary" />
              Quản trị viên
            </span>
          </SelectItem>
          <SelectItem value={WorkspaceRole.AGENT} className="text-xs">
            <span className="flex items-center gap-1.5">
              <UserCheck className="size-3 text-success" />
              Nhân viên
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
    );
  }

  const getRoleIcon = (role: WorkspaceRole) => {
    switch (role) {
      case WorkspaceRole.ADMIN:
        return <ShieldCheck className="size-3 text-primary" />;
      case WorkspaceRole.AGENT:
        return <UserCheck className="size-3 text-success" />;
      default:
        return <Shield className="size-3 text-muted-foreground" />;
    }
  };

  return (
    <Badge variant="secondary" className="gap-1 px-2 py-0.5 text-xs font-medium">
      {getRoleIcon(member.role)}
      {member.role === WorkspaceRole.ADMIN
        ? 'Quản trị viên'
        : member.role === WorkspaceRole.AGENT
          ? 'Nhân viên'
          : member.role}
    </Badge>
  );
}
