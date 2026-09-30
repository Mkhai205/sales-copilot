'use client';

import {
  Clock,
  ExternalLink,
  Hash,
  MessageSquare,
  PowerOff,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface FacebookConnectionCardProps {
  isConnected: boolean;
  isSyncingSession: boolean;
  lastSyncError?: string;
  pageName: string;
  pageId: string;
  lastSyncAt?: string;
  isReauthorizing: boolean;
  onStartOAuth: () => void;
  onOpenDisconnect: (open: boolean) => void;
}

export function FacebookConnectionCard({
  isConnected,
  isSyncingSession,
  lastSyncError,
  pageName,
  pageId,
  lastSyncAt,
  isReauthorizing,
  onStartOAuth,
  onOpenDisconnect,
}: FacebookConnectionCardProps) {
  return (
    <Card className="border-border bg-card/40">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              <CardTitle className="text-base font-semibold text-foreground">
                Thông tin kết nối Facebook Fanpage
              </CardTitle>
            </div>
            <CardDescription className="text-xs mt-0.5">
              Tích hợp chính thức qua Facebook Graph API & nhận tin nhắn qua Messenger.
            </CardDescription>
          </div>

          <Badge
            variant="outline"
            className={
              isConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs py-1 px-2.5'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-500 text-xs py-1 px-2.5'
            }
          >
            {isConnected ? (
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5" />
                Đã kết nối
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

      <CardContent className="flex flex-col gap-4">
        {isSyncingSession && (
          <div className="flex items-center gap-2.5 rounded-lg border border-[#1877F2]/30 bg-[#1877F2]/10 p-3 text-xs text-[#1877F2]">
            <Spinner className="size-4 shrink-0" />
            <span className="font-medium">
              Đang hoàn tất đồng bộ và kích hoạt kết nối Fanpage Facebook...
            </span>
          </div>
        )}

        {lastSyncError && !isSyncingSession && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-500">
            <ShieldAlert className="size-4 shrink-0" />
            <span>
              Lỗi đồng bộ gần nhất: <span className="text-muted-foreground">{lastSyncError}</span>
            </span>
          </div>
        )}

        {isConnected ? (
          <div className="flex flex-col gap-4">
            {/* Fanpage Profile Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#1877F2]/20 bg-[#1877F2]/5 p-4.5">
              <div className="flex items-center gap-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">{pageName}</span>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="size-3 text-muted-foreground" />
                      Page ID: <code className="font-mono text-[11px]">{pageId}</code>
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
                <a
                  href={`https://facebook.com/${pageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-[#1877F2]/30 text-[#1877F2] hover:bg-[#1877F2]/10"
                  >
                    <ExternalLink className="size-3.5" />
                    Mở Fanpage trên Facebook
                  </Button>
                </a>
              </div>
            </div>

            {/* Action Bar: Re-authorize & Disconnect */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onStartOAuth}
                  disabled={isReauthorizing}
                  className="h-8 gap-1.5 text-xs font-medium"
                >
                  {isReauthorizing ? (
                    <>
                      <Spinner className="size-3.5" />
                      Đang kết nối...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="size-3.5 text-[#1877F2]" />
                      Ủy quyền lại 1-Click
                    </>
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenDisconnect(true)}
                  className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <PowerOff className="size-3.5" />
                  Ngắt kết nối
                </Button>
              </div>

              <span className="text-[11px] text-muted-foreground italic">
                Tự động chuyển tiếp tin nhắn qua Meta App
              </span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-dashed border-border p-5 bg-muted/20">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-foreground">
                Chưa kết nối Facebook Fanpage
              </span>
              <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
                Liên kết Fanpage của bạn chỉ với 1 cú nhấp chuột. Sales Copilot sẽ tự động nhận diện
                tin nhắn Messenger và kích hoạt bảo vệ bình luận.
              </p>
              <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-1">
                <span>1. Đăng nhập Facebook</span>
                <span>•</span>
                <span>2. Chọn Fanpage</span>
                <span>•</span>
                <span>3. Cấp quyền & Sẵn sàng</span>
              </div>
            </div>

            <Button
              size="sm"
              onClick={onStartOAuth}
              disabled={isReauthorizing}
              className="h-10 px-5 gap-2 text-xs font-medium bg-[#1877F2] text-white hover:bg-[#1877F2]/90 shadow-sm shrink-0"
            >
              {isReauthorizing ? (
                <>
                  <Spinner className="size-3.5" />
                  Đang chuyển hướng...
                </>
              ) : (
                <>
                  <svg
                    className="size-4 fill-current"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                  Kết nối với Facebook
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
