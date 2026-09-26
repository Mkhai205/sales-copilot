'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Check,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  PowerOff,
  Hash,
  Clock,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  type InboxDetailDto,
} from '@sales-copilot/shared-contracts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import { useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/lib/query-keys';
import { facebookApi } from '../../../api/facebook';
import { useUpdateInbox } from '../../../hooks/use-inboxes';

interface FacebookConfigProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug?: string;
}

export function FacebookConfig({ inbox, workspaceId, workspaceSlug }: FacebookConfigProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { mutate: updateInbox, isPending: isUpdating } = useUpdateInbox(workspaceId);
  const [isReauthorizing, setIsReauthorizing] = React.useState(false);
  const [isDisconnectOpen, setIsDisconnectOpen] = React.useState(false);

  const sessionId = searchParams.get('sessionId');
  const processedSessionIdRef = React.useRef<string | null>(null);
  const [isSyncingSession, setIsSyncingSession] = React.useState(Boolean(sessionId));

  React.useEffect(() => {
    if (!sessionId || !inbox.channel?.id) return;
    if (processedSessionIdRef.current === sessionId) return;
    processedSessionIdRef.current = sessionId;

    setIsSyncingSession(true);
    const channelId = inbox.channel.id;

    facebookApi
      .reauthorizePage(workspaceId, channelId, sessionId)
      .then(() => {
        toast.success('Đồng bộ và kết nối Fanpage Facebook thành công!', {
          id: `fb-reauth-${channelId}`,
        });
        queryClient.invalidateQueries({ queryKey: inboxKeys.detail(workspaceId, inbox.id) });
      })
      .catch(err => {
        toast.error(err.message || 'Không thể đồng bộ Fanpage Facebook', {
          id: `fb-reauth-${channelId}`,
        });
      })
      .finally(() => {
        setIsSyncingSession(false);
        const targetUrl = workspaceSlug
          ? `/${workspaceSlug}/settings/inboxes/${inbox.id}?tab=configuration`
          : `/settings/inboxes/${inbox.id}?tab=configuration`;
        router.replace(targetUrl, { scroll: false });
      });
  }, [sessionId, workspaceId, inbox.channel?.id, workspaceSlug, inbox.id, router, queryClient]);

  // Comment Guard Settings State
  const existingCommentGuard = (inbox.channel?.settings as any)?.commentGuard;
  const [commentGuardEnabled, setCommentGuardEnabled] = React.useState(
    existingCommentGuard?.enabled || false,
  );
  const [publicReplyEnabled, setPublicReplyEnabled] = React.useState(
    existingCommentGuard?.publicReplyEnabled ?? true,
  );
  const [privateReplyTemplate, setPrivateReplyTemplate] = React.useState(
    existingCommentGuard?.privateReplyTemplate || DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  );
  const [publicReplyTemplate, setPublicReplyTemplate] = React.useState(
    existingCommentGuard?.publicReplyTemplate || DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  );

  React.useEffect(() => {
    if (existingCommentGuard) {
      setCommentGuardEnabled(existingCommentGuard.enabled ?? false);
      setPublicReplyEnabled(existingCommentGuard.publicReplyEnabled ?? true);
      setPrivateReplyTemplate(
        existingCommentGuard.privateReplyTemplate || DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
      );
      setPublicReplyTemplate(
        existingCommentGuard.publicReplyTemplate || DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
      );
    }
  }, [inbox.channel?.updatedAt, inbox.updatedAt]);

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.salescopilot.vn';

  const channelSettings = (inbox.channel?.settings as Record<string, any>) || {};
  const isConnected = Boolean(inbox.channel?.isConnected);
  const pageId = inbox.channel?.providerAccountId || channelSettings.pageId || '109283746581920';
  const pageName = channelSettings.pageName || inbox.name || 'Sales Copilot Flagship Store';
  const lastSyncAt = channelSettings.lastSyncAt;

  // ── Handle OAuth Connect / Re-authorize ────────────────────────────────────
  const handleStartFacebookOAuth = async () => {
    setIsReauthorizing(true);
    try {
      const returnUrl = workspaceSlug
        ? `${origin}/${workspaceSlug}/settings/inboxes/${inbox.id}?tab=configuration`
        : `${origin}/settings/inboxes/${inbox.id}?tab=configuration`;
      const res = await facebookApi.getAuthUrl(workspaceId, origin, returnUrl);
      window.location.href = res.data.authUrl;
    } catch (err: any) {
      toast.error(err.message || 'Không thể khởi tạo liên kết Facebook OAuth');
      setIsReauthorizing(false);
    }
  };

  // ── Handle Disconnect ───────────────────────────────────────────────────
  const handleDisconnect = () => {
    updateInbox(
      {
        inboxId: inbox.id,
        dto: {
          isConnected: false,
        },
        successMessage: 'Đã ngắt kết nối Facebook Fanpage an toàn',
      },
      {
        onSuccess: () => {
          setIsDisconnectOpen(false);
        },
      },
    );
  };

  // ── Helper: Insert Dynamic Placeholder Tag ────────────────────────────────
  const insertTag = (
    textareaId: string,
    tag: string,
    currentValue: string,
    setter: (val: string) => void,
  ) => {
    const el = document.getElementById(textareaId) as HTMLTextAreaElement | null;
    if (!el) {
      setter(currentValue + tag);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const nextVal = currentValue.substring(0, start) + tag + currentValue.substring(end);
    setter(nextVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  };

  // ── Save Comment Guard Settings ──────────────────────────────────────────
  const handleSaveCommentGuard = (e: React.FormEvent) => {
    e.preventDefault();

    const currentChannelSettings = (inbox.channel?.settings as Record<string, unknown>) || {};
    const updatedChannelSettings = {
      ...currentChannelSettings,
      commentGuard: {
        enabled: commentGuardEnabled,
        publicReplyEnabled,
        privateReplyTemplate: privateReplyTemplate.trim(),
        publicReplyTemplate: publicReplyTemplate.trim(),
      },
    };

    updateInbox({
      inboxId: inbox.id,
      dto: {
        channelSettings: updatedChannelSettings,
      },
      successMessage: 'Lưu cấu hình Vệ sĩ bình luận (Comment Guard) thành công',
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full">
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

          {channelSettings.lastSyncError && !isSyncingSession && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-500">
              <ShieldAlert className="size-4 shrink-0" />
              <span>
                Lỗi đồng bộ gần nhất:{' '}
                <span className="text-muted-foreground">{channelSettings.lastSyncError}</span>
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
                    onClick={handleStartFacebookOAuth}
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
                    onClick={() => setIsDisconnectOpen(true)}
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
                  Liên kết Fanpage của bạn chỉ với 1 cú nhấp chuột. Sales Copilot sẽ tự động nhận
                  diện tin nhắn Messenger và kích hoạt bảo vệ bình luận.
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
                onClick={handleStartFacebookOAuth}
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

      {/* ─── CARD 2: VỆ SĨ BÌNH LUẬN (COMMENT GUARD) ──────────────────────── */}
      <Card className="border-border bg-card/40">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <ShieldAlert className="size-4 text-primary" />
                <CardTitle className="text-base font-semibold">
                  Vệ Sĩ Bình Luận (Comment Guard)
                </CardTitle>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Tự động quét & ẩn bình luận chứa số điện thoại để chống cướp khách, đồng thời kích
                hoạt nhắn tin riêng.
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                commentGuardEnabled
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500 text-xs'
                  : 'border-muted bg-muted/40 text-muted-foreground text-xs'
              }
            >
              {commentGuardEnabled ? 'Đang bảo vệ' : 'Đang tắt'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Visual 3-step flow diagram */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-3">
              <Sparkles className="size-3.5 text-amber-500" />
              Quy trình hoạt động tự động của Comment Guard:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    1
                  </span>
                  Quét bình luận SĐT
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Hệ thống nhận diện định dạng số điện thoại Việt Nam khi khách bình luận dưới bài
                  viết/livestream.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold">
                    2
                  </span>
                  Ẩn bình luận &lt; 1s
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Tự động ẩn bình luận khỏi người xem khác ngay lập tức, ngăn ngừa đối thủ cướp
                  khách.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-background/60 p-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span className="flex size-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-500 text-[10px] font-bold">
                    3
                  </span>
                  Phản hồi kép tức thì
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Nhắn tin riêng qua Messenger và bình luận công khai xác nhận đơn hàng/yêu cầu.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveCommentGuard} className="flex flex-col gap-5">
            <FieldGroup className="gap-4">
              {/* Master toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                <div className="flex flex-col gap-0.5 pr-4">
                  <span className="text-xs font-medium text-foreground">
                    Bật tự động ẩn bình luận chứa số điện thoại (Comment Guard)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Khi phát hiện bình luận có số điện thoại Việt Nam, hệ thống lập tức ẩn bình luận
                    để đối thủ không thể khai thác.
                  </span>
                </div>
                <Switch checked={commentGuardEnabled} onCheckedChange={setCommentGuardEnabled} />
              </div>

              {commentGuardEnabled && (
                <>
                  {/* Public reply toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border/80 bg-muted/20 p-3.5">
                    <div className="flex flex-col gap-0.5 pr-4">
                      <span className="text-xs font-medium text-foreground">
                        Đăng bình luận phản hồi công khai (Public Reply)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Bình luận trả lời công khai giúp khách an tâm đã được shop ghi nhận và bảo
                        toàn tương tác cho bài viết.
                      </span>
                    </div>
                    <Switch checked={publicReplyEnabled} onCheckedChange={setPublicReplyEnabled} />
                  </div>

                  {/* Private reply textarea */}
                  <Field>
                    <div className="flex items-center justify-between">
                      <FieldLabel htmlFor="private-reply-template" className="text-xs font-medium">
                        Mẫu tin nhắn riêng tư (Private Reply qua Messenger)
                      </FieldLabel>
                      {/* Quick Insert Tags */}
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Tag className="size-3" />
                        <span>Chèn:</span>
                        <button
                          type="button"
                          onClick={() =>
                            insertTag(
                              'private-reply-template',
                              '{customer_name}',
                              privateReplyTemplate,
                              setPrivateReplyTemplate,
                            )
                          }
                          className="font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                        >
                          {'{customer_name}'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            insertTag(
                              'private-reply-template',
                              '{page_name}',
                              privateReplyTemplate,
                              setPrivateReplyTemplate,
                            )
                          }
                          className="font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                        >
                          {'{page_name}'}
                        </button>
                      </div>
                    </div>
                    <Textarea
                      id="private-reply-template"
                      rows={3}
                      value={privateReplyTemplate}
                      onChange={e => setPrivateReplyTemplate(e.target.value)}
                      placeholder={DEFAULT_COMMENT_GUARD_PRIVATE_REPLY}
                      className="text-xs min-h-[72px] mt-1.5"
                    />
                    <FieldDescription className="text-[11px] text-muted-foreground">
                      Hệ thống sẽ gửi tin nhắn này trực tiếp vào Messenger của khách hàng ngay khi
                      ẩn bình luận.
                    </FieldDescription>
                  </Field>

                  {/* Public reply textarea */}
                  {publicReplyEnabled && (
                    <Field>
                      <div className="flex items-center justify-between">
                        <FieldLabel htmlFor="public-reply-template" className="text-xs font-medium">
                          Mẫu bình luận công khai dưới bài viết (Public Reply)
                        </FieldLabel>
                        {/* Quick Insert Tags */}
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Tag className="size-3" />
                          <span>Chèn:</span>
                          <button
                            type="button"
                            onClick={() =>
                              insertTag(
                                'public-reply-template',
                                '{customer_name}',
                                publicReplyTemplate,
                                setPublicReplyTemplate,
                              )
                            }
                            className="font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          >
                            {'{customer_name}'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              insertTag(
                                'public-reply-template',
                                '{page_name}',
                                publicReplyTemplate,
                                setPublicReplyTemplate,
                              )
                            }
                            className="font-mono text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.5 rounded text-[10px] transition-colors"
                          >
                            {'{page_name}'}
                          </button>
                        </div>
                      </div>
                      <Textarea
                        id="public-reply-template"
                        rows={2}
                        value={publicReplyTemplate}
                        onChange={e => setPublicReplyTemplate(e.target.value)}
                        placeholder={DEFAULT_COMMENT_GUARD_PUBLIC_REPLY}
                        className="text-xs min-h-[56px] mt-1.5"
                      />
                      <FieldDescription className="text-[11px] text-muted-foreground">
                        Nội dung bình luận phản hồi hiển thị công khai dưới comment của khách hàng.
                      </FieldDescription>
                    </Field>
                  )}
                </>
              )}
            </FieldGroup>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => {
                  setPrivateReplyTemplate(DEFAULT_COMMENT_GUARD_PRIVATE_REPLY);
                  setPublicReplyTemplate(DEFAULT_COMMENT_GUARD_PUBLIC_REPLY);
                  toast.success('Đã khôi phục mẫu tin nhắn mặc định');
                }}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                <RotateCcw className="size-3.5" />
                {'Khôi phục mặc định'}
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isUpdating}
                className="h-8 gap-1.5 text-xs font-medium"
              >
                {isUpdating ? (
                  <>
                    <Spinner className="size-3.5" />
                    Đang lưu...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    Lưu cấu hình Comment Guard
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ─── DIALOG: NGẮT KẾT NỐI FACEBOOK FANPAGE ────────────────────────── */}
      <Dialog open={isDisconnectOpen} onOpenChange={setIsDisconnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <PowerOff className="size-4" />
              Ngắt kết nối Facebook Fanpage
            </DialogTitle>
            <DialogDescription className="text-xs">
              Bạn có chắc chắn muốn ngắt kết nối Fanpage <strong>{pageName}</strong> khỏi Sales
              Copilot không?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 text-xs text-muted-foreground flex flex-col gap-2">
            <p>Khi ngắt kết nối:</p>
            <ul className="list-disc pl-5 flex flex-col gap-1">
              <li>Webhook tiếp nhận sự kiện từ Facebook sẽ được hủy đăng ký an toàn.</li>
              <li>Tin nhắn mới và bình luận sẽ tạm dừng đồng bộ về hệ thống.</li>
              <li>
                <strong>
                  Toàn bộ lịch sử tin nhắn, đơn hàng và danh bạ khách hàng cũ vẫn được bảo lưu 100%.
                </strong>
              </li>
              <li>Bạn có thể kết nối lại Fanpage bất kỳ lúc nào bằng 1 cú nhấp chuột.</li>
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
