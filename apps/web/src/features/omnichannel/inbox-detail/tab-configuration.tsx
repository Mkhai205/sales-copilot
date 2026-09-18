'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ChannelType,
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  type InboxDetailDto,
  type InboxWebWidgetConfig,
  type PreChatFormConfig,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { facebookApi } from '../api/facebook';
import { useUpdateInbox } from '../hooks/use-inboxes';

interface TabConfigurationProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug?: string;
}

export function TabConfiguration({ inbox, workspaceId, workspaceSlug }: TabConfigurationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const [isReauthorizing, setIsReauthorizing] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [showHmacSecret, setShowHmacSecret] = React.useState(false);
  const [showTelegramToken, setShowTelegramToken] = React.useState(false);

  const sessionId = searchParams.get('sessionId');

  React.useEffect(() => {
    if (sessionId) {
      toast.success('Xác thực lại tài khoản Facebook thành công!');
      if (workspaceSlug) {
        router.replace(`/${workspaceSlug}/settings/inboxes/${inbox.id}?tab=configuration`, {
          scroll: false,
        });
      }
    }
  }, [sessionId, workspaceSlug, inbox.id, router]);

  // Web Widget Settings State
  const existingWidget = inbox.settings?.webWidget as InboxWebWidgetConfig | undefined;
  const [widgetColor, setWidgetColor] = React.useState(existingWidget?.widgetColor || '#0ea5e9');
  const [allowedDomains, setAllowedDomains] = React.useState(
    (existingWidget?.allowedDomains || []).join(', '),
  );
  const [hmacMandatory, setHmacMandatory] = React.useState(existingWidget?.hmacMandatory || false);
  const [preChatEnabled, setPreChatEnabled] = React.useState(
    existingWidget?.preChatForm?.enabled || false,
  );
  const [preChatRequireName, setPreChatRequireName] = React.useState(
    existingWidget?.preChatForm?.requireName ?? true,
  );
  const [preChatRequireEmail, setPreChatRequireEmail] = React.useState(
    existingWidget?.preChatForm?.requireEmail ?? true,
  );
  const [preChatRequirePhone, setPreChatRequirePhone] = React.useState(
    existingWidget?.preChatForm?.requirePhone ?? false,
  );

  // Comment Guard Settings State (Facebook Messenger)
  const existingCommentGuard = (inbox.channel?.settings as any)?.commentGuard;
  const [commentGuardEnabled, setCommentGuardEnabled] = React.useState(
    existingCommentGuard?.enabled || false,
  );
  const [publicReplyEnabled, setPublicReplyEnabled] = React.useState(
    existingCommentGuard?.publicReplyEnabled ?? true,
  );
  const [privateReplyTemplate, setPrivateReplyTemplate] = React.useState(
    existingCommentGuard?.privateReplyTemplate || DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  );
  const [publicReplyTemplate, setPublicReplyTemplate] = React.useState(
    existingCommentGuard?.publicReplyTemplate || DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  );

  React.useEffect(() => {
    if (existingCommentGuard) {
      setCommentGuardEnabled(existingCommentGuard.enabled ?? false);
      setPublicReplyEnabled(existingCommentGuard.publicReplyEnabled ?? true);
      setPrivateReplyTemplate(
        existingCommentGuard.privateReplyTemplate || DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
      );
      setPublicReplyTemplate(
        existingCommentGuard.publicReplyTemplate || DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
      );
    }
  }, [inbox.channel?.updatedAt, inbox.updatedAt]);

  // Masked channel credential state
  const [telegramToken, setTelegramToken] = React.useState('');

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.salescopilot.vn';
  const websiteToken = inbox.channel?.providerAccountId || inbox.id;
  const hmacSecret =
    existingWidget?.hmacSecret || `sec_live_${inbox.id.replace(/-/g, '').slice(0, 24)}`;

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

  const handleStartFacebookOAuth = async () => {
    setIsReauthorizing(true);
    try {
      const returnUrl = workspaceSlug
        ? `${origin}/${workspaceSlug}/settings/inboxes/${inbox.id}?tab=configuration`
        : `${origin}/settings/inboxes/${inbox.id}?tab=configuration`;
      const res = await facebookApi.getAuthUrl(workspaceId, origin, returnUrl);
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast.error(err.message || 'Không thể khởi tạo xác thực lại Facebook');
      setIsReauthorizing(false);
    }
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

    updateInbox({
      inboxId: inbox.id,
      dto: {
        settings: updatedSettings,
      },
      successMessage: 'Lưu cấu hình Live Chat thành công',
    });
  };

  const handleSaveTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!telegramToken.trim()) {
      toast.info('Chưa có thay đổi Token mới để lưu');
      return;
    }

    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          channelCredentials: {
            botToken: telegramToken.trim(),
          },
        },
        successMessage: 'Cập nhật Telegram Bot Token thành công',
      },
      {
        onSuccess: () => {
          setTelegramToken('');
        },
      },
    );
  };

  const handleSaveCommentGuard = (e: React.FormEvent) => {
    e.preventDefault();

    const currentChannelSettings = (inbox.channel?.settings as Record<string, unknown>) || {};
    const updatedChannelSettings = {
      ...currentChannelSettings,
      commentGuard: {
        enabled: commentGuardEnabled,
        publicReplyEnabled,
        privateReplyTemplate: privateReplyTemplate.trim(),
        publicReplyTemplate: publicReplyTemplate.trim(),
      },
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        channelSettings: updatedChannelSettings,
      },
      successMessage: 'Lưu cấu hình Vệ sĩ bình luận (Comment Guard) thành công',
    });
  };

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* ─── WEB CHAT CONFIGURATION ────────────────────────────────────────── */}
      {inbox.channelType === ChannelType.WEB_CHAT && (
        <>
          {/* Embed Script Card */}
          <Card className="border-border bg-card/40">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="size-4 text-emerald-500" />
                  <CardTitle className="text-base font-semibold">
                    Mã nhúng Website Live Chat
                  </CardTitle>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(embedScript, 'embed', 'mã nhúng')}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {copiedKey === 'embed' ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      Đã chép
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Sao chép mã nhúng
                    </>
                  )}
                </Button>
              </div>
              <CardDescription className="text-xs">
                Dán đoạn mã script này vào trước thẻ đóng{' '}
                <code className="font-mono text-foreground">&lt;/body&gt;</code> trên trang web hoặc
                Landing Page của bạn để hiển thị khung chat.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre leading-relaxed select-all">
                {embedScript}
              </pre>
            </CardContent>
          </Card>

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
                Sử dụng HMAC Secret Token để xác thực danh tính khách hàng đã đăng nhập nhằm ngăn
                chặn giả mạo người dùng.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel className="text-xs font-medium">Website Token</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={websiteToken}
                    className="h-9 text-xs font-mono bg-muted/40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(websiteToken, 'token', 'Website Token')}
                    className="h-9 shrink-0 gap-1 text-xs"
                  >
                    {copiedKey === 'token' ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Chép
                  </Button>
                </div>
              </Field>

              <Field>
                <FieldLabel className="text-xs font-medium">
                  Khóa bí mật xác thực danh tính (HMAC Secret)
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={showHmacSecret ? 'text' : 'password'}
                    value={hmacSecret}
                    className="h-9 text-xs font-mono bg-muted/40"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowHmacSecret(!showHmacSecret)}
                    className="h-9 shrink-0 gap-1 text-xs"
                    title={showHmacSecret ? 'Ẩn khóa bí mật' : 'Hiển thị khóa bí mật'}
                  >
                    {showHmacSecret ? (
                      <EyeOff className="size-3 text-muted-foreground" />
                    ) : (
                      <Eye className="size-3 text-muted-foreground" />
                    )}
                    <span className="sr-only">{showHmacSecret ? 'Ẩn' : 'Hiện'}</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(hmacSecret, 'hmac', 'HMAC Secret')}
                    className="h-9 shrink-0 gap-1 text-xs"
                  >
                    {copiedKey === 'hmac' ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Chép
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
              <CardTitle className="text-base font-semibold">
                Tùy chỉnh giao diện & Thu thập thông tin khách hàng
              </CardTitle>
              <CardDescription className="text-xs">
                Cấu hình tên miền cho phép, màu chủ đạo thương hiệu và biểu mẫu hỏi thông tin trước
                khi chat (Pre-chat Form).
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
                      className="h-9 text-xs"
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
                        className="size-9 rounded-md border border-border cursor-pointer bg-transparent p-0.5"
                      />
                      <Input
                        id="widget-color"
                        value={widgetColor}
                        onChange={e => setWidgetColor(e.target.value)}
                        placeholder="#0ea5e9"
                        className="h-9 text-xs font-mono max-w-xs"
                      />
                    </div>
                  </Field>

                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                    <div className="flex flex-col gap-0.5 pr-4">
                      <span className="text-xs font-medium text-foreground">
                        Bắt buộc xác thực HMAC (Mandatory Identity Verification)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Từ chối nhận tin nhắn từ widget nếu client không truyền kèm mã chữ ký HMAC
                        hợp lệ.
                      </span>
                    </div>
                    <Switch checked={hmacMandatory} onCheckedChange={setHmacMandatory} />
                  </div>

                  {/* Pre-Chat Form */}
                  <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 flex flex-col gap-3">
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
                        <Spinner className="size-3.5" data-icon="inline-start" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" data-icon="inline-start" />
                        Lưu cấu hình Live Chat
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── FACEBOOK MESSENGER CONFIGURATION ──────────────────────────────── */}
      {inbox.channelType === ChannelType.FACEBOOK_MESSENGER && (
        <>
          <Card className="border-border bg-card/40">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">
                  Thông tin kết nối Facebook Fanpage
                </CardTitle>
                <Badge
                  variant="outline"
                  className={
                    inbox.channel?.isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  }
                >
                  {inbox.channel?.isConnected ? (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3" />
                      Đang hoạt động (Healthy)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ShieldAlert className="size-3" />
                      Chưa kết nối
                    </span>
                  )}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Trạng thái tích hợp Graph API và Webhook tiếp nhận tin nhắn từ Facebook Messenger.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Field>
                <FieldLabel className="text-xs font-medium">Facebook Page ID</FieldLabel>
                <Input
                  readOnly
                  value={inbox.channel?.providerAccountId || 'Chưa liên kết'}
                  className="h-9 text-xs font-mono bg-muted/40"
                />
              </Field>

              <Field>
                <FieldLabel className="text-xs font-medium">Meta Webhook Callback URL</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${origin}/api/webhooks/facebook`}
                    className="h-9 text-xs font-mono bg-muted/40"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(
                        `${origin}/api/webhooks/facebook`,
                        'fb-webhook',
                        'Webhook URL',
                      )
                    }
                    className="h-9 shrink-0 gap-1 text-xs"
                  >
                    {copiedKey === 'fb-webhook' ? (
                      <Check className="size-3 text-emerald-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    Chép
                  </Button>
                </div>
              </Field>

              {/* Re-authorize action */}
              <div className="rounded-lg border border-border/80 bg-muted/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-foreground">
                    Ủy quyền lại kết nối Facebook (Re-authorize)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Nếu token Facebook hết hạn hoặc đổi mật khẩu tài khoản Admin, nhấn vào đây để
                    cấp lại quyền cho Sales Copilot.
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={handleStartFacebookOAuth}
                  disabled={isReauthorizing}
                  className="h-8 gap-1.5 text-xs font-medium shrink-0 bg-[#1877F2] text-white hover:bg-[#1877F2]/90"
                >
                  {isReauthorizing ? (
                    <>
                      <Spinner className="size-3.5" data-icon="inline-start" />
                      Đang kết nối...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5" data-icon="inline-start" />
                      Ủy quyền lại 1-Click
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Comment Guard Card */}
          <Card className="border-border bg-card/40">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="size-4 text-primary" />
                  <CardTitle className="text-base font-semibold">
                    Vệ Sĩ Bình Luận (Comment Guard)
                  </CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={
                    commentGuardEnabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                      : 'border-muted bg-muted/40 text-muted-foreground'
                  }
                >
                  {commentGuardEnabled ? 'Đang bật bảo vệ' : 'Đang tắt'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Tự động quét và ẩn bình luận chứa số điện thoại dưới bài viết/livestream để chống
                cướp khách, đồng thời gửi tin nhắn riêng qua Messenger và mở hội thoại tư vấn trong
                Inbox.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveCommentGuard} className="flex flex-col gap-5">
                <FieldGroup className="gap-4">
                  {/* Master toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                    <div className="flex flex-col gap-0.5 pr-4">
                      <span className="text-xs font-medium text-foreground">
                        Bật tự động ẩn bình luận chứa số điện thoại (Comment Guard)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Khi phát hiện bình luận có số điện thoại Việt Nam, hệ thống lập tức ẩn bình
                        luận để đối thủ không thể khai thác.
                      </span>
                    </div>
                    <Switch
                      checked={commentGuardEnabled}
                      onCheckedChange={setCommentGuardEnabled}
                    />
                  </div>

                  {commentGuardEnabled && (
                    <>
                      {/* Public reply toggle */}
                      <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                        <div className="flex flex-col gap-0.5 pr-4">
                          <span className="text-xs font-medium text-foreground">
                            Đăng bình luận phản hồi công khai (Public Reply)
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            Bình luận trả lời công khai giúp khách an tâm đã được shop ghi nhận và
                            bảo toàn tương tác cho bài viết.
                          </span>
                        </div>
                        <Switch
                          checked={publicReplyEnabled}
                          onCheckedChange={setPublicReplyEnabled}
                        />
                      </div>

                      {/* Private reply textarea */}
                      <Field>
                        <FieldLabel
                          htmlFor="private-reply-template"
                          className="text-xs font-medium"
                        >
                          Mẫu tin nhắn riêng tư (Private Reply qua Messenger)
                        </FieldLabel>
                        <Textarea
                          id="private-reply-template"
                          rows={3}
                          value={privateReplyTemplate}
                          onChange={e => setPrivateReplyTemplate(e.target.value)}
                          placeholder={DEFAULT_COMMENT_GUARD_PRIVATE_REPLY}
                          className="text-xs min-h-[72px]"
                        />
                        <FieldDescription className="text-[11px] text-muted-foreground">
                          Hệ thống sẽ gửi tin nhắn này trực tiếp vào Messenger của khách hàng ngay
                          khi ẩn bình luận.
                        </FieldDescription>
                      </Field>

                      {/* Public reply textarea */}
                      {publicReplyEnabled && (
                        <Field>
                          <FieldLabel
                            htmlFor="public-reply-template"
                            className="text-xs font-medium"
                          >
                            Mẫu bình luận công khai dưới bài viết (Public Reply)
                          </FieldLabel>
                          <Textarea
                            id="public-reply-template"
                            rows={2}
                            value={publicReplyTemplate}
                            onChange={e => setPublicReplyTemplate(e.target.value)}
                            placeholder={DEFAULT_COMMENT_GUARD_PUBLIC_REPLY}
                            className="text-xs min-h-[56px]"
                          />
                          <FieldDescription className="text-[11px] text-muted-foreground">
                            Nội dung bình luận phản hồi hiển thị công khai dưới comment của khách
                            hàng.
                          </FieldDescription>
                        </Field>
                      )}
                    </>
                  )}
                </FieldGroup>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => {
                      setPrivateReplyTemplate(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY);
                      setPublicReplyTemplate(DEFAULT_COMMENT_GUARD_PUBLIC_REPLY);
                      toast.success('Đã khôi phục mẫu tin nhắn mặc định');
                    }}
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    <RotateCcw className="size-3.5" data-icon="inline-start" />
                    {'Khôi phục mặc định'}
                  </Button>

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdating}
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    {isUpdating ? (
                      <>
                        <Spinner className="size-3.5" data-icon="inline-start" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Check className="size-3.5" data-icon="inline-start" />
                        Lưu cấu hình Comment Guard
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── ZALO OA CONFIGURATION ─────────────────────────────────────────── */}
      {inbox.channelType === ChannelType.ZALO && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Thông tin kết nối Zalo Official Account
              </CardTitle>
              <Badge
                variant="outline"
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
              >
                <ShieldCheck className="size-3" data-icon="inline-start" />
                Đang kết nối
              </Badge>
            </div>
            <CardDescription className="text-xs">
              Quản lý định danh Zalo OA và webhook tiếp nhận tin nhắn từ Zalo OA API.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel className="text-xs font-medium">Zalo OA ID</FieldLabel>
              <Input
                readOnly
                value={inbox.channel?.providerAccountId || '••••••••'}
                className="h-9 text-xs font-mono bg-muted/40"
              />
            </Field>

            <Field>
              <FieldLabel className="text-xs font-medium">Zalo Webhook Callback URL</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${origin}/api/webhooks/zalo`}
                  className="h-9 text-xs font-mono bg-muted/40"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(`${origin}/api/webhooks/zalo`, 'zalo-webhook', 'Webhook URL')
                  }
                  className="h-9 shrink-0 gap-1 text-xs"
                >
                  {copiedKey === 'zalo-webhook' ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  Chép
                </Button>
              </div>
              <FieldDescription className="text-[11px] text-muted-foreground">
                Cấu hình URL này vào phần Webhook trên trang quản trị ứng dụng Zalo Developer.
              </FieldDescription>
            </Field>
          </CardContent>
        </Card>
      )}

      {/* ─── TELEGRAM CONFIGURATION ────────────────────────────────────────── */}
      {inbox.channelType === ChannelType.TELEGRAM && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Cấu hình Telegram Bot</CardTitle>
            <CardDescription className="text-xs">
              Quản lý Telegram Bot Token và Webhook tiếp nhận sự kiện từ Telegram Bot API.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel className="text-xs font-medium">Telegram Webhook URL</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`${origin}/api/webhooks/telegram/${inbox.id}`}
                  className="h-9 text-xs font-mono bg-muted/40"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(
                      `${origin}/api/webhooks/telegram/${inbox.id}`,
                      'tg-webhook',
                      'Webhook URL',
                    )
                  }
                  className="h-9 shrink-0 gap-1 text-xs"
                >
                  {copiedKey === 'tg-webhook' ? (
                    <Check className="size-3 text-emerald-500" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  Chép
                </Button>
              </div>
            </Field>

            <form onSubmit={handleSaveTelegram} className="flex flex-col gap-3 pt-2">
              <Field>
                <FieldLabel htmlFor="telegram-token" className="text-xs font-medium">
                  Cập nhật Bot Token mới (nếu cần thay đổi)
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="telegram-token"
                    type={showTelegramToken ? 'text' : 'password'}
                    value={telegramToken}
                    onChange={e => setTelegramToken(e.target.value)}
                    placeholder="••••••••••••••••••••••••••••••••••••••••"
                    className="h-9 text-xs font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTelegramToken(!showTelegramToken)}
                    className="h-9 shrink-0 gap-1 text-xs"
                    title={showTelegramToken ? 'Ẩn token' : 'Hiển thị token'}
                  >
                    {showTelegramToken ? (
                      <EyeOff className="size-3 text-muted-foreground" />
                    ) : (
                      <Eye className="size-3 text-muted-foreground" />
                    )}
                    <span className="sr-only">{showTelegramToken ? 'Ẩn' : 'Hiện'}</span>
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdating || !telegramToken.trim()}
                    className="h-9 text-xs shrink-0 font-medium"
                  >
                    {isUpdating ? <Spinner className="size-3.5" /> : 'Lưu Token mới'}
                  </Button>
                </div>
                <FieldDescription className="text-[11px] text-muted-foreground">
                  Để trống nếu bạn không có nhu cầu đổi Bot Token hiện tại.
                </FieldDescription>
              </Field>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── EMAIL CONFIGURATION ───────────────────────────────────────────── */}
      {inbox.channelType === ChannelType.EMAIL && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Cấu hình Hòm thư Email</CardTitle>
            <CardDescription className="text-xs">
              Thông tin địa chỉ email và giao thức gửi nhận SMTP / IMAP.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Field>
              <FieldLabel className="text-xs font-medium">Địa chỉ Email tiếp nhận</FieldLabel>
              <Input
                readOnly
                value={inbox.channel?.providerAccountId || 'Chưa thiết lập'}
                className="h-9 text-xs font-mono bg-muted/40"
              />
            </Field>
            <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 flex items-center gap-2.5 text-xs text-muted-foreground">
              <AlertCircle className="size-4 text-primary shrink-0" />
              <span>
                Sales Copilot hỗ trợ gửi nhận email thông qua SMTP/IMAP trực tiếp. Tin nhắn gửi đến
                địa chỉ trên sẽ được chuyển đổi thành hội thoại tự động.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
