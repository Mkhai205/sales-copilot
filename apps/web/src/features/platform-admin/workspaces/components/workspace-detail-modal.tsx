'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformWorkspaceDetail } from '../hooks/use-platform-workspaces';
import { WorkspaceDetailView } from './workspace-detail-view';

export interface WorkspaceDetailModalProps {
  workspaceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceDetailModal({
  workspaceId,
  open,
  onOpenChange,
}: WorkspaceDetailModalProps) {
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = usePlatformWorkspaceDetail(workspaceId ?? undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto sm:max-w-4xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-base font-semibold">
            Chi tiết Workspace & Hạn mức Quota
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Thông số kỹ thuật, cấu hình gói cước và mức tiêu thụ tài nguyên thực tế.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col gap-4 py-4">
            <Skeleton className="h-28 w-full rounded-lg" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="p-6 text-center text-xs text-destructive">
            Không thể tải thông tin chi tiết: {error?.message || 'Lỗi không xác định'}
          </div>
        ) : workspace ? (
          <WorkspaceDetailView workspace={workspace} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
