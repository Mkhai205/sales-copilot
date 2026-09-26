'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Globe,
  Send,
  ShieldCheck,
  Plus,
  Settings,
  List,
  ExternalLink,
} from 'lucide-react';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNewInbox } from '../context/new-inbox-context';

export function SuccessSummaryStep() {
  const router = useRouter();
  const { createdSummary, workspaceSlug, origin, resetFlow } = useNewInbox();
  const [copiedCode, setCopiedCode] = React.useState(false);

  if (!createdSummary) {
    return null;
  }

  const websiteToken =
    createdSummary.providerAccountId ||
    `sec_live_${createdSummary.id.replace(/-/g, '').slice(0, 24)}`;

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
        inboxId: "${createdSummary.id}",
        websiteToken: "${websiteToken}"
      });
    };
  })(document,"script");
</script>
<!-- End Sales Copilot Live Chat -->`;

  const handleCopyCode = async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (typeof document !== 'undefined') {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(true);
      toast.success('Đã sao chép mã nhúng vào bộ nhớ tạm');
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      toast.error('Không thể sao chép tự động, vui lòng chọn đoạn mã và nhấn Ctrl+C');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Success Banner */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="pt-3 pb-3 flex flex-col items-center text-center gap-3">
          <div className="flex items-center justify-center text-emerald-500">
            <CheckCircle2 className="size-8" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Hộp thư đã sẵn sàng hoạt động!
            </h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Hộp thư <strong className="text-foreground">{createdSummary.name}</strong> đã được cấu
              hình thành công và phân bổ cho các nhân viên trong không gian làm việc.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Channel-Specific Integration Guide */}
      {createdSummary.channelType === ChannelType.WEB_CHAT && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="size-4 text-emerald-500" />
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
          <CardContent className="flex flex-col gap-4">
            {/* Dark macOS Terminal Style Code Box */}
            <div className="rounded-lg border border-border/80 bg-slate-950 dark:bg-zinc-950 overflow-hidden shadow-xs flex flex-col">
              <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/90 px-3 py-1.5 text-[10px] text-slate-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-red-400/80" />
                  <div className="size-2 rounded-full bg-amber-400/80" />
                  <div className="size-2 rounded-full bg-emerald-400/80" />
                  <span className="ml-1 text-slate-300">index.html</span>
                </div>
                <span>HTML &bull; UTF-8</span>
              </div>
              <pre className="p-3.5 text-[11px] font-mono text-slate-200 leading-relaxed overflow-x-auto whitespace-pre select-all max-h-[360px]">
                {embedScript}
              </pre>
            </div>

            {/* Quick 3-Step Integration Guide */}
            <div className="rounded-lg border border-border/70 bg-muted/30 p-3.5 flex flex-col gap-2">
              <span className="text-xs font-semibold text-foreground">
                Hướng dẫn tích hợp nhanh:
              </span>
              <ol className="text-xs text-muted-foreground space-y-1.5 pl-4 list-decimal leading-relaxed">
                <li>Sao chép toàn bộ đoạn mã script phía trên.</li>
                <li>
                  Dán vào mã nguồn website (HTML, WordPress, Webflow, Shopify...) ngay trước thẻ{' '}
                  <code className="font-mono text-foreground font-semibold">&lt;/body&gt;</code>.
                </li>
                <li>
                  Tải lại trang web để kiểm tra biểu tượng chat xuất hiện ở góc dưới bên phải màn
                  hình.
                </li>
              </ol>
            </div>
          </CardContent>
        </Card>
      )}

      {createdSummary.channelType === ChannelType.TELEGRAM && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Send className="size-4 text-sky-500" />
                <CardTitle className="text-sm font-semibold">Thử nghiệm Telegram Bot</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <a href="https://t.me/" target="_blank" rel="noreferrer">
                  Mở Telegram
                  <ExternalLink className="size-3 text-muted-foreground" />
                </a>
              </Button>
            </div>
            <CardDescription className="text-xs">
              Mở Telegram và gửi tin nhắn hoặc lệnh <code className="font-mono">/start</code> vào
              bot của bạn để bắt đầu hội thoại đầu tiên.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {createdSummary.providerAccountId ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>ID Bot:</span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {createdSummary.providerAccountId}
                </Badge>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>
                Webhook tiếp nhận sự kiện đã được kích hoạt tự động với Telegram Bot API. Bạn có thể
                bắt đầu nhắn tin với bot ngay bây giờ.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {createdSummary.channelType === ChannelType.FACEBOOK_MESSENGER && (
        <Card className="border-border bg-card/40">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-2 rounded-full bg-emerald-500" />
              <CardTitle className="text-sm font-semibold">
                Fanpage Facebook đã được kết nối
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Webhook tin nhắn Messenger từ Meta đã được liên kết với Sales Copilot.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3.5">
            {/* Connected Fanpages Badge List */}
            {createdSummary.connectedItems && createdSummary.connectedItems.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-foreground">
                  Danh sách Fanpage đã kết nối:
                </span>
                <div className="flex flex-wrap gap-2">
                  {createdSummary.connectedItems.map(item => (
                    <Badge
                      key={item.id}
                      variant="secondary"
                      className="gap-1.5 py-1 px-2.5 text-xs font-medium border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    >
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                      {item.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
              <ShieldCheck className="size-4 text-emerald-500 shrink-0" />
              <span>
                Tin nhắn mới từ khách hàng trên các Fanpage này sẽ xuất hiện tức thì tại trang Hội
                thoại.
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <Button variant="ghost" size="sm" onClick={resetFlow} className="text-xs h-9 gap-1.5">
          <Plus className="size-3.5" />
          Tạo thêm hộp thư khác
        </Button>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/${workspaceSlug}/settings/inboxes`)}
            className="text-xs h-9 gap-1.5"
          >
            <List className="size-3.5" />
            Danh sách Hộp thư
          </Button>
          <Button
            size="sm"
            onClick={() => router.push(`/${workspaceSlug}/settings/inboxes/${createdSummary.id}`)}
            className="text-xs h-9 gap-1.5 font-medium"
          >
            <Settings className="size-3.5" />
            Cấu hình chi tiết
          </Button>
        </div>
      </div>
    </div>
  );
}
