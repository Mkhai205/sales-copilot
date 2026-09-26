'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ShieldCheck, RefreshCw, Check, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { useFacebookDiscoveredPages } from '@/features/settings/inboxes/hooks/use-inboxes';
import { facebookApi } from '@/features/settings/inboxes/api/facebook';
import { useNewInbox } from '../../context/new-inbox-context';
import type { ChannelDefinition } from '../../channel-registry';

interface FacebookFlowProps {
  channel: ChannelDefinition;
}

export function FacebookFlow({ channel }: FacebookFlowProps) {
  const {
    workspaceId,
    workspaceSlug,
    sessionIdParam,
    backToChannelSelect,
    proceedToCollaboratorsForFacebook,
    pendingFbPageIds,
  } = useNewInbox();

  const [isRedirectingFb, setIsRedirectingFb] = React.useState(false);

  const {
    data: pages = [],
    isLoading: isLoadingPages,
    error: loadPagesError,
    refetch: refetchPages,
  } = useFacebookDiscoveredPages(workspaceId, sessionIdParam);

  const [selectedPageIds, setSelectedPageIds] = React.useState<string[]>(() => pendingFbPageIds);
  const hasInitializedPagesRef = React.useRef(false);

  React.useEffect(() => {
    if (pages.length > 0 && !hasInitializedPagesRef.current) {
      hasInitializedPagesRef.current = true;
      const eligibleIds = pages.filter(p => !p.isAlreadyConnected).map(p => p.pageId);
      if (pendingFbPageIds.length > 0) {
        const preserved = pendingFbPageIds.filter(id => eligibleIds.includes(id));
        setSelectedPageIds(preserved.length > 0 ? preserved : eligibleIds);
      } else {
        setSelectedPageIds(eligibleIds);
      }
    }
  }, [pages, pendingFbPageIds]);

  const handleStartFacebookOAuth = async () => {
    if (!workspaceId || isRedirectingFb) return;
    setIsRedirectingFb(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/${workspaceSlug}/settings/inboxes/new?channel=facebook`;

      const res = await facebookApi.getAuthUrl(workspaceId, origin, returnUrl);
      window.location.href = res.data.authUrl;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể khởi tạo ủy quyền Facebook';
      toast.error(message);
      setIsRedirectingFb(false);
    }
  };

  const handleToggleSelectPage = (pageId: string) => {
    setSelectedPageIds(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId],
    );
  };

  const eligiblePages = pages.filter(p => !p.isAlreadyConnected);
  const isAllEligibleSelected =
    eligiblePages.length > 0 && selectedPageIds.length === eligiblePages.length;
  const isSomeEligibleSelected =
    eligiblePages.length > 0 &&
    selectedPageIds.length > 0 &&
    selectedPageIds.length < eligiblePages.length;
  const selectAllCheckedState: boolean | 'indeterminate' = isSomeEligibleSelected
    ? 'indeterminate'
    : isAllEligibleSelected;

  const handleToggleSelectAll = () => {
    if (isAllEligibleSelected) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(eligiblePages.map(p => p.pageId));
    }
  };

  const handleProceed = () => {
    if (selectedPageIds.length === 0) return;
    proceedToCollaboratorsForFacebook(selectedPageIds);
  };

  // Case A: Discovered pages loaded after OAuth callback with sessionId
  if (sessionIdParam) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Chọn Fanpage Facebook để kết nối
            </h2>
            <p className="text-xs text-muted-foreground">
              Chọn các Fanpage bạn muốn nhập vào làm Hộp thư trong Sales Copilot.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartFacebookOAuth}
            disabled={isRedirectingFb}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="size-3" />
            Đổi tài khoản / Làm mới
          </Button>
        </div>

        {isLoadingPages ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 rounded-xl border border-border bg-card/30 text-center">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs text-muted-foreground">Đang tải danh sách Fanpage từ Meta...</p>
          </div>
        ) : loadPagesError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-destructive/30 bg-destructive/5 text-center">
            <p className="text-xs text-destructive">
              {loadPagesError instanceof Error
                ? loadPagesError.message
                : 'Không thể tìm nạp danh sách Facebook Fanpage.'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchPages()}
                className="text-xs h-8"
              >
                Thử tải lại
              </Button>
              <Button size="sm" onClick={handleStartFacebookOAuth} className="text-xs h-8">
                Đăng nhập lại Facebook
              </Button>
            </div>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed border-border bg-card/20 text-center">
            <p className="text-xs text-muted-foreground">
              Không tìm thấy Fanpage nào. Đảm bảo tài khoản Facebook của bạn có quyền quản trị
              Fanpage.
            </p>
            <Button size="sm" onClick={handleStartFacebookOAuth} className="text-xs h-8">
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {eligiblePages.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
                Tất cả các Fanpage thuộc tài khoản Facebook này đã được kết nối vào hệ thống. Để kết
                nối thêm Fanpage khác, vui lòng bấm &quot;Đổi tài khoản / Làm mới&quot;.
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="select-all"
                  checked={selectAllCheckedState}
                  disabled={eligiblePages.length === 0}
                  onCheckedChange={handleToggleSelectAll}
                />
                <label
                  htmlFor="select-all"
                  className={`text-xs font-medium ${
                    eligiblePages.length === 0
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'text-foreground cursor-pointer select-none'
                  }`}
                >
                  Chọn tất cả Fanpage đủ điều kiện ({eligiblePages.length})
                </label>
              </div>

              <span className="text-xs text-muted-foreground">
                Đã chọn {selectedPageIds.length} / {eligiblePages.length}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {pages.map(page => {
                const isConnected = page.isAlreadyConnected;
                const isSelected = selectedPageIds.includes(page.pageId);

                return (
                  <div
                    key={page.pageId}
                    onClick={() => {
                      if (!isConnected) handleToggleSelectPage(page.pageId);
                    }}
                    className={`flex items-center justify-between gap-3 p-3.5 rounded-xl border transition-all select-none ${
                      isConnected
                        ? 'opacity-60 bg-muted/20 border-border cursor-not-allowed'
                        : isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30 cursor-pointer shadow-xs'
                          : 'border-border bg-card/40 hover:border-border/80 hover:bg-card/70 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Checkbox
                        checked={isSelected}
                        disabled={isConnected}
                        onCheckedChange={() => {
                          if (!isConnected) handleToggleSelectPage(page.pageId);
                        }}
                      />
                      <Avatar className="size-9 rounded-lg border border-border shrink-0">
                        <AvatarImage src={page.avatarUrl} alt={page.pageName} />
                        <AvatarFallback className="text-[10px] uppercase font-semibold">
                          {page.pageName.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold text-foreground truncate">
                          {page.pageName}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {page.category || `ID: ${page.pageId}`}
                        </span>
                      </div>
                    </div>

                    {isConnected ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0 font-normal">
                        Đã liên kết
                      </Badge>
                    ) : isSelected ? (
                      <Check className="size-4 text-primary shrink-0" />
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={backToChannelSelect}
                className="text-xs h-8 gap-1.5"
              >
                <ArrowLeft className="size-3" />
                Chọn kênh khác
              </Button>
              <Button
                size="sm"
                onClick={handleProceed}
                disabled={selectedPageIds.length === 0}
                className="text-xs h-8 gap-1.5 font-medium"
              >
                Tiếp tục: Phân bổ nhân sự
                <ArrowRight className="size-3.5" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Case B: Not yet connected with Facebook OAuth
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
              <img src={channel.logoSrc} alt={channel.title} className="size-7 object-contain" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Đăng nhập với Facebook</CardTitle>
              <CardDescription className="text-xs">
                Cấp quyền cho Sales Copilot truy cập các Fanpage và quản lý tin nhắn khách hàng.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Kết nối trực tiếp OAuth an toàn qua Meta</span>
            </div>
            <p>
              Khi nhấp vào nút bên dưới, bạn sẽ được chuyển hướng đến trang ủy quyền chính thức của
              Meta. Bạn có thể chọn những Fanpage muốn kết nối. Sau khi cấp quyền, Meta sẽ chuyển
              hướng an toàn trở lại Sales Copilot với danh sách Fanpage sẵn sàng tạo hộp thư.
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
              onClick={handleStartFacebookOAuth}
              disabled={isRedirectingFb}
              className="h-9 bg-[#1877F2] text-white hover:bg-[#1877F2]/90 font-medium px-5 gap-2 text-xs"
            >
              {isRedirectingFb ? (
                <>
                  <Spinner className="size-3.5" />
                  Đang kết nối Facebook...
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
                  Tiếp tục với Facebook
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
