'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Clock,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  QrCode,
  MonitorOff,
} from 'lucide-react';
import Link from 'next/link';
import { type InboxDetailDto } from '@sales-copilot/shared-contracts';
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
import { zaloPersonalApi, type ZaloPersonalSessionStatus } from '../../../api/zalo-personal';

interface ZaloPersonalConfigProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

const QR_POLL_INTERVAL_MS = 2000;

function formatQrDataUrl(qrImage?: string): string {
  if (!qrImage) return '';
  return qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`;
}

/**
 * Configuration tab for a ZALO_PERSONAL channel. There is no webhook URL here:
 * inbound messages arrive through the persistent listener on the server, and
 * the account owner must keep the web session exclusive.
 */
export function ZaloPersonalConfig({ inbox, workspaceId }: ZaloPersonalConfigProps) {
  const queryClient = useQueryClient();
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const [isDisconnectOpen, setIsDisconnectOpen] = React.useState(false);
  const [isReauthOpen, setIsReauthOpen] = React.useState(false);
  const [reauthSessionId, setReauthSessionId] = React.useState<string | null>(null);
  const [isStartingReauth, setIsStartingReauth] = React.useState(false);

  const channelSettings = (inbox.channel?.settings as Record<string, any>) || {};
  const isConnected = Boolean(inbox.channel?.isConnected);
  const reauthorizationRequired = Boolean(channelSettings.reauthorizationRequired);
  const zaloName = channelSettings.zaloName || inbox.name || 'Zalo Cá nhân';
  const ownId = inbox.channel?.providerAccountId || '';
  const avatarUrl = channelSettings.avatar || inbox.avatarUrl;
  const lastSyncAt = channelSettings.lastSyncAt;
  const lastSyncError = channelSettings.lastSyncError;

  // Poll the re-authorize QR session while it is active.
  const { data: sessionStatus } = useQuery({
    queryKey: ['inboxes', workspaceId, 'zalo-personal', 'reauth-session', reauthSessionId] as const,
    queryFn: async (): Promise<ZaloPersonalSessionStatus> => {
      const res = await zaloPersonalApi.getConnectSessionStatus(workspaceId, reauthSessionId!);
      return res.data;
    },
    enabled: Boolean(reauthSessionId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'connected' || status === 'failed' || status === 'expired'
        ? false
        : QR_POLL_INTERVAL_MS;
    },
  });

  const handleStartReauthorize = async () => {
    if (!inbox.channel?.id) return;
    setIsStartingReauth(true);
    try {
      const res = await zaloPersonalApi.createReauthorizeSession(workspaceId, inbox.channel.id);
      setReauthSessionId(res.data.sessionId);
      setIsReauthOpen(true);
    } catch (err) {
      toast.error((err as Error).message || 'Không thể tạo phiên quét mã QR');
    } finally {
      setIsStartingReauth(false);
    }
  };

  // Complete re-authorization once the scanned session reaches `connected`.
  React.useEffect(() => {
    if (!reauthSessionId || sessionStatus?.status !== 'connected' || !inbox.channel?.id) return;

    const channelId = inbox.channel.id;
    zaloPersonalApi
      .completeReauthorize(workspaceId, channelId, reauthSessionId)
      .then(() => {
        toast.success('Kết nối lại Zalo cá nhân thành công!', { id: `zp-reauth-${channelId}` });
        queryClient.invalidateQueries({ queryKey: inboxKeys.detail(workspaceId, inbox.id) });
      })
      .catch(err => {
        toast.error((err as Error).message || 'Không thể kết nối lại', {
          id: `zp-reauth-${channelId}`,
        });
      })
      .finally(() => {
        setReauthSessionId(null);
        setIsReauthOpen(false);
      });
  }, [
    reauthSessionId,
    sessionStatus?.status,
    workspaceId,
    inbox.channel?.id,
    inbox.id,
    queryClient,
  ]);

  const handleDisconnect = () => {
    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          isConnected: false,
        },
        successMessage: 'Đã ngắt kết nối Zalo cá nhân an toàn',
      },
      {
        onSuccess: () => {
          setIsDisconnectOpen(false);
        },
      },
    );
  };

  const isSyncing = isStartingReauth || Boolean(reauthSessionId);

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
                <CardTitle className="text-base font-semibold">Cấu hình Zalo cá nhân</CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Kênh không chính thức — tin nhắn được nhận trực tiếp qua phiên đăng nhập của tài
                khoản.
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
          <div className="rounded-lg border border-warning/30 bg-warning/10 p-3.5 text-xs flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-warning">
              <AlertTriangle className="size-4" />
              <span>Rủi ro tài khoản & vận hành</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Zalo không hỗ trợ API chính thức cho tài khoản cá nhân — tài khoản có thể bị khóa hoặc
              cấm bất cứ lúc nào. Chỉ dùng tài khoản phụ. Mỗi tài khoản chỉ giữ một phiên web duy
              nhất:{' '}
              <strong>không đăng nhập chat.zalo.me bằng cùng tài khoản khi bot đang chạy</strong>.
            </p>
          </div>

          {lastSyncError && (
            <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-destructive text-xs">
              <ShieldAlert className="size-4 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold">Lỗi kết nối:</span>
                <span className="text-muted-foreground">{lastSyncError}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#0068FF]/20 bg-[#0068FF]/5 p-4.5">
            <div className="flex items-center gap-3.5">
              <Avatar className="size-12 rounded-2xl border border-border shrink-0">
                <AvatarImage src={avatarUrl || undefined} alt={zaloName} />
                <AvatarFallback className="text-xs uppercase font-semibold">
                  {zaloName.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-semibold text-foreground truncate">{zaloName}</span>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                  {ownId && (
                    <span className="inline-flex items-center gap-1">
                      ID: <code className="font-mono text-[11px]">{ownId}</code>
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
                onClick={handleStartReauthorize}
                disabled={isSyncing}
                className="h-8 gap-1.5 text-xs font-medium border-[#0068FF]/30 text-[#0068FF] hover:bg-[#0068FF]/10"
              >
                {isSyncing ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                {reauthorizationRequired ? 'Kết nối lại' : 'Quét QR lại'}
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
            <MonitorOff className="size-4 text-[#0068FF]" />
            <CardTitle className="text-base font-semibold">Giữ phiên web duy nhất</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Tài khoản Zalo cá nhân chỉ duy trì một phiên web tại một thời điểm.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground leading-relaxed">
          Nếu bạn (hoặc ai đó) đăng nhập{' '}
          <Link
            href="https://chat.zalo.me"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[#0068FF] hover:underline"
          >
            chat.zalo.me
          </Link>{' '}
          bằng đúng tài khoản này, phiên của hệ thống sẽ bị Zalo ngắt và tin nhắn tạm dừng tiếp
          nhận. Hệ thống sẽ tự thử kết nối lại; nếu phiên đã chết hoàn toàn, bấm{' '}
          <strong>Quét QR lại</strong>.
        </CardContent>
      </Card>

      <Dialog open={isReauthOpen} onOpenChange={setIsReauthOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <QrCode className="size-4 text-[#0068FF]" />
              Quét mã QR để kết nối lại
            </DialogTitle>
            <DialogDescription className="text-xs">
              Mở app Zalo trên điện thoại và quét mã bằng tài khoản <strong>{zaloName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center gap-3 py-2">
            {sessionStatus?.status === 'failed' || sessionStatus?.status === 'expired' ? (
              <>
                <p className="text-xs text-destructive text-center">
                  {sessionStatus?.error || 'Phiên đã hết hạn. Vui lòng thử lại.'}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleStartReauthorize}
                  className="text-xs h-8"
                >
                  Tạo lại mã QR
                </Button>
              </>
            ) : sessionStatus?.status === 'connected' ? (
              <div className="flex items-center gap-2 text-xs text-success">
                <ShieldCheck className="size-4" />
                Đã xác thực — đang lưu phiên...
              </div>
            ) : sessionStatus?.qrImage ? (
              <img
                src={formatQrDataUrl(sessionStatus.qrImage)}
                alt="Mã QR đăng nhập Zalo"
                className="size-48 rounded-lg border border-border bg-white p-1"
              />
            ) : (
              <Spinner className="size-6 text-primary" />
            )}
            {sessionStatus?.status === 'scanned' && (
              <p className="text-xs text-muted-foreground">Đã quét — xác nhận trên điện thoại</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReauthSessionId(null);
                setIsReauthOpen(false);
              }}
              className="h-8 text-xs"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <PowerOff className="size-4" />
              Ngắt kết nối Zalo cá nhân
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bạn có chắc chắn muốn ngắt kết nối <strong>{zaloName}</strong> khỏi kênh này không?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground flex flex-col gap-2">
            <p>Khi ngắt kết nối:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Tin nhắn mới từ tài khoản Zalo này sẽ tạm dừng tiếp nhận.</li>
              <li>
                <strong>
                  Toàn bộ lịch sử hội thoại, tin nhắn cũ và danh bạ khách hàng vẫn được bảo lưu
                  100%.
                </strong>
              </li>
              <li>Bạn có thể kết nối lại bất cứ lúc nào bằng nút Quét QR lại.</li>
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
