'use client';

import * as React from 'react';
import { Bot, Building2, Check, CreditCard, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AiCommerceOperatingMode,
  InboxAiCommercePolicyConfig,
  InboxDetailDto,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateInbox } from '../hooks/use-inboxes';

interface TabAiCommercePolicyProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

export function TabAiCommercePolicy({ inbox, workspaceId }: TabAiCommercePolicyProps) {
  const { mutate: updateInbox, isPending: isSaving } = useUpdateInbox(workspaceId);

  const existingPolicy = inbox.settings?.aiCommercePolicy as
    InboxAiCommercePolicyConfig | undefined;

  const [mode, setMode] = React.useState<AiCommerceOperatingMode>(
    existingPolicy?.mode || 'COPILOT_ASSIST',
  );
  const [personaTone, setPersonaTone] = React.useState<string>(
    existingPolicy?.personaTone || 'shop_ban',
  );
  const [maxDiscountPercent, setMaxDiscountPercent] = React.useState<number | string>(
    existingPolicy?.maxDiscountPercent ?? 10,
  );
  const [maxDiscountVnd, setMaxDiscountVnd] = React.useState<number | string>(
    existingPolicy?.maxDiscountVnd ?? 100000,
  );
  const [defaultWarehouseId, setDefaultWarehouseId] = React.useState<string>(
    existingPolicy?.defaultWarehouseId || 'wh_default_hcm',
  );
  const [defaultBankAccountId, setDefaultBankAccountId] = React.useState<string>(
    existingPolicy?.defaultBankAccountId || 'bank_default_vietqr',
  );

  React.useEffect(() => {
    const policy = inbox.settings?.aiCommercePolicy as InboxAiCommercePolicyConfig | undefined;
    if (policy) {
      setMode(policy.mode || 'COPILOT_ASSIST');
      setPersonaTone(policy.personaTone || 'shop_ban');
      setMaxDiscountPercent(policy.maxDiscountPercent ?? 10);
      setMaxDiscountVnd(policy.maxDiscountVnd ?? 100000);
      setDefaultWarehouseId(policy.defaultWarehouseId || 'wh_default_hcm');
      setDefaultBankAccountId(policy.defaultBankAccountId || 'bank_default_vietqr');
    }
  }, [inbox]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const discountPct = Number(maxDiscountPercent);
    if (isNaN(discountPct) || discountPct < 0 || discountPct > 100) {
      toast.error('Chiết khấu tối đa theo % phải nằm trong khoảng từ 0% đến 100%');
      return;
    }

    const discountVnd = Number(maxDiscountVnd);
    if (isNaN(discountVnd) || discountVnd < 0) {
      toast.error('Chiết khấu tối đa theo số tiền (VND) không được là số âm');
      return;
    }

    const policy: InboxAiCommercePolicyConfig = {
      mode,
      personaTone,
      maxDiscountPercent: discountPct,
      maxDiscountVnd: discountVnd,
      defaultWarehouseId,
      defaultBankAccountId,
    };

    const updatedSettings = {
      ...(inbox.settings || {}),
      aiCommercePolicy: policy,
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        settings: updatedSettings,
      },
      successMessage: 'Đã lưu cấu hình AI Auto-pilot & Chính sách bán hàng',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Banner: Tính năng cần triển khai trong Phase 2 */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4.5 text-amber-900 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">
                AI Auto-pilot & Guarded Discount Policy Engine
              </span>
              <Badge
                variant="outline"
                className="border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-semibold uppercase tracking-wider"
              >
                Tính năng cần triển khai trong Phase 2
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Đây là kiến trúc cốt lõi của Sales Copilot Phase 2 (In-Chat POS & AI Auto-pilot
              Midnight Checkout). Bạn có thể cấu hình trước các tham số và chính sách bảo vệ dưới
              đây. Engine xử lý backend sẽ tự động áp dụng khi module hoàn tất triển khai.
            </p>
          </div>
        </div>
      </div>

      <Card className="border-border bg-card/40">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-primary" />
            <CardTitle className="text-base font-semibold">
              Chế độ hoạt động của AI (Operating Mode)
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Xác định mức độ tự chủ của trợ lý AI đối với các cuộc hội thoại trong hộp thư này.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="flex flex-col gap-6">
            {/* Mode selection cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* Copilot Assist */}
              <div
                onClick={() => setMode('COPILOT_ASSIST')}
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                  mode === 'COPILOT_ASSIST'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                    : 'border-border bg-card/30 hover:border-border/80 hover:bg-card/60'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Trợ lý Copilot</span>
                    {mode === 'COPILOT_ASSIST' && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    AI chỉ phân tích tin nhắn, gợi ý câu trả lời và soạn đơn nháp. Nhân viên kiểm
                    tra và bấm gửi.
                  </p>
                </div>
                <Badge variant="secondary" className="mt-3 w-fit text-[10px] font-normal">
                  Khuyên dùng
                </Badge>
              </div>

              {/* Autopilot 24/7 */}
              <div
                onClick={() => setMode('AUTOPILOT_24_7')}
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                  mode === 'AUTOPILOT_24_7'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                    : 'border-border bg-card/30 hover:border-border/80 hover:bg-card/60'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Auto-pilot 24/7</span>
                    {mode === 'AUTOPILOT_24_7' && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    AI tự động trả lời 100%, tư vấn thông tin sản phẩm, áp dụng khuyến mãi và gửi mã
                    VietQR chốt đơn.
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="mt-3 w-fit text-[10px] font-normal border-primary/30 text-primary"
                >
                  Tự động hoàn toàn
                </Badge>
              </div>

              {/* Hybrid Off-hours */}
              <div
                onClick={() => setMode('HYBRID_OFF_HOURS')}
                className={`flex flex-col justify-between rounded-xl border p-4 cursor-pointer transition-all ${
                  mode === 'HYBRID_OFF_HOURS'
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-xs'
                    : 'border-border bg-card/30 hover:border-border/80 hover:bg-card/60'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground">Hybrid Ban đêm</span>
                    {mode === 'HYBRID_OFF_HOURS' && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ban ngày nhân viên trực trả lời. Ban đêm ngoài giờ làm việc, AI tự động kích
                    hoạt chốt đơn (Midnight Checkout).
                  </p>
                </div>
                <Badge variant="secondary" className="mt-3 w-fit text-[10px] font-normal">
                  Chốt đơn ban đêm
                </Badge>
              </div>
            </div>

            <FieldGroup className="gap-5 pt-2 border-t border-border/60">
              {/* Persona & Tone */}
              <Field>
                <FieldLabel htmlFor="persona-select" className="text-xs font-medium">
                  Phong cách xưng hô (Tone & Persona)
                </FieldLabel>
                <Select value={personaTone} onValueChange={setPersonaTone}>
                  <SelectTrigger id="persona-select" className="h-9 text-xs max-w-sm">
                    <SelectValue placeholder="Chọn phong cách xưng hô" />
                  </SelectTrigger>
                  <SelectContent position="popper">
                    <SelectItem value="shop_ban" className="text-xs">
                      Shop - Bạn (Thân thiện, gần gũi, phổ biến ngành D2C)
                    </SelectItem>
                    <SelectItem value="em_anh_chi" className="text-xs">
                      Em - Anh/Chị (Lịch sự, tôn trọng, phù hợp bán lẻ cao cấp)
                    </SelectItem>
                    <SelectItem value="minh_ban" className="text-xs">
                      Mình - Bạn (Trẻ trung, tự nhiên)
                    </SelectItem>
                    <SelectItem value="chuyen_vien" className="text-xs">
                      Chuyên viên tư vấn - Quý khách (Trang trọng, chuyên nghiệp)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FieldDescription className="text-[11px] text-muted-foreground">
                  AI sẽ tuân thủ nghiêm ngặt đại từ nhân xưng này trong toàn bộ câu trả lời.
                </FieldDescription>
              </Field>

              {/* Guarded Discount Policy */}
              <div className="rounded-xl border border-border/80 bg-muted/20 p-4 flex flex-col gap-3.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  <span className="text-xs font-semibold text-foreground">
                    Chính sách chiết khấu AI an toàn (Guarded Discount Policy Engine)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Để tránh việc AI tự ý giảm giá quá đà khi khách hàng trả giá, hệ thống sẽ cưỡng
                  chế chặn mọi đề xuất vượt quá các hạn mức bảo vệ dưới đây:
                </p>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
                  <Field>
                    <FieldLabel htmlFor="max-discount-percent" className="text-xs font-medium">
                      Chiết khấu tối đa theo % đơn hàng
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="max-discount-percent"
                        type="number"
                        min={0}
                        max={100}
                        value={maxDiscountPercent}
                        onChange={e => setMaxDiscountPercent(e.target.value)}
                        className="h-9 text-xs pr-8 font-mono"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                        %
                      </span>
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="max-discount-vnd" className="text-xs font-medium">
                      Chiết khấu tối đa theo số tiền (VND)
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        id="max-discount-vnd"
                        type="number"
                        min={0}
                        step={10000}
                        value={maxDiscountVnd}
                        onChange={e => setMaxDiscountVnd(e.target.value)}
                        className="h-9 text-xs pr-12 font-mono"
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                        VND
                      </span>
                    </div>
                  </Field>
                </div>
              </div>

              {/* Default Fulfillment & Payment */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-1">
                <Field>
                  <FieldLabel
                    htmlFor="default-warehouse"
                    className="text-xs font-medium flex items-center gap-1.5"
                  >
                    <Building2 className="size-3.5 text-muted-foreground" />
                    Kho hàng xuất kho mặc định
                  </FieldLabel>
                  <Select value={defaultWarehouseId} onValueChange={setDefaultWarehouseId}>
                    <SelectTrigger id="default-warehouse" className="h-9 text-xs">
                      <SelectValue placeholder="Chọn kho hàng" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="wh_default_hcm" className="text-xs">
                        Kho Tổng Hồ Chí Minh (Quận Tân Bình)
                      </SelectItem>
                      <SelectItem value="wh_hanoi" className="text-xs">
                        Kho Hà Nội (Quận Cầu Giấy)
                      </SelectItem>
                      <SelectItem value="wh_danang" className="text-xs">
                        Kho Đà Nẵng (Quận Hải Châu)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Kho hàng được ưu tiên kiểm tra tồn kho và giữ hàng (Stock Reservation).
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel
                    htmlFor="default-bank"
                    className="text-xs font-medium flex items-center gap-1.5"
                  >
                    <CreditCard className="size-3.5 text-muted-foreground" />
                    Tài khoản ngân hàng VietQR mặc định
                  </FieldLabel>
                  <Select value={defaultBankAccountId} onValueChange={setDefaultBankAccountId}>
                    <SelectTrigger id="default-bank" className="h-9 text-xs">
                      <SelectValue placeholder="Chọn tài khoản nhận tiền" />
                    </SelectTrigger>
                    <SelectContent position="popper">
                      <SelectItem value="bank_default_vietqr" className="text-xs">
                        MB Bank - 0988889999 (CTY TNHH SALES COPILOT)
                      </SelectItem>
                      <SelectItem value="bank_vcb" className="text-xs">
                        Vietcombank - 007100088888 (NGUYEN VAN A)
                      </SelectItem>
                      <SelectItem value="bank_techcombank" className="text-xs">
                        Techcombank - 1903333444455 (CTY TNHH SALES COPILOT)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Mã VietQR động Napas 247 sẽ được sinh tự động theo số tài khoản này.
                  </FieldDescription>
                </Field>
              </div>
            </FieldGroup>

            <div className="flex items-center justify-end pt-2 border-t border-border/60">
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isSaving ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" data-icon="inline-start" />
                    Lưu chính sách AI
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
