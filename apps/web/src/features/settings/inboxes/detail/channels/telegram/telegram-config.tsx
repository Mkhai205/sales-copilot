'use client';

import * as React from 'react';
import {
  Send,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Bot,
  KeyRound,
  PowerOff,
  AlertTriangle,
  AlertCircle,
  Clock,
  Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { type InboxDetailDto } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import Link from 'next/link';

interface TelegramConfigProps {
  inbox: InboxDetailDto;
  workspaceId: string;
}

export function TelegramConfig({ inbox, workspaceId }: TelegramConfigProps) {
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);

  // Connect form state (when disconnected)
  const [connectToken, setConnectToken] = React.useState('');
  const [showConnectToken, _setShowConnectToken] = React.useState(false);

  // Re-auth modal state (when connected)
  const [isReauthOpen, setIsReauthOpen] = React.useState(false);
  const [reauthToken, setReauthToken] = React.useState('');
  const [showReauthToken, _setShowReauthToken] = React.useState(false);

  // Disconnect modal state
  const [isDisconnectOpen, setIsDisconnectOpen] = React.useState(false);

  const channelSettings = (inbox.channel?.settings as Record<string, any>) || {};
  const isConnected = Boolean(inbox.channel?.isConnected);
  const botUsername =
    channelSettings.botUsername ||
    (inbox.channel?.providerAccountId && !inbox.channel?.providerAccountId.match(/^\d+$/)
      ? inbox.channel?.providerAccountId
      : 'SalesCopilotSupportBot');
  const botName = channelSettings.botName || inbox.name || 'Telegram Bot Support';
  const botId = channelSettings.botId || inbox.channel?.providerAccountId || '7192837465';
  const lastSyncAt = channelSettings.lastSyncAt;
  const lastSyncError = channelSettings.lastSyncError;

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectToken.trim()) {
      toast.error('Vui lòng nhập Telegram Bot Token');
      return;
    }

    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          channelCredentials: {
            botToken: connectToken.trim(),
          },
          isConnected: true,
        },
        successMessage: 'Đang kết nối với Telegram Bot API...',
      },
      {
        onSuccess: () => {
          setConnectToken('');
        },
      },
    );
  };

  const handleReauth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthToken.trim()) {
      toast.error('Vui lòng nhập Token mới được cấp lại');
      return;
    }

    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          channelCredentials: {
            botToken: reauthToken.trim(),
          },
          isConnected: true,
        },
        successMessage: 'Cập nhật lại Token thành công',
      },
      {
        onSuccess: () => {
          setReauthToken('');
          setIsReauthOpen(false);
        },
      },
    );
  };

  const handleDisconnect = () => {
    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          isConnected: false,
        },
        successMessage: 'Đã ngắt kết nối Telegram Bot an toàn',
      },
      {
        onSuccess: () => {
          setIsDisconnectOpen(false);
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Send className="size-4 text-[#229ED9]" />
                <CardTitle className="text-base font-semibold">Cấu hình Telegram Bot</CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Tích hợp tự động với Telegram Bot API thông qua Webhook sự kiện thời gian thực.
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

          {isConnected ? (
            <div className="flex flex-col gap-4">
              {/* Bot Profile Card */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#229ED9]/20 bg-[#229ED9]/5 p-4.5">
                <div className="flex items-center gap-3.5">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-sm">
                    <Bot className="size-6" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{botName}</span>
                      <Badge variant="link" className="text-[10px] py-0 px-1.5 h-4.5 font-mono">
                        @{botUsername}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="inline-flex items-center gap-1">
                        <Hash className="size-3 text-muted-foreground" />
                        ID: <code className="font-mono text-[11px]">{botId}</code>
                      </span>
                      {lastSyncAt && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" />
                          Đồng bộ: {new Date(lastSyncAt).toLocaleTimeString('vi-VN')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                  <Link
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs border-[#229ED9]/30 text-[#229ED9] hover:bg-[#229ED9]/10"
                    >
                      <ExternalLink className="size-3.5" />
                      Mở bot trên Telegram
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Action Bar: Cấp lại Token & Ngắt kết nối */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReauthOpen(true)}
                    className="h-8 gap-1.5 text-xs font-medium"
                  >
                    <KeyRound className="size-3.5" />
                    Cấp lại Token
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

                <span className="text-[11px] text-muted-foreground italic">
                  Webhook tự động quản trị bởi hệ thống
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="telegram-token" className="text-xs font-medium">
                  HTTP API Token từ @BotFather
                </FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id="telegram-token"
                    type={showConnectToken ? 'text' : 'password'}
                    value={connectToken}
                    onChange={e => setConnectToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxYZ_sample"
                    className="h-8 text-xs font-mono"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isUpdating || !connectToken.trim()}
                    className="h-9 text-xs shrink-0 font-medium bg-[#229ED9] text-white hover:bg-[#229ED9]/90"
                  >
                    {isUpdating ? <Spinner className="size-3.5" /> : 'Kết nối Telegram Bot'}
                  </Button>
                </div>
                <FieldDescription className="text-[11px] text-muted-foreground mt-1">
                  Nhập Token HTTP API bạn nhận được khi tạo bot bằng lệnh{' '}
                  <code className="font-mono text-foreground bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                    /newbot
                  </code>{' '}
                  trên @BotFather.
                </FieldDescription>
              </Field>
            </form>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="size-4 text-[#229ED9]" />
              <CardTitle className="text-base font-semibold">
                Hướng dẫn tạo & kết nối Telegram Bot
              </CardTitle>
            </div>
            <Link
              href="https://t.me/BotFather"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#229ED9] hover:underline"
            >
              <span>Mở @BotFather</span>
              <ExternalLink className="size-3" />
            </Link>
          </div>
          <CardDescription className="text-xs">
            Khởi tạo bot hoàn toàn miễn phí từ BotFather chính thức của Telegram chỉ với 3 bước đơn
            giản.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9] text-[10px] font-bold">
                  1
                </span>
                Chat với @BotFather
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Mở ứng dụng Telegram và tìm bot{' '}
                <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                  @BotFather
                </code>{' '}
                có tích xanh chính thức, sau đó nhấn <strong>Start</strong>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9] text-[10px] font-bold">
                  2
                </span>
                Tạo bot mới (/newbot)
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Gửi lệnh{' '}
                <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                  /newbot
                </code>
                . Nhập tên hiển thị (VD: Shop Trợ Lý) và username kết thúc bằng{' '}
                <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                  _bot
                </code>
                .
              </p>
            </div>

            <div className="flex flex-col gap-1.5 rounded-xl border border-border/80 bg-muted/20 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#229ED9]/10 text-[#229ED9] text-[10px] font-bold">
                  3
                </span>
                Sao chép HTTP API Token
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                BotFather sẽ phản hồi kèm chuỗi token dạng{' '}
                <code className="text-foreground font-mono bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                  123456:ABC-DEF...
                </code>
                . Dán vào ô ở trên và nhấn Kết nối.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isReauthOpen} onOpenChange={setIsReauthOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
              <KeyRound className="size-4 text-[#229ED9]" />
              Cấp lại Bot Token cho @{botUsername}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chỉ sử dụng tính năng này khi Token cũ của bot bị lộ và bạn đã chạy lệnh{' '}
              <code className="font-mono text-foreground bg-muted/60 px-1 py-0.5 rounded text-[10px]">
                /revoke
              </code>{' '}
              trên @BotFather.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleReauth} className="flex flex-col gap-4 py-2">
            {/* Warning Alert Box */}
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-warning dark:text-warning text-xs">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Lưu ý bảo mật:</strong> Token mới bắt buộc phải thuộc về cùng con bot hiện
                tại (<strong>@{botUsername}</strong>). Hệ thống sẽ chặn và từ chối nếu bạn nhập
                token của một bot khác.
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="reauth-token" className="text-xs font-medium">
                HTTP API Token mới từ @BotFather
              </FieldLabel>
              <div className="flex items-center gap-2 mt-1">
                <Input
                  id="reauth-token"
                  type={showReauthToken ? 'text' : 'password'}
                  value={reauthToken}
                  onChange={e => setReauthToken(e.target.value)}
                  placeholder="Nhập Token mới..."
                  className="h-8 text-xs font-mono"
                  autoFocus
                />
              </div>
            </Field>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsReauthOpen(false)}
                className="h-8 text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isUpdating || !reauthToken.trim()}
                className="h-8 text-xs bg-[#229ED9] text-white hover:bg-[#229ED9]/90 font-medium"
              >
                {isUpdating ? <Spinner className="size-3.5" /> : 'Xác nhận & Cập nhật'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <PowerOff className="size-4" />
              Ngắt kết nối Telegram Bot
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bạn có chắc chắn muốn ngắt kết nối bot <strong>@{botUsername}</strong> khỏi kênh này
              không?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground flex flex-col gap-2">
            <p>Khi ngắt kết nối:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>
                Telegram Webhook sẽ bị gỡ bỏ, tin nhắn mới từ khách hàng sẽ tạm dừng tiếp nhận.
              </li>
              <li>
                <strong>
                  Toàn bộ lịch sử hội thoại, tin nhắn cũ và danh bạ khách hàng vẫn được bảo lưu
                  100%.
                </strong>
              </li>
              <li>Bạn có thể kết nối lại bot bất cứ lúc nào bằng cách nhập Token.</li>
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
