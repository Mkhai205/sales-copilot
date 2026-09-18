'use client';

import * as React from 'react';
import {
  workspacePaymentSettingsSchema,
  type WorkspacePaymentSettings,
} from '@sales-copilot/shared-contracts';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useWorkspaces } from '@/features/identity/hooks/use-workspaces';
import { workspacesApi } from '@/features/identity/api/workspaces';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

export default function BankSettingsPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const queryClient = useQueryClient();

  const [formData, setFormData] = React.useState<WorkspacePaymentSettings>({
    bankBin: '',
    bankCode: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    webhookSecret: '',
  });

  const { data: bankConfig, isLoading } = useQuery<WorkspacePaymentSettings>({
    queryKey: ['workspace', currentWorkspace?.id, 'bank-config'],
    queryFn: () => workspacesApi.getBankConfig(currentWorkspace!.id).then(res => res.data),
    enabled: !!currentWorkspace?.id,
    retry: false,
  });

  React.useEffect(() => {
    if (bankConfig) {
      setFormData({
        bankBin: bankConfig.bankBin || '',
        bankCode: bankConfig.bankCode || '',
        bankName: bankConfig.bankName || '',
        accountNumber: bankConfig.accountNumber || '',
        accountName: bankConfig.accountName || '',
        webhookSecret: bankConfig.webhookSecret || '',
      });
    }
  }, [bankConfig]);

  const updateMutation = useMutation({
    mutationFn: async (data: WorkspacePaymentSettings) => {
      const res = await workspacesApi.updateBankConfig(currentWorkspace!.id, data);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Cập nhật cấu hình ngân hàng thành công');
      queryClient.invalidateQueries({
        queryKey: ['workspace', currentWorkspace?.id, 'bank-config'],
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Page Header */}
      <div className="pb-3 border-b border-border/70">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {'Ngân hàng & Thanh toán'}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {
            'Cấu hình tài khoản ngân hàng để tạo mã VietQR chuẩn NAPAS 247 và tích hợp webhook đối soát tự động.'
          }
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin tài khoản ngân hàng</CardTitle>
            <CardDescription>
              Cung cấp mã BIN và thông tin tài khoản ngân hàng. Dữ liệu này dùng để tạo mã VietQR
              chuẩn NAPAS 247.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Mã ngân hàng (BIN)</label>
                <Input
                  name="bankBin"
                  value={formData.bankBin}
                  onChange={handleChange}
                  placeholder="Ví dụ: 970415 (Vietinbank)"
                  className="text-xs"
                />
                <p className="text-[10.5px] text-muted-foreground">
                  Mã định danh BIN gồm 6 chữ số của ngân hàng (Ví dụ: 970415 cho VietinBank, 970436
                  cho Vietcombank).
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tên ngân hàng (Tùy chọn)</label>
                <Input
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleChange}
                  placeholder="Ví dụ: Vietinbank"
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Số tài khoản</label>
                <Input
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleChange}
                  placeholder="Ví dụ: 113366668888"
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tên chủ tài khoản</label>
                <Input
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder="Ví dụ: NGUYEN VAN A"
                  className="text-xs"
                />
                <p className="text-[10.5px] text-muted-foreground">
                  Tên chính xác đã đăng ký với tài khoản ngân hàng.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tích hợp SePay</CardTitle>
            <CardDescription>
              Cấu hình mã bí mật Webhook để tự động đối soát giao dịch thanh toán qua SePay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-xl">
              <label className="text-sm font-medium">Mã bí mật SePay Webhook (Tùy chọn)</label>
              <Input
                type="password"
                name="webhookSecret"
                value={formData.webhookSecret}
                onChange={handleChange}
                placeholder="Nhập mã bí mật tại đây"
                className="text-xs font-mono"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Dùng để xác thực tính hợp lệ của các yêu cầu webhook từ SePay.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Lưu cấu hình
          </Button>
        </div>
      </form>
    </div>
  );
}
