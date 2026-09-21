'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi } from './api/auth';
import type { ChangePasswordDto } from '@sales-copilot/shared-contracts';

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [validationError, setValidationError] = React.useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setValidationError(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const {
    mutate,
    isPending,
    error,
    reset: resetMutation,
  } = useMutation({
    mutationFn: async (dto: ChangePasswordDto) => {
      const res = await authApi.changePassword(dto);
      return res.data;
    },
    onSuccess: data => {
      toast.success(data?.message || 'Đổi mật khẩu thành công!');
      handleOpenChange(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    resetMutation();

    if (!currentPassword) {
      setValidationError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (newPassword.length < 6) {
      setValidationError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    if (currentPassword === newPassword) {
      setValidationError('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setValidationError('Mật khẩu xác nhận không khớp.');
      return;
    }

    mutate({
      currentPassword,
      newPassword,
    });
  };

  const apiErrorMessage = (error as any)?.message || null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <KeyRound className="size-4" />
              </div>
              <DialogTitle className="text-base font-semibold">Đổi mật khẩu</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Cập nhật mật khẩu mới để tăng cường tính bảo mật cho tài khoản của bạn.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="gap-4 py-4">
            {/* Error alerts */}
            {(validationError || apiErrorMessage) && (
              <Alert variant="destructive" className="py-2.5">
                <AlertDescription className="text-xs font-medium">
                  {validationError || apiErrorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Current Password */}
            <Field>
              <FieldLabel htmlFor="current-password">Mật khẩu hiện tại</FieldLabel>
              <div className="relative">
                <Input
                  id="current-password"
                  name="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại"
                  autoComplete="current-password"
                  disabled={isPending}
                  required
                  className="pr-8 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </Field>

            {/* New Password */}
            <Field>
              <FieldLabel htmlFor="new-password">Mật khẩu mới</FieldLabel>
              <div className="relative">
                <Input
                  id="new-password"
                  name="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  disabled={isPending}
                  required
                  className="pr-8 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>
            </Field>

            {/* Confirm New Password */}
            <Field>
              <FieldLabel htmlFor="confirm-password">Xác nhận mật khẩu mới</FieldLabel>
              <div className="relative">
                <Input
                  id="confirm-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  disabled={isPending}
                  required
                  className="pr-8 text-xs"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              </div>
            </Field>
          </FieldGroup>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => handleOpenChange(false)}
            >
              Hủy
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? (
                <>
                  <Spinner className="mr-2 size-3.5" />
                  Đang lưu...
                </>
              ) : (
                'Lưu mật khẩu'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
