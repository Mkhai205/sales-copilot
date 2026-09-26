'use client';

import * as React from 'react';
import { Users2, Pencil, Trash2, Users } from 'lucide-react';
import type { TeamDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface TeamCardProps {
  team: TeamDto;
  canManage: boolean;
  onEdit: (team: TeamDto) => void;
  onDelete: (team: TeamDto) => void;
}

function getInitials(name?: string, email?: string) {
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
}

export function TeamCard({ team, canManage, onEdit, onDelete }: TeamCardProps) {
  const memberCount = team.memberCount ?? (team.members?.length || 0);
  const displayedMembers = (team.members || []).slice(0, 4);
  const remainingCount = memberCount - displayedMembers.length;

  return (
    <Card className="group relative flex flex-col justify-between border-border bg-card/40 hover:bg-card/70 transition-all shadow-2xs hover:shadow-sm">
      <CardHeader className="pb-2.5">
        <div className="flex items-start justify-between gap-2 min-w-0 w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Users2 className="size-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <CardTitle
                className="truncate text-sm font-semibold text-foreground"
                title={team.name}
              >
                {team.name}
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">{memberCount} thành viên</span>
            </div>
          </div>

          {canManage && (
            <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(team)}
                className="size-7 text-muted-foreground hover:text-foreground"
                title="Chỉnh sửa nhóm"
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(team)}
                className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                title="Xóa nhóm"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-1">
        <p className="text-xs text-muted-foreground line-clamp-2">
          {team.description || 'Chưa có mô tả.'}
        </p>
      </CardContent>

      <CardFooter className="pt-3 pb-3 border-t border-border/40 flex items-center justify-between">
        {/* Member Avatars Stack */}
        <div className="flex items-center">
          {displayedMembers.length > 0 ? (
            <div className="flex -space-x-1.5 overflow-hidden py-0.5">
              {displayedMembers.map(m => (
                <Avatar
                  key={m.id}
                  className="inline-block size-6 ring-2 ring-background border border-border/60"
                  title={m.user?.name || m.user?.email}
                >
                  <AvatarImage
                    src={m.user?.avatarUrl || undefined}
                    alt={m.user?.name || 'Thành viên'}
                  />
                  <AvatarFallback className="text-[9px] font-medium">
                    {getInitials(m.user?.name, m.user?.email)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {remainingCount > 0 && (
                <div className="flex size-6 items-center justify-center rounded-full bg-muted ring-2 ring-background text-[9px] font-medium text-muted-foreground">
                  +{remainingCount}
                </div>
              )}
            </div>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
              <Users className="size-3" />
              Chưa có thành viên
            </span>
          )}
        </div>

        {canManage && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(team)}
            className="h-6 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Quản lý
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
