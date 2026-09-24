'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { WorkspaceMemberDto } from '@sales-copilot/shared-contracts';
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

interface MemberRemoveDialogProps {
  member: WorkspaceMemberDto | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRemoving: boolean;
}

export function MemberRemoveDialog({
  member,
  onOpenChange,
  onConfirm,
  isRemoving,
}: MemberRemoveDialogProps) {
  return (
    <AlertDialog
      open={!!member}
      onOpenChange={open => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-destructive/10 text-destructive">
            <AlertTriangle className="size-4" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-sm font-semibold">
            Xóa thành viên khỏi workspace?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            Bạn có chắc chắn muốn xóa{' '}
            <strong className="text-foreground font-semibold">
              {member?.user?.name || member?.user?.email}
            </strong>{' '}
            ({member?.user?.email}) khỏi workspace này? Họ sẽ ngay lập tức mất quyền truy cập vào
            tất cả cuộc hội thoại, hộp thư và cài đặt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving} className="text-xs">
            Hủy
          </AlertDialogCancel>
          <Button
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            disabled={isRemoving}
            className="text-xs font-medium"
          >
            {isRemoving ? (
              <>
                <Spinner className="size-3.5" data-icon="inline-start" />
                Đang xóa...
              </>
            ) : (
              'Xóa thành viên'
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
