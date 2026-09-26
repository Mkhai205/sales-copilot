'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon } from 'lucide-react';
import { z } from 'zod';
import { registerSchema, type RegisterDto } from '@sales-copilot/shared-contracts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { registerAction } from '../actions/auth-actions';

const registerFormSchema = registerSchema.extend({
  workspaceName: z
    .string()
    .trim()
    .max(100, 'Tên shop không được vượt quá 100 ký tự')
    .optional()
    .or(z.literal('')),
});

type RegisterFormValues = z.infer<typeof registerFormSchema>;

export function RegisterForm({ className, ...props }: React.ComponentProps<'div'>) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      workspaceName: '',
      name: '',
      email: '',
      password: '',
    },
  });

  const { mutate: handleRegister, isPending } = useMutation({
    mutationFn: async (data: RegisterFormValues) => {
      setApiError(null);
      const formData: RegisterDto = {
        workspaceName: data.workspaceName?.trim() || undefined,
        name: data.name.trim(),
        email: data.email.trim(),
        password: data.password,
      };
      return await registerAction(formData);
    },
    onSuccess: result => {
      if (result && !result.success && result.error) {
        setApiError(
          result.error.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin cung cấp.',
        );
        return;
      }
      // Clear cache strictly upon successful registration
      queryClient.clear();
    },
    onError: (err: any) => {
      if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
        return;
      }
      setApiError(err?.message || 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
    },
  });

  return (
    <div className={cn('flex flex-col gap-6 w-full', className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-lg border-border/80 bg-card">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Left: Register Form */}
          <form
            onSubmit={handleSubmit(data => handleRegister(data))}
            className="p-6 sm:p-8 flex flex-col justify-center"
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 mb-3">
                <div className="flex items-center justify-center mb-1">
                  <Image
                    src="/brand/logo.png"
                    alt="Sales Copilot"
                    width={180}
                    height={60}
                    priority
                    unoptimized
                    style={{ width: 'auto', height: 'auto' }}
                    className="h-10 w-auto object-contain dark:hidden"
                  />
                  <Image
                    src="/brand/logo-dark.png"
                    alt="Sales Copilot"
                    width={180}
                    height={60}
                    priority
                    unoptimized
                    style={{ width: 'auto', height: 'auto' }}
                    className="hidden h-10 w-auto object-contain dark:block"
                  />
                </div>
                <h1 className="text-2xl font-bold tracking-tight">Tạo cửa hàng mới</h1>
                <p className="text-xs text-muted-foreground text-center">
                  Bắt đầu quản lý bán hàng đa kênh và kích hoạt AI Copilot cho doanh nghiệp của bạn
                </p>
              </div>

              {apiError && (
                <Alert variant="destructive" className="py-2.5 px-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription className="text-xs">{apiError}</AlertDescription>
                </Alert>
              )}

              <Field data-invalid={!!errors.workspaceName} data-disabled={isPending}>
                <FieldLabel htmlFor="workspaceName" className="text-xs font-medium">
                  Tên Shop / Doanh nghiệp
                </FieldLabel>
                <Input
                  id="workspaceName"
                  placeholder="Cửa hàng thời trang ABC"
                  aria-invalid={!!errors.workspaceName}
                  disabled={isPending}
                  {...register('workspaceName')}
                />
                {errors.workspaceName?.message && (
                  <FieldError>{errors.workspaceName.message}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.name} data-disabled={isPending}>
                <FieldLabel htmlFor="name" className="text-xs font-medium">
                  Họ và tên chủ shop
                </FieldLabel>
                <Input
                  id="name"
                  placeholder="Nguyễn Văn A"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  disabled={isPending}
                  {...register('name')}
                />
                {errors.name?.message && <FieldError>{errors.name.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.email} data-disabled={isPending}>
                <FieldLabel htmlFor="email" className="text-xs font-medium">
                  Email liên hệ
                </FieldLabel>
                <Input
                  id="email"
                  type="email"
                  placeholder="ban@congty.vn"
                  autoComplete="email"
                  aria-invalid={!!errors.email}
                  disabled={isPending}
                  {...register('email')}
                />
                {errors.email?.message && <FieldError>{errors.email.message}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.password} data-disabled={isPending}>
                <FieldLabel htmlFor="password" className="text-xs font-medium">
                  Mật khẩu
                </FieldLabel>
                <Input
                  id="password"
                  type="password"
                  placeholder="Ít nhất 6 ký tự"
                  autoComplete="new-password"
                  aria-invalid={!!errors.password}
                  disabled={isPending}
                  {...register('password')}
                />
                {errors.password?.message && <FieldError>{errors.password.message}</FieldError>}
              </Field>

              <div className="mt-2">
                <Button
                  type="submit"
                  size="default"
                  className="w-full font-medium shadow-sm"
                  disabled={isPending}
                >
                  {isPending && <Spinner data-icon="inline-start" />}
                  {isPending ? 'Đang tạo cửa hàng...' : 'Đăng ký cửa hàng'}
                </Button>
              </div>

              <FieldDescription className="text-center mt-2 text-xs">
                Đã có tài khoản?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Đăng nhập
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>

          {/* Right: Feature Showcase Panel */}
          <div className="relative hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-primary/15 via-primary/5 to-muted border-l border-border/60">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 w-fit">
                Khởi tạo miễn phí
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Tự động hóa bán hàng & Chăm sóc khách hàng đa kênh
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tạo cửa hàng của bạn ngay hôm nay để trải nghiệm trợ lý AI Copilot chốt đơn, đối
                soát VietQR và đồng bộ hội thoại thời gian thực.
              </p>
            </div>

            {/* Visual Illustration */}
            <div className="my-auto flex items-center justify-center py-3">
              <Image
                src="/auth-showcase.svg"
                alt="Sales Copilot Omnichannel Chat"
                width={300}
                height={220}
                priority
                className="max-h-48 w-auto object-contain drop-shadow-sm"
              />
            </div>

            <div className="flex flex-col gap-2.5 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-primary shrink-0" />
                <span>Mô hình 1 tài khoản = 1 shop khép kín & bảo mật</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-primary/80 shrink-0" />
                <span>Tạo tài khoản nhân viên nhanh chóng không cần link mời</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-primary/60 shrink-0" />
                <span>Trợ lý AI bán hàng và tự động lên đơn tự động</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <FieldDescription className="px-6 text-center text-xs text-muted-foreground">
        Bằng cách tiếp tục, bạn đồng ý với{' '}
        <Link href="#" className="underline hover:text-primary">
          Điều khoản Dịch vụ
        </Link>{' '}
        và{' '}
        <Link href="#" className="underline hover:text-primary">
          Chính sách Quyền riêng tư
        </Link>{' '}
        của chúng tôi.
      </FieldDescription>
    </div>
  );
}
