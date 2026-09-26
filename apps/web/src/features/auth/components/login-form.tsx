'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useForm, useWatch, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircleIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  HeadphonesIcon,
  SparklesIcon,
} from 'lucide-react';
import { loginSchema, type LoginDto } from '@sales-copilot/shared-contracts';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { loginAction } from '../actions/auth-actions';

const TEST_ACCOUNTS = [
  {
    role: 'Super Admin',
    name: 'Super Administrator',
    email: 'superadmin@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: ShieldCheckIcon,
    roleTitle: 'Quản trị cấp cao',
  },
  {
    role: 'Admin',
    name: 'Workspace Admin',
    email: 'admin@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: UserCheckIcon,
    roleTitle: 'Quản trị viên',
  },
  {
    role: 'Agent',
    name: 'Sarah Agent',
    email: 'agent@salescopilot.io',
    password: 'SalesCopilot@2026!',
    icon: HeadphonesIcon,
    roleTitle: 'Chuyên viên CSKH',
  },
] as const;

interface QuickTestAccountsProps {
  control: Control<LoginDto>;
  onSelectAccount: (account: (typeof TEST_ACCOUNTS)[number]) => void;
  disabled: boolean;
}

/**
 * Isolated sub-component subscribing to email value via useWatch.
 * Prevents the entire LoginForm and illustration panels from re-rendering on every keystroke.
 */
function QuickTestAccounts({ control, onSelectAccount, disabled }: QuickTestAccountsProps) {
  const emailValue = useWatch({ control, name: 'email' });

  return (
    <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
        <SparklesIcon className="size-3 text-primary" />
        <span>Tài khoản thử nghiệm nhanh</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {TEST_ACCOUNTS.map(acc => {
          const Icon = acc.icon;
          const isSelected = emailValue === acc.email;
          return (
            <button
              key={acc.email}
              type="button"
              onClick={() => onSelectAccount(acc)}
              disabled={disabled}
              className={cn(
                'flex items-center justify-center gap-1 p-2 text-[11px] rounded-md border transition-all hover:border-primary/50 hover:bg-muted/50',
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : 'border-border/60 bg-card/60',
              )}
            >
              <Icon className="size-4 text-primary" />
              {acc.roleTitle}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LoginForm({ className, ...props }: React.ComponentProps<'div'>) {
  const queryClient = useQueryClient();
  const [apiError, setApiError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const { mutate: login, isPending } = useMutation({
    mutationFn: async (formData: LoginDto) => {
      setApiError(null);
      return await loginAction(formData);
    },
    onSuccess: result => {
      if (result && !result.success && result.error) {
        setApiError(
          result.error.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin tài khoản.',
        );
        return;
      }
      // Clear cache strictly upon successful authentication
      queryClient.clear();
    },
    onError: (err: any) => {
      if (err?.digest?.startsWith('NEXT_REDIRECT') || err?.message === 'NEXT_REDIRECT') {
        return;
      }
      setApiError(err?.message || 'Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.');
    },
  });

  const handleSelectTestAccount = (account: (typeof TEST_ACCOUNTS)[number]) => {
    setValue('email', account.email, { shouldValidate: true });
    setValue('password', account.password, { shouldValidate: true });
    setApiError(null);
  };

  return (
    <div className={cn('flex flex-col gap-6 w-full', className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-lg border-border/80 bg-card">
        <CardContent className="grid p-0 md:grid-cols-2">
          {/* Left: Form */}
          <form
            onSubmit={handleSubmit(data => login(data))}
            className="p-6 sm:p-8 flex flex-col justify-center"
          >
            <FieldGroup>
              <div className="flex flex-col items-center gap-2 mb-2">
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
                <h1 className="text-2xl font-bold tracking-tight">Chào mừng bạn quay lại</h1>
                <p className="text-xs text-muted-foreground text-center">
                  Đăng nhập để truy cập hộp thư đa kênh và trợ lý hội thoại của bạn
                </p>
              </div>

              {apiError && (
                <Alert variant="destructive" className="py-2.5 px-3">
                  <AlertCircleIcon className="size-4" />
                  <AlertDescription className="text-xs">{apiError}</AlertDescription>
                </Alert>
              )}

              <Field data-invalid={!!errors.email} data-disabled={isPending}>
                <FieldLabel htmlFor="email" className="text-xs font-medium">
                  Email công việc
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
                <div className="flex items-center justify-between w-full">
                  <FieldLabel htmlFor="password" className="text-xs font-medium">
                    Mật khẩu
                  </FieldLabel>
                  <Link
                    href="#"
                    className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
                  >
                    Quên mật khẩu?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
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
                  {isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
                </Button>
              </div>

              {/* Quick Test Accounts Section */}
              <QuickTestAccounts
                control={control}
                onSelectAccount={handleSelectTestAccount}
                disabled={isPending}
              />

              <FieldDescription className="text-center mt-1 text-xs">
                Chưa có tài khoản?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Đăng ký
                </Link>
              </FieldDescription>
            </FieldGroup>
          </form>

          {/* Right: Feature Showcase Panel */}
          <div className="relative hidden md:flex flex-col justify-between p-8 bg-gradient-to-br from-primary/15 via-primary/5 to-muted border-l border-border/60">
            <div className="flex flex-col gap-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/15 text-primary border border-primary/20 w-fit">
                Nền tảng Đa kênh
              </div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Hội thoại Khách hàng Thống nhất & AI Sales Copilot
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Kết nối Facebook, Zalo, Telegram, Email và Web Chat trong một hộp thư thời gian thực
                duy nhất.
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
                <span>Luồng sự kiện WebSocket thời gian thực</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-primary/80 shrink-0" />
                <span>Cô lập không gian làm việc đa người thuê (Multi-tenant)</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                <div className="size-2 rounded-full bg-primary/60 shrink-0" />
                <span>Tự động phân bổ tư vấn viên & tin nhắn mẫu thông minh</span>
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
