'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  PowerOff,
  RefreshCw,
  AlertCircle,
  Clock,
  Link2,
  Copy,
  KeyRound,
} from 'lucide-react';
import Link from 'next/link';
import { type InboxDetailDto } from '@sales-copilot/shared-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/lib/query-keys';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUpdateInbox } from '../../../hooks/use-inboxes';
import { useOAuthPopup } from '../../../hooks/use-oauth-popup';
import { ZALO_OAUTH_POPUP_CONFIG } from '../../../hooks/oauth-popup-configs';
import { zaloApi } from '../../../api/zalo';

interface ZaloConfigProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

export function ZaloConfig({ inbox, workspaceId }: ZaloConfigProps) {
  const queryClient = useQueryClient();
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const [isDisconnectOpen, setIsDisconnectOpen] = React.useState(false);
  const [isSyncingSession, setIsSyncingSession] = React.useState(false);

  const channelSettings = (inbox.channel?.settings as Record<string, any>) || {};
  const isConnected = Boolean(inbox.channel?.isConnected);
  const reauthorizationRequired = Boolean(channelSettings.reauthorizationRequired);
  const oaName = channelSettings.oaName || inbox.name || 'Zalo Official Account';
  const oaId = inbox.channel?.providerAccountId || channelSettings.oaId || '';
  const oaAvatar = channelSettings.oaAvatar || inbox.avatarUrl;
  const lastSyncAt = channelSettings.lastSyncAt;
  const lastSyncError = channelSettings.lastSyncError;
  const webhookUrl: string = channelSettings.webhookUrl || '';

  // ── Re-authorize: OAuth popup bound to this channel, then connect with the session ──
  const popupConfig = React.useMemo(
    () => ({
      ...ZALO_OAUTH_POPUP_CONFIG,
      getAuthUrl: (wsId: string, origin: string, returnUrl: string) =>
        zaloApi.getAuthUrl(wsId, origin, returnUrl, inbox.channel?.id),
    }),
    [inbox.channel?.id],
  );

  const { openOAuthPopup, isConnecting: isReauthorizing } = useOAuthPopup(popupConfig, {
    workspaceId,
    onSuccess: async sessionId => {
      if (!inbox.channel?.id) return;
      setIsSyncingSession(true);
      try {
        await zaloApi.connect(workspaceId, { sessionId });
        toast.success('Ủy quyền lại Zalo OA thành công!', {
          id: `zalo-reauth-${inbox.channel.id}`,
        });
        queryClient.invalidateQueries({ queryKey: inboxKeys.detail(workspaceId, inbox.id) });
      } catch (err) {
        toast.error((err as Error).message || 'Không thể ủy quyền lại Zalo OA', {
          id: `zalo-reauth-${inbox.channel.id}`,
        });
      } finally {
        setIsSyncingSession(false);
      }
    },
    onError: err => {
      toast.error(err || 'Không thể khởi tạo ủy quyền Zalo OAuth');
    },
  });

  const handleDisconnect = () => {
    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          isConnected: false,
        },
        successMessage: 'Đã ngắt kết nối Zalo OA an toàn',
      },
      {
        onSuccess: () => {
          setIsDisconnectOpen(false);
        },
      },
    );
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success('Đã sao chép Webhook URL');
    } catch {
      toast.error('Không thể sao chép. Vui lòng copy thủ công.');
    }
  };

  const isSyncing = isSyncingSession || isReauthorizing;

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <img
                  src="/channels/zalo.png"
                  alt=""
                  className="size-4 object-contain"
                  aria-hidden
                />
                <CardTitle className="text-base font-semibold">Cấu hình Zalo OA</CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Official Account kết nối qua OAuth — token được tự động làm mới bởi hệ thống.
              </CardDescription>
            </div>

            <Badge
              variant="outline"
              className={
                isConnected
                  ? 'border-success/30 bg-success/10 text-success text-xs py-1 px-2.5'
                  : 'border-warning/30 bg-warning/10 text-warning text-xs py-1 px-2.5'
              }
            >
              {isConnected ? (
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="size-3.5" />
                  Đang hoạt động
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldAlert className="size-3.5" />
                  Chưa kết nối
                </span>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-5">
          {lastSyncError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-destructive text-xs">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">Lỗi cấu hình kết nối:</span>
                <span className="text-muted-foreground">{lastSyncError}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#0068FF]/20 bg-[#0068FF]/5 p-4.5">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-12 rounded-2xl border border-border shrink-0">
                <AvatarImage src={oaAvatar || undefined} alt={oaName} />
                <AvatarFallback className="text-xs uppercase font-semibold">
                  {oaName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{oaName}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {oaId && (
                    <span className="inline-flex items-center gap-1">
                      <KeyRound className="size-3" />
                      OA ID: <code className="font-mono text-[11px]">{oaId}</code>
                    </span>
                  )}
                  {lastSyncAt && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3" />
                      Đồng bộ: {new Date(lastSyncAt).toLocaleTimeString('vi-VN')}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
              <Button
                variant="outline"
                size="sm"
                onClick={openOAuthPopup}
                disabled={isSyncing}
                className="h-8 gap-1.5 text-xs font-medium border-[#0068FF]/30 text-[#0068FF] hover:bg-[#0068FF]/10"
              >
                {isSyncing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                {reauthorizationRequired ? 'Ủy quyền lại' : 'Làm mới ủy quyền'}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDisconnectOpen(true)}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <PowerOff className="size-3.5" />
                Ngắt kết nối
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-[#0068FF]" />
            <CardTitle className="text-base font-semibold">
              Đăng ký Webhook trên OA Console
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Zalo yêu cầu đăng ký callback URL thủ công trong OA Console (không có API tự động như
            Telegram).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/20 p-3">
            <code className="flex-1 truncate text-[11px] font-mono text-foreground">
              {webhookUrl || 'Đang khởi tạo...'}
            </code>
            {webhookUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyWebhookUrl}
                className="h-7 gap-1.5 text-xs shrink-0"
              >
                <Copy className="size-3" />
                Copy
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#0068FF]/10 text-[#0068FF] text-[10px] font-bold">
                  1
                </span>
                Mở OA Console
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Đăng nhập{' '}
                <Link
                  href="https://oa.zalo.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-[#0068FF] hover:underline"
                >
                  oa.zalo.me
                  <ExternalLink className="size-2.5" />
                </Link>{' '}
                bằng tài khoản quản trị viên OA và vào phần quản lý tích hợp.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#0068FF]/10 text-[#0068FF] text-[10px] font-bold">
                  2
                </span>
                Dán Webhook URL
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Copy URL ở trên và dán vào phần cấu hình Webhook. Zalo sẽ gửi yêu cầu xác minh — hệ
                thống tự phản hồi.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#0068FF]/10 text-[#0068FF] text-[10px] font-bold">
                  3
                </span>
                Kiểm tra OA Secret Key
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                OA Secret Key đã được lưu khi kết nối. Nếu bạn xoay key mới trong OA Console, nhấn{' '}
                <strong>Làm mới ủy quyền</strong> và nhập key mới.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <PowerOff className="size-4" />
              Ngắt kết nối Zalo OA
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bạn có chắc chắn muốn ngắt kết nối <strong>{oaName}</strong> khỏi kênh này không?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground flex flex-col gap-2">
            <p>Khi ngắt kết nối:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Tin nhắn mới từ khách hàng trên Zalo sẽ tạm dừng tiếp nhận.</li>
              <li>
                <strong>
                  Toàn bộ lịch sử hội thoại, tin nhắn cũ và danh bạ khách hàng vẫn được bảo lưu
                  100%.
                </strong>
              </li>
              <li>Bạn có thể kết nối lại bất cứ lúc nào bằng nút Làm mới ủy quyền.</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsDisconnectOpen(false)}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={isUpdating}
              onClick={handleDisconnect}
              className="h-8 text-xs font-medium"
            >
              {isUpdating ? <Spinner className="size-3.5" /> : 'Xác nhận ngắt kết nối'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
