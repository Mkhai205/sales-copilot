'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bot, AlertCircle, Sparkles, Building2, Store, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import type { InboxDetailDto, InboxAiCommercePolicyConfig } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUpdateInbox } from '../hooks/use-inboxes';
import { useWorkspaces } from '@/features/identity/hooks/use-workspaces';
import { workspacesApi } from '@/features/identity/api/workspaces';
import { useI18n } from '@/lib/i18n';

interface TabAiSettingsProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug: string;
}

export function TabAiSettings({ inbox, workspaceId, workspaceSlug }: TabAiSettingsProps) {
  const { t } = useI18n();
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);

  // 1. Resolve workspace payment/bank settings
  const { data: workspaces, isLoading: isWorkspacesLoading } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.id === workspaceId || w.slug === workspaceSlug);

  const wsPaymentSettings = (currentWorkspace?.settings as Record<string, any> | undefined)
    ?.paymentSettings;
  const wsBankConfig = (currentWorkspace?.settings as Record<string, any> | undefined)?.bankConfig;

  // Additional query fallback if bank not in workspaces list
  const { data: fetchedBankConfig, isLoading: isBankConfigLoading } = useQuery({
    queryKey: ['workspace', workspaceId, 'bank-config'],
    queryFn: () =>
      workspacesApi
        .getBankConfig(workspaceId)
        .then(res => res.data)
        .catch(() => null),
    enabled: !wsPaymentSettings && !wsBankConfig && !!workspaceId,
    staleTime: 60 * 1000,
  });

  const isResolvingBank = Boolean(
    isWorkspacesLoading || (!wsPaymentSettings && !wsBankConfig && isBankConfigLoading),
  );
  const activeBank = wsPaymentSettings || wsBankConfig || fetchedBankConfig;
  const isBankConfigured = Boolean(
    (activeBank?.bankBin || activeBank?.bankName || activeBank?.bankId) &&
    (activeBank?.accountNumber || activeBank?.accountNo),
  );
  const bankDisplayName =
    activeBank?.bankName || activeBank?.bankCode || activeBank?.bankId || 'Ngân hàng';
  const bankAccountNo = activeBank?.accountNumber || activeBank?.accountNo || '';

  // 2. Policy state
  const policy = (inbox.settings?.aiCommercePolicy as InboxAiCommercePolicyConfig) || {};
  const isAiEnabled = policy.enabled === true;

  // Local form state
  const [personaTone, setPersonaTone] = React.useState(policy.personaTone || 'shop_ban');
  const [customInstructions, setCustomInstructions] = React.useState(
    policy.customInstructions || '',
  );
  const [maxDiscountPercent, setMaxDiscountPercent] = React.useState<string>(
    policy.maxDiscountPercent !== undefined ? String(policy.maxDiscountPercent) : '0',
  );
  const [maxDiscountVnd, setMaxDiscountVnd] = React.useState<string>(
    policy.maxDiscountVnd !== undefined ? String(policy.maxDiscountVnd) : '0',
  );
  const [noBankError, setNoBankError] = React.useState(false);

  // Keep a stable ref of current inputs to prevent concurrent save race conditions
  const latestStateRef = React.useRef({
    personaTone,
    customInstructions,
    maxDiscountPercent,
    maxDiscountVnd,
    isAiEnabled,
  });
  latestStateRef.current = {
    personaTone,
    customInstructions,
    maxDiscountPercent,
    maxDiscountVnd,
    isAiEnabled,
  };

  const lastSavedInstructionsRef = React.useRef(policy.customInstructions || '');
  const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync state only when switching inboxes to prevent server re-renders from wiping active user typing
  const prevInboxIdRef = React.useRef(inbox.id);
  React.useEffect(() => {
    if (prevInboxIdRef.current !== inbox.id) {
      prevInboxIdRef.current = inbox.id;
      const current = (inbox.settings?.aiCommercePolicy as InboxAiCommercePolicyConfig) || {};
      setPersonaTone(current.personaTone || 'shop_ban');
      setCustomInstructions(current.customInstructions || '');
      lastSavedInstructionsRef.current = current.customInstructions || '';
      setMaxDiscountPercent(
        current.maxDiscountPercent !== undefined ? String(current.maxDiscountPercent) : '0',
      );
      setMaxDiscountVnd(
        current.maxDiscountVnd !== undefined ? String(current.maxDiscountVnd) : '0',
      );
    }
  }, [inbox.id]);

  // Clean up debounce on unmount
  React.useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Helper to persist policy merging latest in-memory draft with incoming field changes
  const savePolicy = React.useCallback(
    (changes: Partial<InboxAiCommercePolicyConfig>, successMsg?: string) => {
      const current = latestStateRef.current;
      const nextPolicy: InboxAiCommercePolicyConfig = {
        enabled: current.isAiEnabled,
        personaTone: current.personaTone,
        customInstructions: current.customInstructions.trim(),
        maxDiscountPercent: Number(current.maxDiscountPercent) || 0,
        maxDiscountVnd: Number(current.maxDiscountVnd) || 0,
        ...changes,
      };

      updateInbox({
        inboxId: inbox.id,
        dto: {
          settings: {
            ...inbox.settings,
            aiCommercePolicy: nextPolicy,
          },
        },
        successMessage: successMsg || t('inboxes.ai.saved'),
      });
    },
    [inbox.id, inbox.settings, updateInbox, t],
  );

  // Handle Autopilot master toggle with full spec validation (Block cứng)
  const handleToggleAutopilot = (checked: boolean) => {
    if (checked) {
      if (isResolvingBank) return;
      if (!isBankConfigured) {
        setNoBankError(true);
        toast.error(t('inboxes.ai.enableBlockedNoBankAccount'));
        return;
      }
      if (customInstructions.length > 2000) {
        toast.error('Hướng dẫn bán hàng riêng không được vượt quá 2000 ký tự');
        return;
      }
      const discPercent = Number(maxDiscountPercent);
      if (isNaN(discPercent) || discPercent < 0 || discPercent > 100) {
        toast.error('Giảm giá tối đa (%) phải từ 0 đến 100%');
        return;
      }
      const discVnd = Number(maxDiscountVnd);
      if (isNaN(discVnd) || discVnd < 0) {
        toast.error('Giảm giá tối đa (VNĐ) phải lớn hơn hoặc bằng 0');
        return;
      }
      setNoBankError(false);
      savePolicy({ enabled: true }, 'Đã kích hoạt AI Autopilot');
    } else {
      setNoBankError(false);
      savePolicy({ enabled: false }, 'Đã tắt AI Autopilot');
    }
  };

  // Debounced custom instructions auto-save (safely slice to 2000 on paste)
  const handleCustomInstructionsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value.slice(0, 2000);
    setCustomInstructions(nextVal);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      lastSavedInstructionsRef.current = nextVal.trim();
      savePolicy({ customInstructions: nextVal.trim() });
    }, 600);
  };

  const handleCustomInstructionsBlur = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    const trimmed = customInstructions.trim();
    if (trimmed !== lastSavedInstructionsRef.current) {
      lastSavedInstructionsRef.current = trimmed;
      savePolicy({ customInstructions: trimmed });
    }
  };

  // Handle discount blur auto-save
  const handleDiscountPercentBlur = () => {
    let num = Number(maxDiscountPercent);
    if (isNaN(num) || num < 0) num = 0;
    if (num > 100) num = 100;
    setMaxDiscountPercent(String(num));
    if (num !== (policy.maxDiscountPercent ?? 0)) {
      savePolicy({ maxDiscountPercent: num });
    }
  };

  const handleDiscountVndBlur = () => {
    let num = Number(maxDiscountVnd);
    if (isNaN(num) || num < 0) num = 0;
    setMaxDiscountVnd(String(num));
    if (num !== (policy.maxDiscountVnd ?? 0)) {
      savePolicy({ maxDiscountVnd: num });
    }
  };

  // Persona tone change
  const handlePersonaToneChange = (val: string) => {
    setPersonaTone(val);
    savePolicy({ personaTone: val });
  };

  const PERSONA_OPTIONS = [
    {
      value: 'shop_ban',
      label: t('inboxes.ai.persona.shop_ban'),
      desc: t('inboxes.ai.persona.shop_ban_desc'),
    },
    {
      value: 'em_anh_chi',
      label: t('inboxes.ai.persona.em_anh_chi'),
      desc: t('inboxes.ai.persona.em_anh_chi_desc'),
    },
    {
      value: 'minh_ban',
      label: t('inboxes.ai.persona.minh_ban'),
      desc: t('inboxes.ai.persona.minh_ban_desc'),
    },
    {
      value: 'chuyen_vien',
      label: t('inboxes.ai.persona.chuyen_vien'),
      desc: t('inboxes.ai.persona.chuyen_vien_desc'),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header Card with Live Status Badge */}
      <Card className="border-border bg-card/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Bot className="size-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Trợ Lý Bán Hàng Tự Động (AI Autopilot)
                </CardTitle>
                <CardDescription className="text-xs">
                  Cấu hình trợ lý AI tự động tương tác, tư vấn sản phẩm, tính toán giảm giá và chốt
                  đơn cho hộp thư này.
                </CardDescription>
              </div>
            </div>
            <Badge
              variant="outline"
              className={
                isAiEnabled
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 gap-1.5 px-2.5 py-1'
                  : 'border-muted bg-muted/40 text-muted-foreground px-2.5 py-1'
              }
            >
              {isAiEnabled && <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />}
              {isAiEnabled ? t('inboxes.ai.statusActive') : t('inboxes.ai.statusInactive')}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Master Autopilot Toggle */}
          <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex flex-col gap-0.5 pr-4">
              <span className="text-xs font-semibold text-foreground">
                {t('inboxes.ai.enableToggle')}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {t('inboxes.ai.enableToggleDesc')}
              </span>
            </div>
            <Switch
              checked={isAiEnabled}
              onCheckedChange={handleToggleAutopilot}
              disabled={isUpdating || isResolvingBank}
            />
          </div>

          {/* Inline Bank Configuration Error Alert */}
          {noBankError && !isBankConfigured && (
            <div className="flex items-start gap-3 p-3.5 rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold">{t('inboxes.ai.enableBlockedNoBankAccount')}</span>
                <p className="text-[11px] text-destructive/90">
                  AI cần thông tin tài khoản ngân hàng để tạo mã QR chuyển khoản cho khách hàng khi
                  chốt đơn.
                </p>
                <Button
                  variant="link"
                  size="sm"
                  asChild
                  className="h-auto p-0 text-xs justify-start text-destructive underline font-semibold mt-1"
                >
                  <Link href={`/${workspaceSlug}/settings/bank`}>
                    Đi đến Cài đặt Tài khoản Ngân hàng (VietQR) →
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Configuration Settings Form (Disabled when AI is off) */}
      <Card
        className={`border-border bg-card/40 transition-opacity ${!isAiEnabled ? 'opacity-60' : ''}`}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Chính Sách & Phong Cách Bán Hàng
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Các thiết lập dưới đây được tự động lưu ngay khi bạn thay đổi (Auto-save).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <FieldGroup className="gap-5">
            {/* Persona Tone */}
            <Field>
              <FieldLabel className="text-xs font-medium">{t('inboxes.ai.personaTone')}</FieldLabel>
              <Select
                value={personaTone}
                onValueChange={handlePersonaToneChange}
                disabled={!isAiEnabled || isUpdating}
              >
                <SelectTrigger className="w-full h-auto py-2">
                  <SelectValue placeholder="Chọn giọng điệu">
                    {PERSONA_OPTIONS.find(p => p.value === personaTone)?.label || personaTone}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" className="w-full min-w-[320px]">
                  {PERSONA_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="py-2 cursor-pointer">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="font-medium text-foreground">{opt.label}</span>
                        <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription className="text-[11px] text-muted-foreground">
                Phong cách xưng hô và ngôn từ AI sẽ sử dụng khi trò chuyện với khách hàng.
              </FieldDescription>
            </Field>

            {/* Custom Instructions */}
            <Field>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="custom-instructions" className="text-xs font-medium">
                  {t('inboxes.ai.customInstructions')}
                </FieldLabel>
                <span
                  className={`text-[11px] ${
                    customInstructions.length > 1900
                      ? 'text-amber-500 font-medium'
                      : 'text-muted-foreground'
                  }`}
                >
                  {customInstructions.length}/2000
                </span>
              </div>
              <Textarea
                id="custom-instructions"
                rows={4}
                maxLength={2000}
                value={customInstructions}
                onChange={handleCustomInstructionsChange}
                onBlur={handleCustomInstructionsBlur}
                disabled={!isAiEnabled || isUpdating}
                placeholder={t('inboxes.ai.customInstructionsPlaceholder')}
                className="text-xs min-h-[96px] resize-y"
              />
              <FieldDescription className="text-[11px] text-muted-foreground">
                Gợi ý kịch bản, chính sách khuyến mãi hoặc thông điệp riêng cho AI (tối đa 2.000 ký
                tự). Tự động lưu khi bạn dừng gõ.
              </FieldDescription>
            </Field>

            {/* Discount Limits (2 Columns) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Max Discount % */}
              <Field>
                <FieldLabel htmlFor="max-discount-percent" className="text-xs font-medium">
                  {t('inboxes.ai.maxDiscountPercent')}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="max-discount-percent"
                    type="number"
                    min={0}
                    max={100}
                    value={maxDiscountPercent}
                    onChange={e => setMaxDiscountPercent(e.target.value)}
                    onBlur={handleDiscountPercentBlur}
                    disabled={!isAiEnabled || isUpdating}
                    className="pr-8 text-xs font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    %
                  </span>
                </div>
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Hạn mức chiết khấu tối đa AI được tự động áp dụng (0 - 100%).
                </FieldDescription>
              </Field>

              {/* Max Discount VND */}
              <Field>
                <FieldLabel htmlFor="max-discount-vnd" className="text-xs font-medium">
                  {t('inboxes.ai.maxDiscountVnd')}
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="max-discount-vnd"
                    type="number"
                    min={0}
                    step={1000}
                    value={maxDiscountVnd}
                    onChange={e => setMaxDiscountVnd(e.target.value)}
                    onBlur={handleDiscountVndBlur}
                    disabled={!isAiEnabled || isUpdating}
                    className="pr-8 text-xs font-mono"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                    đ
                  </span>
                </div>
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Hạn mức chiết khấu tối đa theo số tiền tuyệt đối.
                </FieldDescription>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* 3. Read-only System Resources Information */}
      <Card className="border-border bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Thông Tin Hệ Thống Phục Vụ Bán Hàng (Chỉ đọc)
          </CardTitle>
          <CardDescription className="text-xs">
            AI tham chiếu các cấu hình hệ thống này để kiểm tra tồn kho và sinh mã thanh toán VietQR
            khi chốt đơn.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-xs">
          {/* Warehouse item */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-background/60">
            <div className="flex items-center gap-2.5">
              <Store className="size-4 text-primary shrink-0" />
              <div className="flex flex-col">
                <span className="font-medium text-foreground">{t('inboxes.ai.warehouseInfo')}</span>
                <span className="text-[11px] text-muted-foreground">
                  Kho chính (Hệ thống kho tập trung)
                </span>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-medium gap-1"
            >
              <Check className="size-2.5" />
              Sẵn sàng
            </Badge>
          </div>

          {/* VietQR Bank Account item */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border/80 bg-background/60">
            <div className="flex items-center gap-2.5 min-w-0">
              <Building2 className="size-4 text-primary shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-foreground">{t('inboxes.ai.bankInfo')}</span>
                {isBankConfigured ? (
                  <span className="text-[11px] text-foreground font-mono truncate">
                    {bankDisplayName} • {bankAccountNo}
                  </span>
                ) : (
                  <span className="text-[11px] text-destructive font-medium">
                    {t('inboxes.ai.bankNotConfigured')}
                  </span>
                )}
              </div>
            </div>
            {isBankConfigured ? (
              <Badge
                variant="outline"
                className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 font-medium gap-1 shrink-0"
              >
                <Check className="size-2.5" />
                Đã kết nối
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-7 text-xs gap-1 border-primary/40 text-primary hover:bg-primary/10 shrink-0"
              >
                <Link href={`/${workspaceSlug}/settings/bank`}>Cấu hình ngay →</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
