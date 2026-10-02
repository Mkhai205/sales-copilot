'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, ArrowLeft, QrCode, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChannelFlowLayout } from '../../components/channel-flow-layout';
import { useNewInbox } from '../../context/new-inbox-context';
import { zaloPersonalApi } from '../../../api/zalo-personal';
import { zaloPersonalChannelSchema, type ZaloPersonalFormValues } from './zalo-personal-schema';
import type { ChannelDefinition } from '../../channel-registry';

const QR_POLL_INTERVAL_MS = 2000;

function formatQrDataUrl(qrImage?: string): string {
  if (!qrImage) return '';
  return qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`;
}

export function ZaloPersonalFlow({ channel }: ZaloPersonalFlowProps) {
  const { workspaceId, backToChannelSelect, submitChannelDraft, isSubmitting } = useNewInbox();

  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = React.useState(false);

  // Poll the QR session status while a session is active.
  const { data: sessionStatus } = useQuery({
    queryKey: ['inboxes', workspaceId, 'zalo-personal', 'connect-session', sessionId] as const,
    queryFn: async () => {
      const res = await zaloPersonalApi.getConnectSessionStatus(workspaceId, sessionId!);
      return res.data;
    },
    enabled: Boolean(workspaceId && sessionId),
    refetchInterval: query => {
      const status = query.state.data?.status;
      return status === 'connected' || status === 'failed' || status === 'expired'
        ? false
        : QR_POLL_INTERVAL_MS;
    },
  });

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      const res = await zaloPersonalApi.createConnectSession(workspaceId);
      setSessionId(res.data.sessionId);
    } catch (err) {
      toast.error((err as Error).message || 'Không thể tạo phiên quét mã QR');
    } finally {
      setIsCreatingSession(false);
    }
  };

  const methods = useForm<ZaloPersonalFormValues>({
    resolver: zodResolver(zaloPersonalChannelSchema),
    defaultValues: { name: '', avatarUrl: '', connectSessionId: '' },
  });

  const isConnected = sessionStatus?.status === 'connected';

  // Keep the form value in sync so zod validation passes only after a successful scan.
  React.useEffect(() => {
    if (isConnected && sessionId) {
      methods.setValue('connectSessionId', sessionId, { shouldValidate: true });
    }
  }, [isConnected, sessionId, methods]);

  const onSubmit = (data: ZaloPersonalFormValues) => {
    submitChannelDraft({
      name: data.name?.trim() || sessionStatus?.profileName || 'Zalo Cá nhân',
      avatarUrl: data.avatarUrl?.trim() || sessionStatus?.profileAvatar,
      credentials: { sessionId: data.connectSessionId },
      providerAccountId: sessionStatus?.ownId,
      channelType: channel.type,
    });
  };

  // ── Phase A: not yet scanning — intro + ToS warning
  if (!sessionId) {
    return (
      <div className="flex flex-col gap-4">
        <Card className="border-border bg-card/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
                <img src={channel.logoSrc} alt={channel.title} className="size-7 object-contain" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Kết nối Zalo cá nhân</CardTitle>
                <CardDescription className="text-xs">
                  Quét mã QR bằng app Zalo để đưa tài khoản cá nhân của bạn vào hộp thư chung.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-5 pt-2">
            <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 text-xs leading-relaxed flex flex-col gap-2">
              <div className="flex items-center gap-2 font-medium text-warning">
                <AlertTriangle className="size-4" />
                <span>Quan trọng — rủi ro tài khoản</span>
              </div>
              <p className="text-muted-foreground">
                Zalo <strong>không hỗ trợ API chính thức cho tài khoản cá nhân</strong>. Kênh này
                hoạt động ở chế độ không chính thức và{' '}
                <strong>
                  tài khoản của bạn có thể bị Zalo khóa hoặc cấm sử dụng bất cứ lúc nào
                </strong>
                . Hãy dùng một <strong>tài khoản phụ</strong> riêng cho việc này, không dùng tài
                khoản kinh doanh hay chứa dữ liệu quan trọng.
              </p>
              <p className="text-muted-foreground">
                Lưu ý vận hành: mỗi tài khoản chỉ giữ <strong>một phiên web duy nhất</strong> —
                không mở Zalo trên trình duyệt bằng cùng tài khoản khi bot đang chạy.
              </p>
            </div>

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
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                className="h-9 bg-[#0068FF] text-white hover:bg-[#0068FF]/90 font-medium px-5 gap-2 text-xs"
              >
                {isCreatingSession ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang tạo phiên...
                  </>
                ) : (
                  <>
                    <QrCode className="size-4" />
                    Tạo mã QR kết nối
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Phase B: scanning / connected
  return (
    <FormProvider {...methods}>
      <ChannelFlowLayout
        channel={channel}
        onSubmit={methods.handleSubmit(onSubmit)}
        isSubmitting={isSubmitting}
        submitDisabled={!isConnected}
      >
        {sessionStatus?.status === 'failed' || sessionStatus?.status === 'expired' ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center flex flex-col gap-3">
            <p className="text-xs text-destructive">
              {sessionStatus?.error ||
                'Phiên quét mã QR đã hết hạn hoặc thất bại. Vui lòng tạo phiên mới.'}
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCreateSession}
                className="text-xs h-8"
              >
                <QrCode className="size-3" />
                Tạo lại mã QR
              </Button>
            </div>
          </div>
        ) : isConnected ? (
          <div className="flex items-center gap-3 rounded-xl border border-success/30 bg-success/5 p-3.5">
            <Avatar className="size-10 rounded-lg border border-border shrink-0">
              <AvatarImage
                src={sessionStatus?.profileAvatar}
                alt={sessionStatus?.profileName || 'Zalo'}
              />
              <AvatarFallback className="text-[10px] uppercase font-semibold">
                {(sessionStatus?.profileName || 'Zalo').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground truncate">
                {sessionStatus?.profileName || 'Tài khoản Zalo'}
              </span>
              <span className="text-[11px] text-success flex items-center gap-1">
                <ShieldCheck className="size-3" />
                Đã đăng nhập thành công · ID: {sessionStatus?.ownId}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border border-border bg-card/30 text-center">
            {sessionStatus?.qrImage ? (
              <div className="relative">
                <img
                  src={formatQrDataUrl(sessionStatus.qrImage)}
                  alt="Mã QR đăng nhập Zalo"
                  className="size-48 rounded-lg border border-border bg-white p-1"
                />
                {sessionStatus?.status === 'scanned' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                    <span className="text-xs font-medium text-success">
                      Đã quét — kiểm tra điện thoại
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <Spinner className="size-6 text-primary" />
            )}
            <p className="text-xs text-muted-foreground">
              Mở app Zalo trên điện thoại → quét mã này để đăng nhập tài khoản phụ.
            </p>
          </div>
        )}

        {methods.formState.errors.connectSessionId && (
          <FieldError errors={[methods.formState.errors.connectSessionId]} />
        )}
      </ChannelFlowLayout>
    </FormProvider>
  );
}

interface ZaloPersonalFlowProps {
  channel: ChannelDefinition;
}
