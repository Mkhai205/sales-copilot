'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { CannedResponseDto } from '@sales-copilot/shared-contracts';
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

interface CannedResponseDeleteDialogProps {
  response: CannedResponseDto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function CannedResponseDeleteDialog({
  response,
  onOpenChange,
  onConfirm,
  isDeleting,
}: CannedResponseDeleteDialogProps) {
  return (
    <AlertDialog
      open={!!response}
      onOpenChange={open => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-sm font-semibold">Xóa tin nhắn mẫu?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Bạn có chắc chắn muốn xóa tin nhắn mẫu{' '}
            <strong className="text-foreground font-mono font-semibold">
              /{response?.shortCode}
            </strong>
            ? Nhân viên tư vấn sẽ không còn sử dụng được mẫu câu trả lời nhanh này nữa. Hành động
            này không thể hoàn tác.
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
                <Spinner className="size-3.5" data-icon="inline-start" />
                Đang xóa...
              </>
            ) : (
              'Xóa mẫu câu'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
