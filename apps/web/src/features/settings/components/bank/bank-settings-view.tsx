'use client';

import * as React from 'react';
import {
  workspacePaymentSettingsSchema,
  type WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Landmark,
  Loader2,
  Lock,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { SettingsGuard } from '../settings-guard';
import { useWorkspaces } from '../../hooks/use-workspaces';
import { workspacesApi } from '../../api/workspaces';
import { workspaceKeys } from '@/lib/query-keys';
import { BankCombobox } from './bank-combobox';
import { LiveVietQrCard } from './live-vietqr-card';
import type { VietnamBank } from '../../constants/vietnam-banks';

interface BankSettingsViewProps {
  workspaceSlug: string;
}

const DEFAULT_FORM_VALUES: WorkspacePaymentSettings = {
  bankBin: '',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  webhookSecret: '',
};

export function BankSettingsView({ workspaceSlug }: BankSettingsViewProps) {
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const queryClient = useQueryClient();

  const [formData, setFormData] = React.useState<WorkspacePaymentSettings>(DEFAULT_FORM_VALUES);
  const [initialData, setInitialData] =
    React.useState<WorkspacePaymentSettings>(DEFAULT_FORM_VALUES);

  const [showSecret, setShowSecret] = React.useState(false);
  const [copiedUrl, setCopiedUrl] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const webhookUrl = React.useMemo(() => {
    const base = origin || 'https://sales-copilot.kakadev.xyz';
    return `${base}/api/v1/workspaces/${workspaceSlug}/webhooks/payments/sepay`;
  }, [origin, workspaceSlug]);

  const { data: bankConfig, isLoading } = useQuery<WorkspacePaymentSettings>({
    queryKey: workspaceKeys.bankConfig(currentWorkspace?.id),
    queryFn: () => workspacesApi.getBankConfig(currentWorkspace!.id).then(res => res.data),
    enabled: !!currentWorkspace?.id,
    retry: false,
  });

  React.useEffect(() => {
    if (bankConfig) {
      const loaded: WorkspacePaymentSettings = {
        bankBin: bankConfig.bankBin || '',
        bankCode: bankConfig.bankCode || '',
        bankName: bankConfig.bankName || '',
        accountNumber: bankConfig.accountNumber || '',
        accountName: bankConfig.accountName || '',
        webhookSecret: bankConfig.webhookSecret || '',
      };
      setFormData(loaded);
      setInitialData(loaded);
    }
  }, [bankConfig]);

  const isDirty = React.useMemo(() => {
    return (
      formData.bankBin !== initialData.bankBin ||
      formData.bankCode !== initialData.bankCode ||
      formData.bankName !== initialData.bankName ||
      formData.accountNumber !== initialData.accountNumber ||
      formData.accountName !== initialData.accountName ||
      formData.webhookSecret !== initialData.webhookSecret
    );
  }, [formData, initialData]);

  const updateMutation = useMutation({
    mutationFn: async (data: WorkspacePaymentSettings) => {
      const res = await workspacesApi.updateBankConfig(currentWorkspace!.id, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Cập nhật cấu hình thanh toán thành công');
      setInitialData({ ...formData });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.bankConfig(currentWorkspace?.id),
      });
    },
    onError: (error: any) => {
      toast.error(
        'Cập nhật cấu hình ngân hàng thất bại: ' + (error.message || 'Lỗi không xác định'),
      );
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = workspacePaymentSettingsSchema.safeParse(formData);
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Lỗi xác thực dữ liệu');
      return;
    }
    updateMutation.mutate(result.data);
  }

  const handleReset = () => {
    setFormData(initialData);
  };

  const handleSelectBank = (bank: VietnamBank) => {
    setFormData(prev => ({
      ...prev,
      bankBin: bank.bin,
      bankCode: bank.code,
      bankName: bank.shortName,
    }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'accountName') {
      setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleCopyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedUrl(true);
    toast.success('Đã sao chép URL Webhook');
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const isVietinBank =
    formData.bankBin === '970415' ||
    formData.bankCode?.toUpperCase() === 'CTG' ||
    formData.bankCode?.toUpperCase() === 'ICB' ||
    formData.bankName?.toLowerCase().includes('vietin');

  const isWebhookConfigured = Boolean(formData.webhookSecret && formData.webhookSecret.trim());

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="bank">
      <div className="flex flex-col flex-1 h-full overflow-y-auto bg-background p-6">
        <div className="max-w-5xl mx-auto w-full flex flex-col gap-6">
          <PageHeader
            title="Ngân hàng & Thanh toán VietQR"
            description="Cấu hình tài khoản ngân hàng nhận tiền qua mã VietQR (NAPAS 247) và đối soát tự động qua SePay Webhook."
            icon={Landmark}
          />

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-6 w-full">
              {/* Card 1: Tài khoản ngân hàng thụ hưởng & Live VietQR */}
              <Card className="border-border bg-card/50">
                <CardHeader className="pb-4 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    <div>
                      <CardTitle className="text-sm font-semibold">
                        Tài khoản ngân hàng thụ hưởng
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        Thông tin tài khoản để sinh mã VietQR chuẩn NAPAS 247 khi khách thanh toán
                        đơn hàng.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Cột trái: Form nhập liệu (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Chọn ngân hàng */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Ngân hàng thụ hưởng <span className="text-destructive">*</span>
                        </label>
                        <BankCombobox
                          selectedBin={formData.bankBin}
                          onSelectBank={handleSelectBank}
                          disabled={updateMutation.isPending}
                        />
                      </div>

                      {/* Số tài khoản ngân hàng */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Số tài khoản ngân hàng <span className="text-destructive">*</span>
                        </label>
                        <Input
                          name="accountNumber"
                          value={formData.accountNumber}
                          onChange={handleChange}
                          placeholder="Ví dụ: 103888325398"
                          className="text-xs font-mono h-10"
                          disabled={updateMutation.isPending}
                        />
                      </div>

                      {/* Tên chủ tài khoản */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">
                          Tên chủ tài khoản <span className="text-destructive">*</span>
                        </label>
                        <Input
                          name="accountName"
                          value={formData.accountName}
                          onChange={handleChange}
                          placeholder="NGUYEN VAN A (IN HOA KHÔNG DẤU)"
                          className="text-xs font-medium uppercase h-10"
                          disabled={updateMutation.isPending}
                        />
                      </div>

                      {/* Ghi chú VietinBank */}
                      {isVietinBank && (
                        <div className="flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/30 px-3 py-2 text-xs text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60">
                          <Info className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                          <span>
                            Tài khoản VietinBank tự động được gắn tiền tố{' '}
                            <strong className="font-mono font-bold">SEVQR</strong> vào nội dung
                            thanh toán để đối soát số dư.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Cột phải: Thẻ VietQR quét ngay tại chỗ (5 cols) */}
                    <div className="lg:col-span-5 flex items-center justify-center w-full self-center">
                      <LiveVietQrCard
                        bankBin={formData.bankBin}
                        bankCode={formData.bankCode}
                        bankName={formData.bankName}
                        accountNumber={formData.accountNumber}
                        accountName={formData.accountName}
                        isVietinBank={isVietinBank}
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
                          Quy trình kết nối 3 bước để tự động nhận biến động số dư và gạch nợ đơn
                          hàng thời gian thực.
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
                <CardContent>
                  {/* Linear Stepper */}
                  <div className="space-y-6">
                    {/* Bước 1: Mở SePay */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        1
                      </div>
                      <div className="space-y-2 flex-1">
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
                          className="h-8 text-xs gap-1.5 font-medium border-border/80"
                        >
                          <a
                            href="https://my.sepay.vn/webhooks"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Mở my.sepay.vn/webhooks <ExternalLink className="w-3 h-3" />
                          </a>
                        </Button>
                      </div>
                    </div>

                    <Separator className="bg-border/40" />

                    {/* Bước 2: Dán Webhook URL */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        2
                      </div>
                      <div className="space-y-2.5 flex-1">
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
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                Đã chép
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
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
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        3
                      </div>
                      <div className="space-y-2.5 flex-1">
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
                        <div className="relative">
                          <Input
                            type={showSecret ? 'text' : 'password'}
                            name="webhookSecret"
                            value={formData.webhookSecret || ''}
                            onChange={handleChange}
                            placeholder="Dán mã Secret Key từ tab Bảo mật của SePay vào đây"
                            className="text-xs font-mono pr-10 h-10 border-border/80"
                            disabled={updateMutation.isPending}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(prev => !prev)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                          >
                            {showSecret ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground pt-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>
                            Sau khi lưu cấu hình, bạn có thể bấm nút{' '}
                            <strong>&quot;Gửi thử&quot;</strong> trên SePay để kiểm tra nhận biến
                            động số dư tức thì.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Footer */}
              <Separator />

              <div className="flex items-center justify-end gap-3 pb-8">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={!isDirty || updateMutation.isPending}
                  className="text-xs gap-1.5"
                >
                  <RotateCcw className="size-3.5" />
                  Hủy
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={!isDirty || updateMutation.isPending}
                  className="text-xs font-medium gap-2"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Save className="size-3.5" />
                      Lưu thay đổi
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </SettingsGuard>
  );
}
