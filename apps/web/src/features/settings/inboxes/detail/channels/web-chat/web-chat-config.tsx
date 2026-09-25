'use client';

import * as React from 'react';
import { KeyRound, Copy, Check, Eye, EyeOff, Palette } from 'lucide-react';
import { toast } from 'sonner';
import {
  type InboxDetailDto,
  type InboxWebWidgetConfig,
  type PreChatFormConfig,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useUpdateInbox } from '../../../hooks/use-inboxes';
import { WebChatPreview } from './web-chat-preview';

interface WebChatConfigProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug?: string;
}

export function WebChatConfig({ inbox, workspaceId }: WebChatConfigProps) {
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [showHmacSecret, setShowHmacSecret] = React.useState(false);

  // Web Widget Settings State - read from inbox.settings.webWidget or fallback to inbox.channel.settings
  const existingWidget = inbox.settings?.webWidget as InboxWebWidgetConfig | undefined;
  const channelSettings = inbox.channel?.settings as Record<string, any> | undefined;

  const [widgetColor, setWidgetColor] = React.useState(
    existingWidget?.widgetColor || channelSettings?.widgetColor || '#0ea5e9',
  );
  const [allowedDomains, setAllowedDomains] = React.useState(
    (existingWidget?.allowedDomains || []).join(', ') ||
      (typeof channelSettings?.allowedDomains === 'string'
        ? channelSettings.allowedDomains
        : Array.isArray(channelSettings?.allowedDomains)
          ? channelSettings.allowedDomains.join(', ')
          : ''),
  );
  const [hmacMandatory, setHmacMandatory] = React.useState(
    existingWidget?.hmacMandatory ?? channelSettings?.hmacMandatory ?? false,
  );
  const [preChatEnabled, setPreChatEnabled] = React.useState(
    existingWidget?.preChatForm?.enabled ?? channelSettings?.preChatFormEnabled ?? false,
  );
  const [preChatRequireName, setPreChatRequireName] = React.useState(
    existingWidget?.preChatForm?.requireName ??
      channelSettings?.preChatFormOptions?.requireName ??
      true,
  );
  const [preChatRequireEmail, setPreChatRequireEmail] = React.useState(
    existingWidget?.preChatForm?.requireEmail ??
      channelSettings?.preChatFormOptions?.requireEmail ??
      true,
  );
  const [preChatRequirePhone, setPreChatRequirePhone] = React.useState(
    existingWidget?.preChatForm?.requirePhone ??
      channelSettings?.preChatFormOptions?.requirePhone ??
      false,
  );

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.salescopilot.vn';
  const websiteToken = inbox.channel?.providerAccountId || inbox.id;
  const hmacSecret =
    existingWidget?.hmacSecret ||
    channelSettings?.hmacSecret ||
    `sec_live_${inbox.id.replace(/-/g, '').slice(0, 24)}`;

  const embedScript = `<!-- Start Sales Copilot Live Chat -->
<script>
  (function(d,t) {
    var BASE_URL = "${origin}";
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.src=BASE_URL+"/widget/sdk.js";
    g.defer = true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      window.SalesCopilotWidget.init({
        inboxId: "${inbox.id}",
        websiteToken: "${websiteToken}"
      });
    };
  })(document,"script");
</script>
<!-- End Sales Copilot Live Chat -->`;

  const copyToClipboard = (text: string, key: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép ${label}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveWebWidget = (e: React.FormEvent) => {
    e.preventDefault();

    const domainList = allowedDomains
      .split(',')
      .map(d => d.trim())
      .filter(Boolean);

    const preChatForm: PreChatFormConfig = {
      enabled: preChatEnabled,
      requireName: preChatRequireName,
      requireEmail: preChatRequireEmail,
      requirePhone: preChatRequirePhone,
    };

    const webWidget: InboxWebWidgetConfig = {
      widgetColor,
      allowedDomains: domainList,
      hmacMandatory,
      hmacSecret,
      preChatForm,
    };

    const updatedSettings = {
      ...(inbox.settings || {}),
      webWidget,
    };

    const currentChannelSettings = (inbox.channel?.settings as Record<string, unknown>) || {};
    const updatedChannelSettings = {
      ...currentChannelSettings,
      widgetColor,
      allowedDomains: domainList.join(', '),
      hmacMandatory,
      hmacSecret,
      preChatFormEnabled: preChatEnabled,
      preChatFormOptions: {
        requireName: preChatRequireName,
        requireEmail: preChatRequireEmail,
        requirePhone: preChatRequirePhone,
      },
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        settings: updatedSettings,
        channelSettings: updatedChannelSettings,
      },
      successMessage: 'Lưu cấu hình Live Chat thành công',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full items-start">
      {/* LEFT COLUMN: Settings Forms (7/12) */}
      <div className="lg:col-span-7 flex flex-col gap-4">
        {/* Tokens & Security Card */}
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Mã định danh & Khóa bí mật (Tokens & HMAC)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Sử dụng HMAC Secret Token để xác thực danh tính khách hàng đã đăng nhập nhằm ngăn chặn
              giả mạo người dùng.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel className="text-xs font-medium">Website Token</FieldLabel>
              <div className="flex items-center gap-2">
                <Input readOnly value={websiteToken} className="text-xs font-mono pr-10 h-8" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(websiteToken, 'token', 'Website Token')}
                  className="h-8 shrink-0 gap-1 text-xs"
                >
                  {copiedKey === 'token' ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">
                Khóa bí mật xác thực danh tính (HMAC Secret)
              </FieldLabel>
              <div className="flex items-center gap-2">
                <div className="relative w-full">
                  <Input
                    readOnly
                    type={showHmacSecret ? 'text' : 'password'}
                    value={hmacSecret}
                    className="text-xs font-mono pr-10 h-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowHmacSecret(!showHmacSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
                  >
                    {showHmacSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(hmacSecret, 'hmac', 'HMAC Secret')}
                  className="h-8 shrink-0 gap-1 text-xs"
                >
                  {copiedKey === 'hmac' ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                </Button>
              </div>
              <FieldDescription className="text-[11px] text-muted-foreground">
                Dùng khóa này để tạo chữ ký{' '}
                <code className="font-mono">sha256_hmac(user_id, secret)</code> từ backend của bạn
                gửi lên widget SDK.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>

        {/* Widget Appearance & Pre-Chat Form */}
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold">
                Tùy chỉnh giao diện & Thu thập thông tin
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Cấu hình màu chủ đạo thương hiệu, danh sách tên miền cho phép và biểu mẫu hỏi thông
              tin trước khi chat (Pre-chat Form).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveWebWidget} className="flex flex-col gap-5">
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="allowed-domains" className="text-xs font-medium">
                    Danh sách tên miền được phép (Allowed Domains)
                  </FieldLabel>
                  <Input
                    id="allowed-domains"
                    value={allowedDomains}
                    onChange={e => setAllowedDomains(e.target.value)}
                    placeholder="https://myshop.vn, https://store.myshop.vn"
                    className="h-8 text-xs"
                  />
                  <FieldDescription className="text-[11px] text-muted-foreground">
                    Phân cách nhiều tên miền bằng dấu phẩy. Để trống để cho phép mọi tên miền.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="widget-color" className="text-xs font-medium">
                    Màu chủ đạo Widget (Hex Color)
                  </FieldLabel>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      id="widget-color-picker"
                      value={widgetColor}
                      onChange={e => setWidgetColor(e.target.value)}
                      className="size-8 rounded-sm cursor-pointer"
                    />
                    <Input
                      id="widget-color"
                      value={widgetColor}
                      onChange={e => setWidgetColor(e.target.value)}
                      placeholder="#0ea5e9"
                      className="h-8 text-xs font-mono max-w-xs"
                    />
                  </div>
                </Field>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex flex-col gap-0.5 pr-4">
                    <span className="text-xs font-medium text-foreground">
                      Bắt buộc xác thực HMAC (Mandatory Identity Verification)
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Từ chối nhận tin nhắn từ widget nếu client không truyền kèm mã chữ ký HMAC hợp
                      lệ.
                    </span>
                  </div>
                  <Switch checked={hmacMandatory} onCheckedChange={setHmacMandatory} />
                </div>

                {/* Pre-Chat Form */}
                <div className="rounded-lg border p-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">
                        Thu thập thông tin trước khi chat (Pre-chat Form)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Yêu cầu khách hàng nhập thông tin liên hệ trước khi bắt đầu hội thoại.
                      </span>
                    </div>
                    <Switch checked={preChatEnabled} onCheckedChange={setPreChatEnabled} />
                  </div>

                  {preChatEnabled && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="prechat-name"
                          checked={preChatRequireName}
                          onCheckedChange={c => setPreChatRequireName(Boolean(c))}
                        />
                        <label
                          htmlFor="prechat-name"
                          className="text-xs cursor-pointer select-none"
                        >
                          Yêu cầu nhập Họ và tên
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="prechat-email"
                          checked={preChatRequireEmail}
                          onCheckedChange={c => setPreChatRequireEmail(Boolean(c))}
                        />
                        <label
                          htmlFor="prechat-email"
                          className="text-xs cursor-pointer select-none"
                        >
                          Yêu cầu nhập Địa chỉ Email
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="prechat-phone"
                          checked={preChatRequirePhone}
                          onCheckedChange={c => setPreChatRequirePhone(Boolean(c))}
                        />
                        <label
                          htmlFor="prechat-phone"
                          className="text-xs cursor-pointer select-none"
                        >
                          Yêu cầu nhập Số điện thoại
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </FieldGroup>

              <div className="flex items-center justify-end pt-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isUpdating}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {isUpdating ? (
                    <>
                      <Spinner className="size-3.5" />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" />
                      Lưu cấu hình Live Chat
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Live Interactive Widget Simulator (5/12, Sticky) */}
      <div className="lg:col-span-5 sticky top-6 self-start">
        <WebChatPreview
          widgetColor={widgetColor}
          inboxTitle={inbox.name || 'Sales Copilot Live Chat'}
          preChatEnabled={preChatEnabled}
          preChatRequireName={preChatRequireName}
          preChatRequireEmail={preChatRequireEmail}
          preChatRequirePhone={preChatRequirePhone}
          embedScript={embedScript}
          websiteToken={websiteToken}
        />
      </div>
    </div>
  );
}
