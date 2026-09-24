'use client';

import * as React from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ShieldCheck, ChevronDown, ChevronUp, RefreshCw, CheckCircle2, Check } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ChannelType } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { facebookApi, type FacebookPageInfo } from '../api/facebook';
import { inboxKeys } from '@/lib/query-keys';
import type { CreatedResult } from './types';

interface StepFacebookOAuthProps {
  workspaceId: string;
  workspaceSlug: string;
  sessionIdParam: string | null;
  selectedMemberUserIds: string[];
  onCancel: () => void;
  onSuccess: (result: CreatedResult) => void;
}

export function StepFacebookOAuth({
  workspaceId,
  workspaceSlug,
  sessionIdParam,
  selectedMemberUserIds,
  onCancel,
  onSuccess,
}: StepFacebookOAuthProps) {
  const queryClient = useQueryClient();

  // Facebook OAuth State
  const [isRedirectingFb, setIsRedirectingFb] = React.useState(false);
  const [isLoadingPages, setIsLoadingPages] = React.useState(false);
  const [pages, setPages] = React.useState<FacebookPageInfo[]>([]);
  const [selectedPageIds, setSelectedPageIds] = React.useState<string[]>([]);
  const [assignAllMembers, setAssignAllMembers] = React.useState(true);
  const [isSubmittingBatch, setIsSubmittingBatch] = React.useState(false);

  // Manual Facebook Fallback State
  const [isManualFbOpen, setIsManualFbOpen] = React.useState(false);
  const [manualFbPageId, setManualFbPageId] = React.useState('');
  const [manualFbPageName, setManualFbPageName] = React.useState('');
  const [manualFbToken, setManualFbToken] = React.useState('');
  const [isSubmittingManualFb, setIsSubmittingManualFb] = React.useState(false);

  const loadDiscoveredPages = React.useCallback(
    async (sessId: string) => {
      if (!workspaceId) return;
      setIsLoadingPages(true);
      try {
        const res = await facebookApi.discoverPages(workspaceId, sessId);
        const fetchedPages = res.data || [];
        setPages(fetchedPages);

        const eligibleIds = fetchedPages.filter(p => !p.isAlreadyConnected).map(p => p.pageId);
        setSelectedPageIds(eligibleIds);
      } catch (err: any) {
        toast.error(err.message || 'Không thể tìm nạp danh sách Facebook Fanpage');
      } finally {
        setIsLoadingPages(false);
      }
    },
    [workspaceId],
  );

  React.useEffect(() => {
    if (sessionIdParam && workspaceId) {
      loadDiscoveredPages(sessionIdParam);
    }
  }, [sessionIdParam, workspaceId, loadDiscoveredPages]);

  const handleStartFacebookOAuth = async () => {
    if (!workspaceId || isRedirectingFb) return;
    setIsRedirectingFb(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/${workspaceSlug}/settings/inboxes/new?channel=facebook`;

      const res = await facebookApi.getAuthUrl(workspaceId, origin, returnUrl);
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast.error(err.message || 'Không thể khởi tạo ủy quyền Facebook');
      setIsRedirectingFb(false);
    }
  };

  const handleToggleSelectPage = (pageId: string) => {
    setSelectedPageIds(prev =>
      prev.includes(pageId) ? prev.filter(id => id !== pageId) : [...prev, pageId],
    );
  };

  const eligiblePages = pages.filter(p => !p.isAlreadyConnected);

  const handleToggleSelectAll = () => {
    if (selectedPageIds.length === eligiblePages.length) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(eligiblePages.map(p => p.pageId));
    }
  };

  const handleConnectFacebookBatch = async () => {
    if (!workspaceId || !sessionIdParam || selectedPageIds.length === 0) return;
    setIsSubmittingBatch(true);

    try {
      const res = await facebookApi.connectPagesBatch(workspaceId, {
        pageIds: selectedPageIds,
        sessionId: sessionIdParam,
        assignAllMembers,
      });

      const count = res.data.inboxes.length;
      toast.success(`Đã kết nối thành công ${count} Fanpage Facebook!`);
      queryClient.invalidateQueries({ queryKey: inboxKeys.list(workspaceId) });

      const firstInbox = res.data.inboxes[0];
      onSuccess({
        id: firstInbox?.inboxId || '',
        name:
          count === 1 ? firstInbox?.pageName || 'Facebook Fanpage' : `${count} Fanpage Facebook`,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: firstInbox?.pageId,
        count,
      });
    } catch (err: any) {
      toast.error(err.message || 'Không thể kết nối các Fanpage đã chọn');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleConnectManualFb = async () => {
    if (!workspaceId || !manualFbPageId.trim() || !manualFbToken.trim()) {
      toast.error('Page ID và Page Access Token là bắt buộc');
      return;
    }

    setIsSubmittingManualFb(true);
    try {
      const res = await facebookApi.connectPage(workspaceId, {
        pageId: manualFbPageId.trim(),
        pageName: manualFbPageName.trim() || `Facebook Page (${manualFbPageId.trim()})`,
        pageAccessToken: manualFbToken.trim(),
        userAccessToken: manualFbToken.trim(),
        inboxName: manualFbPageName.trim() || undefined,
        memberUserIds: selectedMemberUserIds,
      });

      toast.success('Đã kết nối Facebook Page thành công!');
      queryClient.invalidateQueries({ queryKey: inboxKeys.list(workspaceId) });

      onSuccess({
        id: res.data.inboxId,
        name: manualFbPageName.trim() || `Facebook Page (${manualFbPageId.trim()})`,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: manualFbPageId.trim(),
      });
    } catch (err: any) {
      toast.error(err.message || 'Không thể kết nối Facebook Page thủ công');
    } finally {
      setIsSubmittingManualFb(false);
    }
  };

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
            <RefreshCw className="size-3" data-icon="inline-start" />
            Đổi tài khoản / Làm mới
          </Button>
        </div>

        {isLoadingPages ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 rounded-xl border border-border bg-card/30 text-center">
            <Spinner className="size-6 text-primary" />
            <p className="text-xs text-muted-foreground">Đang tải danh sách Fanpage từ Meta...</p>
          </div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed border-border bg-card/20 text-center">
            <p className="text-xs text-muted-foreground">
              Không tìm thấy Fanpage nào. Đảm bảo bạn có quyền quản trị Fanpage.
            </p>
            <Button size="sm" onClick={handleStartFacebookOAuth} className="text-xs h-8">
              Thử lại
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-card/40 px-4 py-2.5">
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id="select-all"
                  checked={
                    eligiblePages.length > 0 && selectedPageIds.length === eligiblePages.length
                  }
                  onCheckedChange={handleToggleSelectAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-xs font-medium text-foreground cursor-pointer select-none"
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

            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3.5 mt-2">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-foreground">
                  Tự động phân bổ cho toàn bộ nhân viên
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Tự động cấp quyền truy cập hộp thư này cho toàn bộ nhân viên đang hoạt động trong
                  Workspace.
                </span>
              </div>
              <Switch checked={assignAllMembers} onCheckedChange={setAssignAllMembers} />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={onCancel} className="text-xs h-9">
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleConnectFacebookBatch}
                disabled={selectedPageIds.length === 0 || isSubmittingBatch}
                className="text-xs h-9 gap-1.5 font-medium"
              >
                {isSubmittingBatch ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang kết nối Hộp thư...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                    Kết nối {selectedPageIds.length} Fanpage đã chọn
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not yet redirected to Facebook OAuth:
  return (
    <div className="flex flex-col gap-4">
      <Card className="border-border bg-card/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
              <Image
                src="/channels/messenger.png"
                alt="Facebook Messenger"
                width={28}
                height={28}
                unoptimized
                style={{ width: '28px', height: '28px' }}
                className="size-7 object-contain"
              />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Đăng nhập với Facebook</CardTitle>
              <CardDescription className="text-xs">
                Cấp quyền cho Sales Copilot truy cập các Fanpage và quản lý tin nhắn.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-2">
          <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-2">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ShieldCheck className="size-4 text-emerald-500" />
              <span>Kết nối trực tiếp OAuth an toàn</span>
            </div>
            <p>
              Khi nhấp vào nút bên dưới, bạn sẽ được chuyển hướng đến trang ủy quyền chính thức của
              Meta. Bạn có thể chọn Fanpage muốn quản lý. Sau khi đồng ý, Meta sẽ chuyển hướng an
              toàn trở lại đây với danh sách Fanpage sẵn sàng kết nối.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Button
              size="lg"
              onClick={handleStartFacebookOAuth}
              disabled={isRedirectingFb}
              className="h-10 bg-[#1877F2] text-white hover:bg-[#1877F2]/90 font-medium px-5 gap-2 text-xs"
            >
              {isRedirectingFb ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
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

      {/* Collapsible Manual Connect Fallback */}
      <Collapsible open={isManualFbOpen} onOpenChange={setIsManualFbOpen}>
        <Card className="border-border bg-card/20">
          <CardHeader className="py-3">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <span>Bạn muốn nhập thủ công thông tin (Page ID &amp; Access Token)?</span>
                {isManualFbOpen ? (
                  <ChevronUp className="size-3.5" />
                ) : (
                  <ChevronDown className="size-3.5" />
                )}
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0 flex flex-col gap-3">
              <FieldGroup className="gap-3">
                <Field>
                  <FieldLabel htmlFor="manual-page-id" className="text-xs">
                    Page ID
                  </FieldLabel>
                  <Input
                    id="manual-page-id"
                    value={manualFbPageId}
                    onChange={e => setManualFbPageId(e.target.value)}
                    placeholder="Ví dụ: 104829104812"
                    className="h-8 text-xs font-mono"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-page-name" className="text-xs">
                    Tên Fanpage
                  </FieldLabel>
                  <Input
                    id="manual-page-name"
                    value={manualFbPageName}
                    onChange={e => setManualFbPageName(e.target.value)}
                    placeholder="Ví dụ: Fanpage Bán Hàng"
                    className="h-8 text-xs"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="manual-page-token" className="text-xs">
                    Page Access Token
                  </FieldLabel>
                  <Input
                    id="manual-page-token"
                    type="password"
                    value={manualFbToken}
                    onChange={e => setManualFbToken(e.target.value)}
                    placeholder="EAAB..."
                    className="h-8 text-xs font-mono"
                  />
                </Field>
              </FieldGroup>
              <Button
                size="sm"
                variant="outline"
                onClick={handleConnectManualFb}
                disabled={isSubmittingManualFb}
                className="w-fit text-xs h-8"
              >
                {isSubmittingManualFb ? (
                  <>
                    <Spinner className="size-3.5" data-icon="inline-start" />
                    Đang kết nối...
                  </>
                ) : (
                  'Kết nối thủ công'
                )}
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
