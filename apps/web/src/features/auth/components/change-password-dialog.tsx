'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi } from '../api/auth';
import { changePasswordSchema, type ChangePasswordDto } from '@sales-copilot/shared-contracts';

const formSchema = changePasswordSchema
  .extend({
    confirmPassword: z.string().min(1, 'Vui lòng nhập lại mật khẩu mới'),
  })
  .refine(data => data.currentPassword !== data.newPassword, {
    message: 'Mật khẩu mới không được trùng với mật khẩu hiện tại.',
    path: ['newPassword'],
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp.',
    path: ['confirmPassword'],
  });

type ChangePasswordFormValues = z.infer<typeof formSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({ open, onOpenChange }: ChangePasswordDialogProps) {
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      reset();
      resetMutation();
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
    }
    onOpenChange(newOpen);
  };

  const onSubmit = (data: ChangePasswordFormValues) => {
    resetMutation();
    mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  const apiErrorMessage = (error as any)?.message || null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit(onSubmit)}>
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
            {/* Error alert */}
            {apiErrorMessage && (
              <Alert variant="destructive" className="py-2.5">
                <AlertDescription className="text-xs font-medium">
                  {apiErrorMessage}
                </AlertDescription>
              </Alert>
            )}

            {/* Current Password */}
            <Field data-invalid={!!errors.currentPassword}>
              <FieldLabel htmlFor="current-password">Mật khẩu hiện tại</FieldLabel>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  placeholder="Nhập mật khẩu hiện tại"
                  autoComplete="current-password"
                  disabled={isPending}
                  className="pr-8 text-xs"
                  {...register('currentPassword')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  tabIndex={-1}
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="h-auto w-auto absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showCurrentPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
              {errors.currentPassword?.message && (
                <FieldError>{errors.currentPassword.message}</FieldError>
              )}
            </Field>

            {/* New Password */}
            <Field data-invalid={!!errors.newPassword}>
              <FieldLabel htmlFor="new-password">Mật khẩu mới</FieldLabel>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Tối thiểu 6 ký tự"
                  autoComplete="new-password"
                  disabled={isPending}
                  className="pr-8 text-xs"
                  {...register('newPassword')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="h-auto w-auto absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showNewPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </Button>
              </div>
              {errors.newPassword?.message && <FieldError>{errors.newPassword.message}</FieldError>}
            </Field>

            {/* Confirm New Password */}
            <Field data-invalid={!!errors.confirmPassword}>
              <FieldLabel htmlFor="confirm-password">Xác nhận mật khẩu mới</FieldLabel>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  disabled={isPending}
                  className="pr-8 text-xs"
                  {...register('confirmPassword')}
                />
                <Button
                  type="button"
                  variant="ghost"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="h-auto w-auto absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                  aria-label={showConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </Button>
              </div>
              {errors.confirmPassword?.message && (
                <FieldError>{errors.confirmPassword.message}</FieldError>
              )}
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
