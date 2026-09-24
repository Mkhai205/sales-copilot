'use client';

import * as React from 'react';
import { Landmark } from 'lucide-react';
import type { WorkspacePaymentSettings } from '@sales-copilot/shared-contracts';
import { SettingsPageLayout } from '../layout/settings-page-layout';
import { useSettingsRbac } from '../rbac/use-settings-rbac';
import { useBankSettings } from './hooks/use-bank-settings';
import { BankSettingsForm } from './components/bank-settings-form';

interface BankSettingsViewProps {
  workspaceSlug: string;
}

const DEFAULT_BANK_SETTINGS: WorkspacePaymentSettings = {
  bankBin: '',
  bankCode: '',
  bankName: '',
  accountNumber: '',
  accountName: '',
  webhookSecret: '',
};

export function BankSettingsView({ workspaceSlug }: BankSettingsViewProps) {
  const { currentWorkspace, isLoading: isRbacLoading } = useSettingsRbac(workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  const { data: bankConfig, isLoading: isConfigLoading } = useBankSettings(workspaceId);

  const isLoading = isRbacLoading || !workspaceId || isConfigLoading;

  return (
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="bank"
      title="Ngân hàng & Thanh toán VietQR"
      description="Cấu hình tài khoản ngân hàng nhận tiền qua mã VietQR (NAPAS 247) và đối soát tự động qua SePay Webhook."
      icon={Landmark}
      isLoading={isLoading}
      skeletonVariant="form"
    >
      {workspaceId && (
        <BankSettingsForm
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
          initialSettings={bankConfig || DEFAULT_BANK_SETTINGS}
        />
      )}
    </SettingsPageLayout>
  );
}
