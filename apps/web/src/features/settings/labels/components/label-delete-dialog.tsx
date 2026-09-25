'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { LabelDto } from '@sales-copilot/shared-contracts';
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

interface LabelDeleteDialogProps {
  label: LabelDto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function LabelDeleteDialog({
  label,
  onOpenChange,
  onConfirm,
  isDeleting,
}: LabelDeleteDialogProps) {
  return (
    <AlertDialog
      open={!!label}
      onOpenChange={open => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-sm font-semibold">Xóa nhãn hội thoại?</AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Bạn có chắc chắn muốn xóa nhãn{' '}
            <strong className="text-foreground font-semibold">"{label?.title}"</strong>? Nhãn này sẽ
            bị gỡ bỏ vĩnh viễn khỏi toàn bộ các cuộc hội thoại đã được gắn thẻ và danh mục lọc thanh
            bên. Hành động này không thể hoàn tác.
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
              'Xóa nhãn'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
