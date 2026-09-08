'use client';

import * as React from 'react';
import { AlertTriangle, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AgentCollisionBannerProps {
  isLocked: boolean;
  lockedBy?: {
    userId: string;
    userName?: string;
    userEmail?: string;
    avatarUrl?: string;
    startedAt?: string;
  } | null;
  remainingTtlSeconds?: number;
  onTakeover: () => void;
  disabled?: boolean;
}

export function AgentCollisionBanner({
  isLocked,
  lockedBy,
  remainingTtlSeconds = 0,
  onTakeover,
  disabled = false,
}: AgentCollisionBannerProps) {
  if (!isLocked || !lockedBy) {
    return null;
  }

  const agentDisplay = lockedBy.userName || lockedBy.userEmail || 'Chuyên viên khác';

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs">
      <div className="flex items-start gap-2.5 min-w-0">
        <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-xs leading-tight">
            Đơn hàng đang được thao tác bởi {agentDisplay}
          </span>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
            Khóa an toàn tự động nhả sau {remainingTtlSeconds}s nếu không có thao tác.
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onTakeover}
        disabled={disabled}
        className="h-7 text-xs font-semibold px-2.5 border-amber-500/40 hover:bg-amber-500/20 text-amber-900 dark:text-amber-200 shrink-0 gap-1.5"
      >
        <UserCheck className="size-3.5" />
        Tiếp quản
      </Button>
    </div>
  );
}
