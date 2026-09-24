'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Field, FieldLabel, FieldError } from '@/components/ui/field';
import {
  toggleWorkspaceStatusSchema,
  type PlatformWorkspaceListItemDto,
  type ToggleWorkspaceStatusDto,
} from '@sales-copilot/shared-contracts';
import { useToggleWorkspaceStatus } from '../hooks/use-platform-workspaces';

export interface SuspendWorkspaceDialogProps {
  workspace: PlatformWorkspaceListItemDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuspendWorkspaceDialog({
  workspace,
  open,
  onOpenChange,
}: SuspendWorkspaceDialogProps) {
  const toggleStatusMutation = useToggleWorkspaceStatus();

  const isSuspending = workspace ? !workspace.isSuspended : true;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ToggleWorkspaceStatusDto>({
    resolver: zodResolver(toggleWorkspaceStatusSchema),
    defaultValues: {
      isSuspended: isSuspending,
      reason: '',
    },
  });

  React.useEffect(() => {
    if (open && workspace) {
      reset({
        isSuspended: !workspace.isSuspended,
        reason: '',
      });
    }
  }, [open, workspace, reset]);

  const reasonValue = watch('reason') || '';

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset({ isSuspended: isSuspending, reason: '' });
    }
    onOpenChange(newOpen);
  };

  if (!workspace) return null;

  const onConfirm = async (data: ToggleWorkspaceStatusDto) => {
    try {
      await toggleStatusMutation.mutateAsync({
        id: workspace.id,
        payload: {
          isSuspended: data.isSuspended,
          reason: data.isSuspended ? data.reason?.trim() : undefined,
        },
      });
      handleOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-md p-6">
        <AlertDialogHeader className="pb-1">
          <AlertDialogTitle className="text-base font-semibold">
            {isSuspending ? 'Tạm khóa Workspace' : 'Kích hoạt lại Workspace'}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {isSuspending
              ? `Bạn đang chuẩn bị tạm khóa shop ${workspace.name}. Khi bị tạm khóa, toàn bộ nhân sự của tenant này sẽ bị chặn thao tác (HTTP 403) và ngắt kết nối WebSocket.`
              : `Bạn có chắc chắn muốn kích hoạt lại shop ${workspace.name}? Các nhân sự trong tenant sẽ có thể đăng nhập và tiếp tục xử lý bán hàng bình thường.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isSuspending && (
          <div className="py-2">
            <Field data-invalid={!!errors.reason} className="gap-1.5">
              <FieldLabel className="text-xs font-medium text-foreground">
                {'Lý do tạm khóa'} <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                placeholder={
                  'Nhập lý do tạm khóa (bắt buộc, ví dụ: Quá hạn thanh toán, Vi phạm điều khoản dịch vụ...)'
                }
                className="text-xs min-h-[80px]"
                autoFocus
                {...register('reason')}
              />
              {errors.reason?.message && <FieldError>{errors.reason.message}</FieldError>}
            </Field>
          </div>
        )}

        <AlertDialogFooter className="pt-2 gap-2">
          <AlertDialogCancel disabled={toggleStatusMutation.isPending} className="text-xs h-8">
            {'Hủy'}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={e => {
              e.preventDefault();
              handleSubmit(onConfirm)(e);
            }}
            disabled={toggleStatusMutation.isPending || (isSuspending && !reasonValue.trim())}
            className={`text-xs h-8 gap-1.5 ${
              isSuspending
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }`}
          >
            {toggleStatusMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>{isSuspending ? 'Xác nhận khóa' : 'Kích hoạt lại'}</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
