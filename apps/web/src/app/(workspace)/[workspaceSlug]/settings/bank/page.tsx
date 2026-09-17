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
      toast.success('Bank configuration updated successfully');
      queryClient.invalidateQueries({
        queryKey: ['workspace', currentWorkspace?.id, 'bank-config'],
      });
    },
    onError: (error: any) => {
      toast.error('Failed to update bank configuration: ' + (error.message || 'Unknown error'));
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const result = workspacePaymentSettingsSchema.safeParse(formData);
    if (!result.success) {
      toast.error(result.error.errors[0]?.message || 'Validation error');
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Bank & Payment</h3>
        <p className="text-sm text-muted-foreground">
          Configure your bank account for generating VietQR codes and integrating SePay webhooks.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bank Account Information</CardTitle>
            <CardDescription>
              Provide the bank BIN and account details. This will be used to generate NAPAS 247
              VietQR codes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bank ID (BIN)</label>
              <Input
                name="bankBin"
                value={formData.bankBin}
                onChange={handleChange}
                placeholder="e.g. 970415 (Vietinbank)"
              />
              <p className="text-[10.5px] text-muted-foreground">
                The 6-digit BIN code of the bank (e.g., 970415 for VietinBank, 970436 for
                Vietcombank).
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Bank Name (Optional)</label>
              <Input
                name="bankName"
                value={formData.bankName}
                onChange={handleChange}
                placeholder="e.g. Vietinbank"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Number</label>
              <Input
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
                placeholder="e.g. 113366668888"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Account Name</label>
              <Input
                name="accountName"
                value={formData.accountName}
                onChange={handleChange}
                placeholder="e.g. QUY VAC XIN PHONG CHONG COVID"
              />
              <p className="text-[10.5px] text-muted-foreground">
                The exact name registered with the bank account.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>SePay Integration</CardTitle>
            <CardDescription>
              Configure Webhook Secret to automatically reconcile payments via SePay.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label className="text-sm font-medium">SePay Webhook Secret (Optional)</label>
              <Input
                type="password"
                name="webhookSecret"
                value={formData.webhookSecret}
                onChange={handleChange}
                placeholder="Enter your secret here"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Used to verify the authenticity of SePay webhook requests.
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
            Save Configuration
          </Button>
        </div>
      </form>
    </div>
  );
}
