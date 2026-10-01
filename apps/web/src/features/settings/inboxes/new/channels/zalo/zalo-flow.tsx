'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ShieldCheck, ArrowLeft, Copy, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldLabel, FieldDescription, FieldError } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { ChannelFlowLayout } from '../../components/channel-flow-layout';
import { useNewInbox } from '../../context/new-inbox-context';
import { useOAuthPopup } from '../../../hooks/use-oauth-popup';
import { ZALO_OAUTH_POPUP_CONFIG } from '../../../hooks/oauth-popup-configs';
import { useZaloSessionInfo } from '../../../hooks/use-inboxes';
import { zaloApi } from '../../../api/zalo';
import { zaloChannelSchema, type ZaloFormValues } from './zalo-schema';
import type { ChannelDefinition } from '../../channel-registry';

interface ZaloFlowProps {
  channel: ChannelDefinition;
}

export function ZaloFlow({ channel }: ZaloFlowProps) {
  const { workspaceId, sessionIdParam, setSessionId, backToChannelSelect } = useNewInbox();

  // Surface the exact redirect URI so the operator registers it in the Zalo console
  // BEFORE authorizing — otherwise Zalo rejects with -14003 "Invalid redirect uri".
  const { data: connectConfig } = useQuery({
    queryKey: ['inboxes', workspaceId, 'zalo', 'connect-config'] as const,
    queryFn: async () => {
      const res = await zaloApi.getConnectConfig(workspaceId);
      return res.data;
    },
    enabled: Boolean(workspaceId),
    staleTime: 5 * 60 * 1000,
  });

  const { openOAuthPopup, isConnecting } = useOAuthPopup(ZALO_OAUTH_POPUP_CONFIG, {
    workspaceId,
    onSuccess: sessionId => {
      setSessionId(sessionId);
      toast.success('Kết nối tài khoản Zalo thành công!');
    },
    onError: error => {
      toast.error(error);
    },
  });

  // ── Phase A: OAuth completed — show the authorized OA and collect the OA Secret Key
  if (sessionIdParam) {
    return <ZaloSecretKeyStep channel={channel} sessionId={sessionIdParam} />;
  }

  // ── Phase B: not yet authorized
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
              <img src={channel.logoSrc} alt={channel.title} className="size-7 object-contain" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Kết nối Zalo OA</CardTitle>
              <CardDescription className="text-xs">
                Ủy quyền Official Account của bạn cho Sales Copilot để nhận và trả lời tin nhắn
                khách hàng trên Zalo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              <span>Kết nối trực tiếp OAuth an toàn qua Zalo</span>
            </div>
            <p>
              Khi nhấp vào nút bên dưới, cửa sổ xác thực chính thức của Zalo sẽ mở lên. Đăng nhập
              bằng tài khoản quản trị viên OA và cấp quyền. Sau khi ủy quyền, bạn chỉ cần nhập OA
              Secret Key để hoàn tất.
            </p>
          </div>

          {connectConfig?.redirectUri && (
            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 text-xs flex flex-col gap-2">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Link2 className="size-4 text-[#0068FF]" />
                <span>Yêu cầu trước khi ủy quyền</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Đăng ký <strong>Redirect URI</strong> dưới đây vào app trên developers.zalo.me (mục
                Đăng nhập → Thêm nền tảng → Web, và xác thực domain nếu được yêu cầu). Thiếu bước
                này Zalo sẽ trả lỗi <code className="font-mono">-14003 Invalid redirect uri</code>.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 p-2.5">
                <code className="flex-1 truncate text-[11px] font-mono text-foreground">
                  {connectConfig.redirectUri}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(connectConfig.redirectUri);
                      toast.success('Đã sao chép Redirect URI');
                    } catch {
                      toast.error('Không thể sao chép. Vui lòng copy thủ công.');
                    }
                  }}
                  className="h-7 gap-1.5 text-xs shrink-0"
                >
                  <Copy className="size-3" />
                  Copy
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t border-border/40">
            <Button
              variant="outline"
              size="sm"
              onClick={backToChannelSelect}
              className="text-xs h-9 gap-1.5"
            >
              <ArrowLeft className="size-3" />
              Chọn kênh khác
            </Button>

            <Button
              size="lg"
              onClick={openOAuthPopup}
              disabled={isConnecting}
              className="h-9 bg-[#0068FF] text-white hover:bg-[#0068FF]/90 font-medium px-5 gap-2 text-xs"
            >
              {isConnecting ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Đang mở cửa sổ kết nối...
                </>
              ) : (
                <>
                  <img src="/channels/zalo.png" alt="" className="size-4 object-contain" />
                  Tiếp tục với Zalo
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ZaloSecretKeyStep({
  channel,
  sessionId,
}: {
  channel: ChannelDefinition;
  sessionId: string;
}) {
  const { workspaceId, backToChannelSelect, submitChannelDraft, isSubmitting } = useNewInbox();

  const { data: session, isLoading, error } = useZaloSessionInfo(workspaceId, sessionId);

  const methods = useForm<ZaloFormValues>({
    resolver: zodResolver(zaloChannelSchema),
    defaultValues: { oaSecretKey: '' },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = methods;

  const onSubmit = (data: ZaloFormValues) => {
    if (!session) return;
    submitChannelDraft({
      name: session.oaName,
      avatarUrl: session.oaAvatar,
      credentials: { sessionId, oaSecretKey: data.oaSecretKey.trim() },
      providerAccountId: session.oaId,
      channelType: channel.type,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-12 rounded-xl border border-border bg-card/30 text-center">
        <Spinner className="size-6 text-primary" />
        <p className="text-xs text-muted-foreground">Đang tải thông tin Official Account...</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
        <p className="text-xs text-destructive">
          {error instanceof Error
            ? error.message
            : 'Không thể tải thông tin Official Account. Phiên ủy quyền có thể đã hết hạn.'}
        </p>
        <Button variant="outline" size="sm" onClick={backToChannelSelect} className="text-xs h-8">
          <ArrowLeft className="size-3" />
          Chọn kênh khác
        </Button>
      </div>
    );
  }

  return (
    <FormProvider {...methods}>
      <ChannelFlowLayout
        channel={channel}
        onSubmit={handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
      >
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-3.5">
          <Avatar className="size-10 rounded-lg border border-border shrink-0">
            <AvatarImage src={session.oaAvatar} alt={session.oaName} />
            <AvatarFallback className="text-[10px] uppercase font-semibold">
              {session.oaName.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">{session.oaName}</span>
            <span className="text-[11px] text-muted-foreground truncate">
              Đã ủy quyền thành công · OA ID: {session.oaId}
            </span>
          </div>
        </div>

        <Field data-invalid={Boolean(errors.oaSecretKey)}>
          <FieldLabel htmlFor="zalo-oa-secret" className="text-xs font-medium">
            OA Secret Key <span className="text-destructive">*</span>
          </FieldLabel>
          <Input
            id="zalo-oa-secret"
            type="password"
            {...register('oaSecretKey')}
            placeholder="Dán OA Secret Key từ OA Console"
            className="h-8 text-xs font-mono"
            aria-invalid={Boolean(errors.oaSecretKey)}
          />
          {errors.oaSecretKey ? (
            <FieldError errors={[errors.oaSecretKey]} />
          ) : (
            <FieldDescription className="text-[11px] text-muted-foreground">
              Vào OA Console (oa.zalo.me) → mục Webhook → copy OA Secret Key. Key này dùng để xác
              thực chữ ký webhook mà Zalo gửi về.
            </FieldDescription>
          )}
        </Field>
      </ChannelFlowLayout>
    </FormProvider>
  );
}
