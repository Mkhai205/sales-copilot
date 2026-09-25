'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  workspacePaymentSettingsSchema,
  type WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { SettingsActionBar } from '../../layout/settings-action-bar';
import { useUpdateBankSettings } from '../hooks/use-bank-settings';
import { BankCombobox } from './bank-combobox';
import { LiveVietQrCard } from './live-vietqr-card';
import { isVietinBank, type VietnamBank } from '../constants/vietnam-banks';
import Link from 'next/link';

interface BankSettingsFormProps {
  workspaceId: string;
  workspaceSlug: string;
  initialSettings: WorkspacePaymentSettings;
}

export function BankSettingsForm({
  workspaceId,
  workspaceSlug,
  initialSettings,
}: BankSettingsFormProps) {
  const [showSecret, setShowSecret] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  const defaultValues: WorkspacePaymentSettings = React.useMemo(
    () => ({
      bankBin: initialSettings?.bankBin || '',
      bankCode: initialSettings?.bankCode || '',
      bankName: initialSettings?.bankName || '',
      accountNumber: initialSettings?.accountNumber || '',
      accountName: initialSettings?.accountName || '',
      webhookSecret: initialSettings?.webhookSecret || '',
    }),
    [
      initialSettings?.bankBin,
      initialSettings?.bankCode,
      initialSettings?.bankName,
      initialSettings?.accountNumber,
      initialSettings?.accountName,
      initialSettings?.webhookSecret,
    ],
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { isDirty, isValid, errors },
  } = useForm<WorkspacePaymentSettings>({
    resolver: zodResolver(workspacePaymentSettingsSchema),
    defaultValues,
    values: defaultValues,
    mode: 'onChange',
  });

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = React.useMemo(() => {
    const base = origin || 'https://sales-copilot.kakadev.xyz';
    return `${base}/api/v1/workspaces/${workspaceSlug}/webhooks/payments/sepay`;
  }, [origin, workspaceSlug]);

  const { mutate: updateSettings, isPending } = useUpdateBankSettings(workspaceId);

  const watchedValues = watch();
  const bankBin = watchedValues.bankBin || '';
  const bankCode = watchedValues.bankCode || '';
  const bankName = watchedValues.bankName || '';
  const accountNumber = watchedValues.accountNumber || '';
  const accountName = watchedValues.accountName || '';
  const webhookSecret = watchedValues.webhookSecret || '';

  const onSubmit = (data: WorkspacePaymentSettings) => {
    updateSettings(data, {
      onSuccess: updated => {
        reset(updated || data);
      },
    });
  };

  const handleReset = (e?: React.MouseEvent) => {
    e?.preventDefault();
    reset(defaultValues);
  };

  const handleSelectBank = (bank: VietnamBank) => {
    setValue('bankBin', bank.bin, { shouldDirty: true, shouldValidate: true });
    setValue('bankCode', bank.code, { shouldDirty: true, shouldValidate: true });
    setValue('bankName', bank.shortName, { shouldDirty: true, shouldValidate: true });
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success('Đã sao chép URL Webhook');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isVietin = isVietinBank(bankBin, bankCode, bankName);

  const isWebhookConfigured = Boolean(webhookSecret && webhookSecret.trim());

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
      {/* Card 1: Tài khoản ngân hàng thụ hưởng & Live VietQR */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Tài khoản ngân hàng thụ hưởng</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Thông tin tài khoản để sinh mã VietQR chuẩn NAPAS 247 khi khách thanh toán đơn hàng.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Cột trái: Form nhập liệu chuẩn Shadcn Fields (7 cols) */}
            <FieldGroup className="lg:col-span-7 flex flex-col gap-4">
              {/* Chọn ngân hàng */}
              <Field data-invalid={!!errors.bankBin}>
                <FieldLabel htmlFor="bank-bin">
                  Ngân hàng thụ hưởng <span className="text-destructive">*</span>
                </FieldLabel>
                <BankCombobox
                  selectedBin={bankBin}
                  onSelectBank={handleSelectBank}
                  disabled={isPending}
                />
                <FieldDescription>
                  Chọn ngân hàng phát hành thẻ/tài khoản theo mã chuẩn NAPAS.
                </FieldDescription>
                {errors.bankBin?.message && (
                  <FieldError errors={[{ message: errors.bankBin.message }]} />
                )}
              </Field>

              {/* Số tài khoản ngân hàng */}
              <Field data-invalid={!!errors.accountNumber}>
                <FieldLabel htmlFor="accountNumber">
                  Số tài khoản ngân hàng <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="accountNumber"
                  {...register('accountNumber')}
                  placeholder="Ví dụ: 103888325398"
                  className="text-xs font-mono h-10"
                  disabled={isPending}
                />
                <FieldDescription>
                  Số tài khoản ngân hàng thụ hưởng chính xác của doanh nghiệp hoặc chủ cửa hàng.
                </FieldDescription>
                {errors.accountNumber?.message && (
                  <FieldError errors={[{ message: errors.accountNumber.message }]} />
                )}
              </Field>

              {/* Tên chủ tài khoản */}
              <Field data-invalid={!!errors.accountName}>
                <FieldLabel htmlFor="accountName">
                  Tên chủ tài khoản <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="accountName"
                  {...register('accountName', {
                    onChange: e => {
                      e.target.value = e.target.value.toUpperCase();
                    },
                  })}
                  placeholder="NGUYEN VAN A (IN HOA KHÔNG DẤU)"
                  className="text-xs font-medium uppercase h-10"
                  disabled={isPending}
                />
                <FieldDescription>
                  Tên in trên thẻ/hồ sơ mở tài khoản ngân hàng (viết hoa không dấu).
                </FieldDescription>
                {errors.accountName?.message && (
                  <FieldError errors={[{ message: errors.accountName.message }]} />
                )}
              </Field>

              {/* Ghi chú VietinBank */}
              {isVietin && (
                <div className="flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                  <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>
                    Tài khoản VietinBank tự động được gắn tiền tố{' '}
                    <strong className="font-mono font-bold">SEVQR</strong> vào nội dung thanh toán
                    để đối soát số dư.
                  </span>
                </div>
              )}
            </FieldGroup>

            {/* Cột phải: Thẻ VietQR quét ngay tại chỗ (5 cols) */}
            <div className="lg:col-span-5 flex items-center justify-center w-full self-center">
              <LiveVietQrCard
                bankBin={bankBin}
                bankCode={bankCode}
                bankName={bankName}
                accountNumber={accountNumber}
                accountName={accountName}
                isVietinBank={isVietin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Tích hợp Webhook SePay (Stepper 3 bước tích hợp) */}
      <Card className="border-border bg-card/50">
        <CardHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <div>
                <CardTitle className="text-sm font-semibold">
                  Tích hợp Webhook SePay (Đối soát tự động)
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Quy trình kết nối 3 bước để tự động nhận biến động số dư và gạch nợ đơn hàng thời
                  gian thực.
                </CardDescription>
              </div>
            </div>
            {isWebhookConfigured ? (
              <Badge
                variant="outline"
                className="text-xs h-6 px-2.5 gap-1.5 font-normal border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Đã cấu hình Webhook
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs h-6 px-2.5 gap-1.5 font-normal border-muted text-muted-foreground bg-muted/40"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60" />
                Chờ cấu hình Secret
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Linear Stepper */}
          <div className="flex flex-col gap-6">
            {/* Bước 1: Mở SePay */}
            <div className="flex items-start gap-3.5">
              <div className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                1
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Tạo Webhook mới trên SePay
                  </h4>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Đăng nhập vào SePay, vào mục <strong>Tích hợp Webhook</strong> &gt; bấm{' '}
                    <strong>+ Thêm webhook</strong> cho tài khoản ngân hàng của bạn.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 text-xs gap-1.5 font-medium border-border/80 self-start"
                >
                  <Link
                    href="https://my.sepay.vn/webhooks"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở my.sepay.vn/webhooks <ExternalLink className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Bước 2: Dán Webhook URL */}
            <div className="flex items-start gap-3.5">
              <div className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                2
              </div>
              <div className="flex flex-col gap-2.5 flex-1">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Dán URL nhận Webhook &amp; Cấu hình sự kiện
                  </h4>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Dán URL dưới đây vào ô URL trên SePay. Đồng thời chọn Loại giao dịch:{' '}
                    <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      Tiền vào
                    </span>
                    , Định dạng dữ liệu:{' '}
                    <span className="font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                      JSON
                    </span>
                    .
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={webhookUrl}
                    className="text-xs font-mono bg-background select-all h-10 border-border/80"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleCopyWebhookUrl}
                    className="shrink-0 gap-1.5 h-10 text-xs px-4"
                  >
                    {copiedUrl ? (
                      <>
                        <Check className="size-3.5 text-emerald-600" />
                        Đã chép
                      </>
                    ) : (
                      <>
                        <Copy className="size-3.5" />
                        Sao chép URL
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            <Separator className="bg-border/40" />

            {/* Bước 3: Nhập Secret Key */}
            <div className="flex items-start gap-3.5">
              <div className="size-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                3
              </div>
              <FieldGroup className="flex flex-col gap-2.5 flex-1">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">
                    Lấy Secret Key &amp; Hoàn tất
                  </h4>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">
                    Tại tab <strong>Bảo mật</strong> trên SePay, chọn phương thức{' '}
                    <span className="font-mono text-primary font-medium text-[11px]">
                      HMAC-SHA256
                    </span>
                    . Sao chép chuỗi Secret Key và dán vào ô bên dưới:
                  </p>
                </div>
                <Field data-invalid={!!errors.webhookSecret}>
                  <div className="relative">
                    <Input
                      type={showSecret ? 'text' : 'password'}
                      {...register('webhookSecret')}
                      placeholder="Dán mã Secret Key từ tab Bảo mật của SePay vào đây"
                      className="text-xs font-mono pr-10 h-10 border-border/80"
                      disabled={isPending}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(prev => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  {errors.webhookSecret?.message && (
                    <FieldError errors={[{ message: errors.webhookSecret.message }]} />
                  )}
                  <FieldDescription className="flex items-center gap-1.5 pt-1">
                    <Sparkles className="size-3.5 text-amber-500 shrink-0" />
                    <span>
                      Sau khi lưu cấu hình, bạn có thể bấm nút <strong>&quot;Gửi thử&quot;</strong>{' '}
                      trên SePay để kiểm tra nhận biến động số dư tức thì.
                    </span>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </div>
          </div>
        </CardContent>
      </Card>

      <SettingsActionBar
        isDirty={isDirty}
        isPending={isPending}
        isValid={isValid}
        onCancel={handleReset}
        onSave={() => handleSubmit(onSubmit)()}
      />
    </form>
  );
}
