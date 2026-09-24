'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Globe,
  Send,
  ShieldCheck,
  Mail,
  Plus,
  Settings,
  Check,
  Copy,
} from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { CreatedResult } from './types';

interface StepFinishGuideProps {
  createdResult: CreatedResult;
  workspaceSlug: string;
  origin: string;
  onCreateAnother: () => void;
}

export function StepFinishGuide({
  createdResult,
  workspaceSlug,
  origin,
  onCreateAnother,
}: StepFinishGuideProps) {
  const router = useRouter();
  const [copiedCode, setCopiedCode] = React.useState(false);

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
        inboxId: "${createdResult.id}",
        websiteToken: "${createdResult.providerAccountId || createdResult.id}"
      });
    };
  })(document,"script");
</script>
<!-- End Sales Copilot Live Chat -->`;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Đã sao chép mã nhúng vào bộ nhớ tạm');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Success Card */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-6 pb-6 flex flex-col items-center text-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-xs">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Hộp thư đã sẵn sàng hoạt động!
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              Hộp thư <strong className="text-foreground">{createdResult.name}</strong> đã được cấu
              hình thành công và phân bổ cho nhân sự trong Workspace.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integration Details Guide */}
      {createdResult.channelType === ChannelType.WEB_CHAT && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="size-4 text-emerald-500" />
                <CardTitle className="text-sm font-semibold">Mã nhúng Website Live Chat</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCode(embedScript)}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {copiedCode ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedCode ? 'Đã sao chép' : 'Sao chép mã nhúng'}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Dán đoạn mã script này trước thẻ đóng{' '}
              <code className="font-mono text-foreground">&lt;/body&gt;</code> trên website của bạn.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="p-3.5 rounded-lg bg-muted/60 border border-border text-[11px] font-mono text-muted-foreground overflow-x-auto select-all leading-relaxed">
              {embedScript}
            </pre>
          </CardContent>
        </Card>
      )}

      {createdResult.channelType === ChannelType.TELEGRAM && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Send className="size-4 text-sky-500" />
              <CardTitle className="text-sm font-semibold">Thử nghiệm Telegram Bot</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mở Telegram và gửi lệnh <code className="font-mono">/start</code> vào bot của bạn để
              tạo hội thoại đầu tiên.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Webhook tiếp nhận sự kiện đã được kích hoạt tự động tại đường dẫn:
              <div className="font-mono text-[11px] text-foreground mt-1 select-all">
                {origin}/api/webhooks/telegram/{createdResult.id}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {createdResult.channelType === ChannelType.FACEBOOK_MESSENGER && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold">
                Facebook Fanpage đã đồng bộ Webhook
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mọi tin nhắn khách hàng gửi vào Fanpage sẽ được truyền trực tiếp vào Hộp thư đến theo
              thời gian thực (Realtime &lt; 1s).
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {createdResult.channelType === ChannelType.ZALO && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-500" />
                <CardTitle className="text-sm font-semibold">
                  Cấu hình Webhook Zalo Official Account
                </CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCode(`${origin}/api/webhooks/zalo`)}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {copiedCode ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedCode ? 'Đã sao chép' : 'Sao chép Webhook URL'}
              </Button>
            </div>
            <CardDescription className="text-xs">
              Cấu hình đường dẫn Webhook này vào mục Quản lý ứng dụng Zalo Developer để tiếp nhận
              tin nhắn từ Zalo OA.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Đường dẫn Webhook tiếp nhận sự kiện Zalo OA:
              <div className="font-mono text-[11px] text-foreground mt-1 select-all">
                {origin}/api/webhooks/zalo
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {createdResult.channelType === ChannelType.EMAIL && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">Hòm thư hỗ trợ Email sẵn sàng</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Mọi email gửi đến hộp thư được cấu hình sẽ tự động tạo thành cuộc hội thoại trong
              Sales Copilot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              Địa chỉ email đã liên kết:
              <div className="font-mono text-[11px] text-foreground mt-1 select-all">
                {createdResult.providerAccountId || createdResult.name}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={onCreateAnother} className="text-xs h-9 gap-1.5">
          <Plus className="size-3.5" />
          Tạo thêm hộp thư khác
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${workspaceSlug}/settings/inboxes`)}
            className="text-xs h-9"
          >
            Danh sách Hộp thư
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/${workspaceSlug}/settings/inboxes/${createdResult.id}`)}
            className="text-xs h-9 gap-1.5 font-medium"
          >
            <Settings className="size-3.5" data-icon="inline-start" />
            Cấu hình chi tiết
          </Button>
        </div>
      </div>
    </div>
  );
}
