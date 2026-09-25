'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TeamDto } from '@sales-copilot/shared-contracts';
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
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface TeamDeleteDialogProps {
  team: TeamDto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function TeamDeleteDialog({
  team,
  onOpenChange,
  onConfirm,
  isDeleting,
}: TeamDeleteDialogProps) {
  return (
    <AlertDialog
      open={!!team}
      onOpenChange={open => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-sm font-semibold">Xóa nhóm?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Bạn có chắc chắn muốn xóa{' '}
            <strong className="text-foreground font-semibold">"{team?.name}"</strong>? Các phân công
            hội thoại và liên kết thành viên thuộc nhóm này sẽ bị gỡ bỏ. Hành động này không thể
            hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} className="text-xs">
            Hủy
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isDeleting}
            className="text-xs font-medium"
          >
            {isDeleting ? (
              <>
                <Spinner className="size-3.5" />
                Đang xóa...
              </>
            ) : (
              'Xóa nhóm'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
