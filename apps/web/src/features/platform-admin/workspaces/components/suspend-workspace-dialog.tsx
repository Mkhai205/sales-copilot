'use client';

import * as React from 'react';
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
import { Field, FieldLabel } from '@/components/ui/field';
import { Loader2 } from 'lucide-react';
import type { PlatformWorkspaceListItemDto } from '@sales-copilot/shared-contracts';
import { useToggleWorkspaceStatus } from '../hooks/use-platform-workspaces';
import { useI18n } from '@/lib/i18n';

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
  const { t } = useI18n();
  const [reason, setReason] = React.useState('');
  const toggleStatusMutation = useToggleWorkspaceStatus();

  React.useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);

  if (!workspace) return null;

  const isSuspending = !workspace.isSuspended;

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();

    if (isSuspending && !reason.trim()) {
      return;
    }

    try {
      await toggleStatusMutation.mutateAsync({
        id: workspace.id,
        payload: {
          isSuspended: isSuspending,
          reason: isSuspending ? reason.trim() : undefined,
        },
      });
      onOpenChange(false);
    } catch {
      // Error handled by mutation toast
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md sm:max-w-md p-6">
        <AlertDialogHeader className="pb-1">
          <AlertDialogTitle className="text-base font-semibold">
            {isSuspending
              ? t('admin.workspaces.dialogSuspendTitle')
              : t('admin.workspaces.dialogReactivateTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {isSuspending
              ? t('admin.workspaces.dialogSuspendDesc', { name: workspace.name })
              : t('admin.workspaces.dialogReactivateDesc', { name: workspace.name })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isSuspending && (
          <div className="py-2">
            <Field className="gap-1.5">
              <FieldLabel className="text-xs font-medium text-foreground">
                {t('admin.workspaces.reasonRequired')} <span className="text-destructive">*</span>
              </FieldLabel>
              <Textarea
                placeholder={t('admin.workspaces.reasonPlaceholder')}
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="text-xs min-h-[80px]"
                autoFocus
              />
            </Field>
          </div>
        )}

        <AlertDialogFooter className="pt-2 gap-2">
          <AlertDialogCancel disabled={toggleStatusMutation.isPending} className="text-xs h-8">
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={toggleStatusMutation.isPending || (isSuspending && !reason.trim())}
            className={`text-xs h-8 gap-1.5 ${
              isSuspending
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : ''
            }`}
          >
            {toggleStatusMutation.isPending && <Loader2 className="size-3.5 animate-spin" />}
            <span>
              {isSuspending
                ? t('admin.workspaces.confirmSuspend')
                : t('admin.workspaces.confirmReactivate')}
            </span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
