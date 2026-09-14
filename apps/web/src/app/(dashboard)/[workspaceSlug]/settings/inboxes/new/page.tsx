'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Globe,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChannelType } from '@sales-copilot/shared-contracts';

import { InboxVerticalStepper, SettingsGuard, useSettingsRbac } from '@/features/settings';
import { InboxAvatar } from '@/components/inbox-avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { facebookApi, type FacebookPageInfo } from '@/lib/api/facebook';
import { inboxesApi } from '@/lib/api/inboxes';
import { useWorkspaceMembers } from '@/features/settings/hooks/use-workspace-members';

export default function NewInboxPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      <NewInboxPageContent />
    </React.Suspense>
  );
}

interface CreatedResult {
  id: string;
  name: string;
  channelType: ChannelType;
  providerAccountId?: string | null;
  count?: number;
}

function NewInboxPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const workspaceSlug = (params?.workspaceSlug as string) || '';
  const { currentWorkspace } = useSettingsRbac(workspaceSlug);
  const { data: workspaceMembers } = useWorkspaceMembers(currentWorkspace?.id);

  const channelCards = React.useMemo(
    () => [
      {
        type: ChannelType.FACEBOOK_MESSENGER,
        key: 'facebook',
        title: 'Facebook Messenger',
        description:
          'Kết nối Fanpage qua OAuth 1-click để tiếp nhận và trả lời tin nhắn khách hàng.',
        badge: 'Phổ biến tại VN',
        logoSrc: '/channels/messenger.png',
      },
      {
        type: ChannelType.ZALO,
        key: 'zalo',
        title: 'Zalo Official Account',
        description: 'Tiếp cận khách hàng Việt Nam qua tích hợp Zalo OA bằng OA ID và Secret Key.',
        badge: 'Phổ biến tại VN',
        logoSrc: '/channels/zalo.png',
      },
      {
        type: ChannelType.WEB_CHAT,
        key: 'web_chat',
        title: 'Website Live Chat',
        description: 'Nhúng widget chat trực tiếp tương tác trên website hoặc gian hàng của bạn.',
        logoSrc: '/channels/website.png',
      },
      {
        type: ChannelType.TELEGRAM,
        key: 'telegram',
        title: 'Telegram Bot',
        description:
          'Kết nối Telegram Bot Token để xử lý tin nhắn khách hàng trực tiếp từ Telegram.',
        logoSrc: '/channels/telegram.png',
      },
      {
        type: ChannelType.EMAIL,
        key: 'email',
        title: 'Hỗ trợ qua Email',
        description:
          'Kết nối hòm thư dùng chung qua SMTP / IMAP để xử lý email dưới dạng hội thoại.',
        logoSrc: '/channels/email.png',
      },
    ],
    [],
  );

  const initialChannelParam = searchParams.get('channel');
  const sessionIdParam = searchParams.get('sessionId');

  // Wizard state: current step (1: Channel, 2: Config, 3: Members, 4: Finish)
  const [currentStep, setCurrentStep] = React.useState<1 | 2 | 3 | 4>(() => {
    if (sessionIdParam) return 2;
    if (initialChannelParam) return 2;
    return 1;
  });

  // Selected Channel State
  const [selectedChannelKey, setSelectedChannelKey] = React.useState<string | null>(
    initialChannelParam || null,
  );

  // Selected Members State (for Step 3)
  const [selectedMemberUserIds, setSelectedMemberUserIds] = React.useState<string[]>([]);

  // Facebook OAuth State
  const [isRedirectingFb, setIsRedirectingFb] = React.useState(false);
  const [isLoadingPages, setIsLoadingPages] = React.useState(false);
  const [pages, setPages] = React.useState<FacebookPageInfo[]>([]);
  const [selectedPageIds, setSelectedPageIds] = React.useState<string[]>([]);
  const [assignAllMembers, setAssignAllMembers] = React.useState(true);
  const [isSubmittingBatch, setIsSubmittingBatch] = React.useState(false);

  // Manual Facebook Fallback
  const [isManualFbOpen, setIsManualFbOpen] = React.useState(false);
  const [manualFbPageId, setManualFbPageId] = React.useState('');
  const [manualFbPageName, setManualFbPageName] = React.useState('');
  const [manualFbToken, setManualFbToken] = React.useState('');
  const [isSubmittingManualFb, setIsSubmittingManualFb] = React.useState(false);

  // Other Channels Form State
  const [genericInboxName, setGenericInboxName] = React.useState('');
  const [genericAvatarUrl, setGenericAvatarUrl] = React.useState('');
  const [isUploadingGenericAvatar, setIsUploadingGenericAvatar] = React.useState(false);
  const genericFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [telegramBotToken, setTelegramBotToken] = React.useState('');
  const [webChatDomain, setWebChatDomain] = React.useState('');
  const [zaloOaId, setZaloOaId] = React.useState('');
  const [zaloSecretKey, setZaloSecretKey] = React.useState('');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [isSubmittingGeneric, setIsSubmittingGeneric] = React.useState(false);

  const handleUploadGenericAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentWorkspace?.id) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ hỗ trợ tải lên file hình ảnh (PNG, JPG, WEBP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Kích thước ảnh không được vượt quá 5MB');
      return;
    }

    setIsUploadingGenericAvatar(true);
    try {
      const res = await inboxesApi.uploadAvatar(currentWorkspace.id, file);
      if (res.data?.avatarUrl) {
        setGenericAvatarUrl(res.data.avatarUrl);
        toast.success('Đã tải ảnh đại diện lên thành công!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Không thể tải ảnh đại diện lên');
    } finally {
      setIsUploadingGenericAvatar(false);
      if (genericFileInputRef.current) {
        genericFileInputRef.current.value = '';
      }
    }
  };

  // Created Result for Step 4
  const [createdResult, setCreatedResult] = React.useState<CreatedResult | null>(null);
  const [copiedCode, setCopiedCode] = React.useState<boolean>(false);

  const selectedChannel = channelCards.find(c => c.key === selectedChannelKey);

  // Auto-select all workspace members by default when members load
  React.useEffect(() => {
    if (workspaceMembers && selectedMemberUserIds.length === 0) {
      setSelectedMemberUserIds(workspaceMembers.map(m => m.userId));
    }
  }, [workspaceMembers]);

  // If sessionId is present in URL on mount, automatically discover pages
  React.useEffect(() => {
    if (sessionIdParam && currentWorkspace?.id) {
      loadDiscoveredPages(sessionIdParam);
    }
  }, [sessionIdParam, currentWorkspace?.id]);

  const loadDiscoveredPages = async (sessId: string) => {
    if (!currentWorkspace?.id) return;
    setIsLoadingPages(true);
    try {
      const res = await facebookApi.discoverPages(currentWorkspace.id, sessId);
      const fetchedPages = res.data || [];
      setPages(fetchedPages);

      // Auto-select all eligible (not already connected) pages by default
      const eligibleIds = fetchedPages.filter(p => !p.isAlreadyConnected).map(p => p.pageId);
      setSelectedPageIds(eligibleIds);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tìm nạp danh sách Facebook Fanpage');
    } finally {
      setIsLoadingPages(false);
    }
  };

  // ─── Facebook Handlers ──────────────────────────────────────────────────────

  const handleStartFacebookOAuth = async () => {
    if (!currentWorkspace?.id || isRedirectingFb) return;
    setIsRedirectingFb(true);

    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const returnUrl = `${origin}/${workspaceSlug}/settings/inboxes/new?channel=facebook`;

      const res = await facebookApi.getAuthUrl(currentWorkspace.id, origin, returnUrl);
      const authUrl = res.data.authUrl;

      window.location.href = authUrl;
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

  const handleToggleSelectAll = () => {
    const eligiblePages = pages.filter(p => !p.isAlreadyConnected);
    if (selectedPageIds.length === eligiblePages.length) {
      setSelectedPageIds([]);
    } else {
      setSelectedPageIds(eligiblePages.map(p => p.pageId));
    }
  };

  const handleConnectFacebookBatch = async () => {
    if (!currentWorkspace?.id || !sessionIdParam || selectedPageIds.length === 0) return;
    setIsSubmittingBatch(true);

    try {
      const res = await facebookApi.connectPagesBatch(currentWorkspace.id, {
        pageIds: selectedPageIds,
        sessionId: sessionIdParam,
        assignAllMembers,
      });

      const count = res.data.inboxes.length;
      toast.success(`Đã kết nối thành công ${count} Fanpage Facebook!`);
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });

      const firstInbox = res.data.inboxes[0];
      setCreatedResult({
        id: firstInbox?.inboxId || '',
        name:
          count === 1 ? firstInbox?.pageName || 'Facebook Fanpage' : `${count} Fanpage Facebook`,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: firstInbox?.pageId,
        count,
      });
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Không thể kết nối các Fanpage đã chọn');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleConnectManualFb = async () => {
    if (!currentWorkspace?.id || !manualFbPageId.trim() || !manualFbToken.trim()) {
      toast.error('Page ID và Page Access Token là bắt buộc');
      return;
    }

    setIsSubmittingManualFb(true);
    try {
      const res = await facebookApi.connectPage(currentWorkspace.id, {
        pageId: manualFbPageId.trim(),
        pageName: manualFbPageName.trim() || `Facebook Page (${manualFbPageId.trim()})`,
        pageAccessToken: manualFbToken.trim(),
        userAccessToken: manualFbToken.trim(),
        inboxName: manualFbPageName.trim() || undefined,
        memberUserIds: selectedMemberUserIds,
      });

      toast.success('Đã kết nối Facebook Page thành công!');
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });

      setCreatedResult({
        id: res.data.inboxId,
        name: manualFbPageName.trim() || `Facebook Page (${manualFbPageId.trim()})`,
        channelType: ChannelType.FACEBOOK_MESSENGER,
        providerAccountId: manualFbPageId.trim(),
      });
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Không thể kết nối Facebook Page thủ công');
    } finally {
      setIsSubmittingManualFb(false);
    }
  };

  // ─── Generic Channels Flow ──────────────────────────────────────────────────

  const handleProceedToMembersStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChannel) return;

    // Validate inputs
    if (selectedChannel.type === ChannelType.TELEGRAM && !telegramBotToken.trim()) {
      toast.error('Vui lòng nhập Telegram Bot Token');
      return;
    }
    if (selectedChannel.type === ChannelType.ZALO && (!zaloOaId.trim() || !zaloSecretKey.trim())) {
      toast.error('Vui lòng nhập Zalo OA ID và Secret Key');
      return;
    }
    if (selectedChannel.type === ChannelType.EMAIL && !emailAddress.trim()) {
      toast.error('Vui lòng nhập địa chỉ Email');
      return;
    }

    setCurrentStep(3);
  };

  const handleCreateGenericInbox = async () => {
    if (!currentWorkspace?.id || !selectedChannel) return;

    setIsSubmittingGeneric(true);
    try {
      let credentials: Record<string, unknown> = {};
      let defaultName = genericInboxName.trim();
      let providerAccountId: string | undefined;

      switch (selectedChannel.type) {
        case ChannelType.TELEGRAM: {
          credentials = { botToken: telegramBotToken.trim() };
          if (!defaultName) defaultName = 'Telegram Support Bot';
          break;
        }
        case ChannelType.WEB_CHAT: {
          credentials = { websiteUrl: webChatDomain.trim() };
          if (!defaultName) defaultName = 'Website Live Chat';
          break;
        }
        case ChannelType.ZALO: {
          credentials = { oaId: zaloOaId.trim(), secretKey: zaloSecretKey.trim() };
          providerAccountId = zaloOaId.trim();
          if (!defaultName) defaultName = 'Zalo Official Account';
          break;
        }
        case ChannelType.EMAIL: {
          credentials = { emailAddress: emailAddress.trim() };
          providerAccountId = emailAddress.trim();
          if (!defaultName) defaultName = `Email (${emailAddress.trim()})`;
          break;
        }
      }

      const res = await inboxesApi.create(currentWorkspace.id, {
        name: defaultName,
        channelType: selectedChannel.type,
        avatarUrl: genericAvatarUrl.trim() || undefined,
        channelCredentials: credentials,
        providerAccountId,
      });

      const newInbox = res.data;

      // Add selected members concurrently
      if (selectedMemberUserIds.length > 0) {
        await Promise.allSettled(
          selectedMemberUserIds.map(userId =>
            inboxesApi.addMember(currentWorkspace.id, newInbox.id, userId),
          ),
        );
      }

      toast.success(`Đã tạo hộp thư ${selectedChannel.title} thành công!`);
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });

      setCreatedResult({
        id: newInbox.id,
        name: defaultName,
        channelType: selectedChannel.type,
        providerAccountId: newInbox.channel?.providerAccountId,
      });
      setCurrentStep(4);
    } catch (err: any) {
      toast.error(err.message || 'Không thể tạo hộp thư');
    } finally {
      setIsSubmittingGeneric(false);
    }
  };

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://app.salescopilot.vn';

  const embedScript = createdResult
    ? `<!-- Start Sales Copilot Live Chat -->
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
<!-- End Sales Copilot Live Chat -->`
    : '';

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    toast.success('Đã sao chép mã nhúng vào bộ nhớ tạm');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const eligiblePages = pages.filter(p => !p.isAlreadyConnected);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="inboxes">
      <div className="flex flex-col gap-6 w-full pb-16">
        {/* Top Back Navigation */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep === 4) {
                router.push(`/${workspaceSlug}/settings/inboxes`);
              } else if (currentStep === 3) {
                setCurrentStep(2);
              } else if (currentStep === 2) {
                setSelectedChannelKey(null);
                setCurrentStep(1);
                router.replace(`/${workspaceSlug}/settings/inboxes/new`);
              } else {
                router.push(`/${workspaceSlug}/settings/inboxes`);
              }
            }}
            className="w-fit -ml-2 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            {currentStep === 1
              ? 'Quay lại danh sách Hộp thư'
              : currentStep === 4
                ? 'Về danh sách Hộp thư'
                : 'Quay lại bước trước'}
          </Button>
        </div>

        {/* 2-Column Side-by-Side Grid */}
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] items-start gap-8 lg:gap-12 w-full">
          {/* Left Column: Vertical Stepper Sidebar */}
          <aside className="w-full md:sticky md:top-6">
            <InboxVerticalStepper
              currentStep={currentStep}
              onStepClick={step => {
                if (step === 1) {
                  setSelectedChannelKey(null);
                  setCurrentStep(1);
                  router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                } else if (step === 2) {
                  setCurrentStep(2);
                } else if (step === 3) {
                  setCurrentStep(3);
                }
              }}
            />
          </aside>

          {/* Right Column: Main Content Area */}
          <div className="w-full min-w-0 flex flex-col gap-6">
            {currentStep > 1 && (
              <div className="flex flex-col gap-1 pb-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">
                  {currentStep === 4
                    ? 'Hộp thư đã sẵn sàng!'
                    : selectedChannel
                      ? `Kết nối ${selectedChannel.title}`
                      : 'Cấu hình Hộp thư'}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {currentStep === 4
                    ? 'Kênh liên lạc đã được tạo và liên kết thành công vào không gian làm việc của bạn.'
                    : selectedChannel
                      ? selectedChannel.description
                      : 'Hoàn thiện thông tin cần thiết để khởi tạo hộp thư đến.'}
                </p>
              </div>
            )}

            {/* ─── STEP 1: CHANNEL SELECTION GRID ───────────────────────────────────── */}
            {currentStep === 1 && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {channelCards.map(channel => (
                  <Card
                    key={channel.key}
                    onClick={() => {
                      setSelectedChannelKey(channel.key);
                      setCurrentStep(2);
                      router.push(`/${workspaceSlug}/settings/inboxes/new?channel=${channel.key}`);
                    }}
                    className="group relative flex flex-col justify-between cursor-pointer rounded-xl border border-border bg-card/40 p-5 transition-all hover:border-primary/50 hover:bg-card/80 hover:shadow-sm"
                  >
                    <div className="flex flex-col gap-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs transition-colors group-hover:border-primary/40 group-hover:bg-primary/5">
                          <Image
                            src={channel.logoSrc}
                            alt={channel.title}
                            width={28}
                            height={28}
                            unoptimized
                            style={{ width: '28px', height: '28px' }}
                            className="size-7 object-contain"
                          />
                        </div>
                        {channel.badge && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium border-primary/20 text-primary"
                          >
                            {channel.badge}
                          </Badge>
                        )}
                      </div>

                      <div>
                        <h2 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {channel.title}
                        </h2>
                        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                          {channel.description}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between text-xs font-medium text-primary">
                      <span>Bắt đầu kết nối</span>
                      <span className="transition-transform group-hover:translate-x-0.5">→</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {/* ─── STEP 2: FACEBOOK MESSENGER FLOW ──────────────────────────────────── */}
            {currentStep === 2 && selectedChannelKey === 'facebook' && (
              <div className="flex flex-col gap-6">
                {!sessionIdParam ? (
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
                            <CardTitle className="text-base font-semibold">
                              Đăng nhập với Facebook
                            </CardTitle>
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
                            Khi nhấp vào nút bên dưới, bạn sẽ được chuyển hướng đến trang ủy quyền
                            chính thức của Meta. Bạn có thể chọn Fanpage muốn quản lý. Sau khi đồng
                            ý, Meta sẽ chuyển hướng an toàn trở lại đây với danh sách Fanpage sẵn
                            sàng kết nối.
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
                              className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              <span>
                                Bạn muốn nhập thủ công thông tin (Page ID & Access Token)?
                              </span>
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
                                  className="h-8 text-xs"
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
                                  className="h-8 text-xs"
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
                ) : (
                  /* Discovered Pages Selection */
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
                        <p className="text-xs text-muted-foreground">
                          Đang tải danh sách Fanpage từ Meta...
                        </p>
                      </div>
                    ) : pages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed border-border bg-card/20 text-center">
                        <p className="text-xs text-muted-foreground">
                          Không tìm thấy Fanpage nào. Đảm bảo bạn có quyền quản trị Fanpage.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleStartFacebookOAuth}
                          className="text-xs h-8"
                        >
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
                                eligiblePages.length > 0 &&
                                selectedPageIds.length === eligiblePages.length
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
                                  <Badge
                                    variant="secondary"
                                    className="text-[10px] shrink-0 font-normal"
                                  >
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
                              Tự động cấp quyền truy cập hộp thư này cho toàn bộ nhân viên đang hoạt
                              động trong Workspace.
                            </span>
                          </div>
                          <Switch
                            checked={assignAllMembers}
                            onCheckedChange={setAssignAllMembers}
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedChannelKey(null);
                              setCurrentStep(1);
                              router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                            }}
                            className="text-xs h-9"
                          >
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
                )}
              </div>
            )}

            {/* ─── STEP 2: OTHER CHANNELS FORM ──────────────────────────────────────── */}
            {currentStep === 2 &&
              selectedChannelKey &&
              selectedChannelKey !== 'facebook' &&
              selectedChannel && (
                <Card className="border-border bg-card/40 max-w-xl">
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-xl border border-border/60 bg-muted/40 p-2 shadow-xs">
                        <Image
                          src={selectedChannel.logoSrc}
                          alt={selectedChannel.title}
                          width={28}
                          height={28}
                          unoptimized
                          style={{ width: '28px', height: '28px' }}
                          className="size-7 object-contain"
                        />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold">
                          Cấu hình {selectedChannel.title}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Điền các thông số kết nối ban đầu cho kênh này.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <form onSubmit={handleProceedToMembersStep} className="flex flex-col gap-4">
                      <FieldGroup className="gap-3.5">
                        <Field>
                          <FieldLabel htmlFor="inbox-name" className="text-xs font-medium">
                            Tên hộp thư (Tùy chọn)
                          </FieldLabel>
                          <Input
                            id="inbox-name"
                            value={genericInboxName}
                            onChange={e => setGenericInboxName(e.target.value)}
                            placeholder={`Ví dụ: ${selectedChannel.title}`}
                            className="h-8 text-xs"
                          />
                          <FieldDescription className="text-[11px] text-muted-foreground">
                            Để trống để sử dụng tên mặc định của hệ thống.
                          </FieldDescription>
                        </Field>

                        {/* Channel Avatar / Logo */}
                        <Field>
                          <FieldLabel className="text-xs font-medium">
                            Hình đại diện / Logo (Tùy chọn)
                          </FieldLabel>
                          <div className="flex items-center gap-3.5 p-3 rounded-xl border border-border/70 bg-muted/20">
                            <InboxAvatar
                              avatarUrl={genericAvatarUrl}
                              channelType={selectedChannel.type}
                              name={genericInboxName || selectedChannel.title}
                              size="lg"
                            />
                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  ref={genericFileInputRef}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                  className="hidden"
                                  onChange={handleUploadGenericAvatar}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUploadingGenericAvatar}
                                  onClick={() => genericFileInputRef.current?.click()}
                                  className="h-7 px-2.5 gap-1.5 text-xs font-medium"
                                >
                                  {isUploadingGenericAvatar ? (
                                    <>
                                      <Spinner className="size-3" data-icon="inline-start" />
                                      Đang tải...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="size-3" data-icon="inline-start" />
                                      {genericAvatarUrl ? 'Thay đổi ảnh' : 'Tải ảnh lên'}
                                    </>
                                  )}
                                </Button>

                                {genericAvatarUrl && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={isUploadingGenericAvatar}
                                    onClick={() => setGenericAvatarUrl('')}
                                    className="h-7 px-2 gap-1 text-xs text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="size-3" data-icon="inline-start" />
                                    Gỡ ảnh
                                  </Button>
                                )}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                Tải lên logo gian hàng hoặc ảnh đại diện (PNG, JPG, WEBP, SVG tối đa
                                5MB).
                              </p>
                            </div>
                          </div>
                        </Field>

                        {/* Telegram Specific */}
                        {selectedChannel.type === ChannelType.TELEGRAM && (
                          <Field>
                            <FieldLabel htmlFor="tg-token" className="text-xs font-medium">
                              Telegram Bot Token <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id="tg-token"
                              required
                              value={telegramBotToken}
                              onChange={e => setTelegramBotToken(e.target.value)}
                              placeholder="123456:ABC-DEF1234ghIkl..."
                              className="h-8 text-xs font-mono"
                            />
                            <FieldDescription className="text-[11px] text-muted-foreground">
                              Nhận token bằng cách nhắn tin cho{' '}
                              <code className="font-mono">@BotFather</code> trên Telegram.
                            </FieldDescription>
                          </Field>
                        )}

                        {/* Web Chat Specific */}
                        {selectedChannel.type === ChannelType.WEB_CHAT && (
                          <Field>
                            <FieldLabel htmlFor="webchat-domain" className="text-xs font-medium">
                              Tên miền / URL Website (Tùy chọn)
                            </FieldLabel>
                            <Input
                              id="webchat-domain"
                              value={webChatDomain}
                              onChange={e => setWebChatDomain(e.target.value)}
                              placeholder="https://myshop.vn"
                              className="h-8 text-xs font-mono"
                            />
                            <FieldDescription className="text-[11px] text-muted-foreground">
                              Tên miền chính của website bạn muốn nhúng widget live chat.
                            </FieldDescription>
                          </Field>
                        )}

                        {/* Zalo Specific */}
                        {selectedChannel.type === ChannelType.ZALO && (
                          <>
                            <Field>
                              <FieldLabel htmlFor="zalo-oa-id" className="text-xs font-medium">
                                Zalo Official Account ID <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Input
                                id="zalo-oa-id"
                                required
                                value={zaloOaId}
                                onChange={e => setZaloOaId(e.target.value)}
                                placeholder="Ví dụ: 182736451928"
                                className="h-8 text-xs font-mono"
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="zalo-secret" className="text-xs font-medium">
                                Zalo OA Secret Key <span className="text-destructive">*</span>
                              </FieldLabel>
                              <Input
                                id="zalo-secret"
                                type="password"
                                required
                                value={zaloSecretKey}
                                onChange={e => setZaloSecretKey(e.target.value)}
                                placeholder="Nhập Zalo OA Secret Key"
                                className="h-8 text-xs font-mono"
                              />
                            </Field>
                          </>
                        )}

                        {/* Email Specific */}
                        {selectedChannel.type === ChannelType.EMAIL && (
                          <Field>
                            <FieldLabel htmlFor="email-address" className="text-xs font-medium">
                              Địa chỉ Email hỗ trợ <span className="text-destructive">*</span>
                            </FieldLabel>
                            <Input
                              id="email-address"
                              type="email"
                              required
                              value={emailAddress}
                              onChange={e => setEmailAddress(e.target.value)}
                              placeholder="support@myshop.vn"
                              className="h-8 text-xs font-mono"
                            />
                          </Field>
                        )}
                      </FieldGroup>

                      <div className="flex items-center justify-end gap-2.5 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedChannelKey(null);
                            setCurrentStep(1);
                            router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                          }}
                          className="text-xs h-8"
                        >
                          Hủy
                        </Button>
                        <Button type="submit" size="sm" className="text-xs h-8 gap-1.5 font-medium">
                          Tiếp tục: Phân bổ nhân sự
                          <ArrowRight className="size-3" data-icon="inline-end" />
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              )}

            {/* ─── STEP 3: INITIAL MEMBERS REVIEW ───────────────────────────────────── */}
            {currentStep === 3 && selectedChannel && (
              <Card className="border-border bg-card/40 max-w-xl">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary" />
                    <CardTitle className="text-sm font-semibold">
                      Chỉ định nhân viên tiếp nhận hộp thư
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    Chọn các nhân viên có quyền tiếp nhận và phản hồi tin nhắn trong hộp thư{' '}
                    {selectedChannel.title}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center justify-between rounded-lg border border-border bg-card/30 px-3.5 py-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="select-all-members"
                        checked={
                          workspaceMembers &&
                          workspaceMembers.length > 0 &&
                          selectedMemberUserIds.length === workspaceMembers.length
                        }
                        onCheckedChange={checked => {
                          if (checked && workspaceMembers) {
                            setSelectedMemberUserIds(workspaceMembers.map(m => m.userId));
                          } else {
                            setSelectedMemberUserIds([]);
                          }
                        }}
                      />
                      <label
                        htmlFor="select-all-members"
                        className="text-xs font-medium cursor-pointer select-none"
                      >
                        Chọn tất cả nhân viên ({workspaceMembers?.length || 0})
                      </label>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Đã chọn {selectedMemberUserIds.length} nhân sự
                    </span>
                  </div>

                  <div className="rounded-lg border border-border bg-card/20 divide-y divide-border/60 max-h-64 overflow-y-auto">
                    {workspaceMembers?.map(member => {
                      const isChecked = selectedMemberUserIds.includes(member.userId);
                      return (
                        <div
                          key={member.id}
                          onClick={() =>
                            setSelectedMemberUserIds(prev =>
                              isChecked
                                ? prev.filter(id => id !== member.userId)
                                : [...prev, member.userId],
                            )
                          }
                          className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                            isChecked ? 'bg-primary/5' : 'hover:bg-muted/30'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Checkbox
                              checked={isChecked}
                              onCheckedChange={() => {
                                setSelectedMemberUserIds(prev =>
                                  isChecked
                                    ? prev.filter(id => id !== member.userId)
                                    : [...prev, member.userId],
                                );
                              }}
                            />
                            <Avatar className="size-8 border border-border">
                              <AvatarImage src={member.user?.avatarUrl || undefined} />
                              <AvatarFallback className="text-[10px] font-semibold">
                                {member.user?.name?.slice(0, 2).toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-foreground truncate">
                                {member.user?.name || 'Chưa đặt tên'}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate">
                                {member.user?.email}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {member.role}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentStep(2)}
                      className="text-xs h-8"
                    >
                      Quay lại
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCreateGenericInbox}
                      disabled={isSubmittingGeneric}
                      className="text-xs h-8 gap-1.5 font-medium"
                    >
                      {isSubmittingGeneric ? (
                        <>
                          <Spinner className="size-3.5" data-icon="inline-start" />
                          Đang tạo hộp thư...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                          Hoàn tất & Tạo hộp thư
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ─── STEP 4: FINISH & INTEGRATION GUIDE ────────────────────────────────── */}
            {currentStep === 4 && createdResult && (
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
                        Hộp thư <strong className="text-foreground">{createdResult.name}</strong> đã
                        được cấu hình thành công và phân bổ cho nhân sự trong Workspace.
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
                          <CardTitle className="text-sm font-semibold">
                            Mã nhúng Website Live Chat
                          </CardTitle>
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
                        <code className="font-mono text-foreground">&lt;/body&gt;</code> trên
                        website của bạn.
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
                        <CardTitle className="text-sm font-semibold">
                          Thử nghiệm Telegram Bot
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Mở Telegram và gửi lệnh <code className="font-mono">/start</code> vào bot
                        của bạn để tạo hội thoại đầu tiên.
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
                        Mọi tin nhắn khách hàng gửi vào Fanpage sẽ được truyền trực tiếp vào Hộp thư
                        đến theo thời gian thực (Realtime &lt; 1s).
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
                        Cấu hình đường dẫn Webhook này vào mục Quản lý ứng dụng Zalo Developer để
                        tiếp nhận tin nhắn từ Zalo OA.
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
                        <CardTitle className="text-sm font-semibold">
                          Hòm thư hỗ trợ Email sẵn sàng
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs">
                        Mọi email gửi đến hộp thư được cấu hình sẽ tự động tạo thành cuộc hội thoại
                        trong Sales Copilot.
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCreatedResult(null);
                      setSelectedChannelKey(null);
                      setCurrentStep(1);
                      router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                    }}
                    className="text-xs h-9 gap-1.5"
                  >
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
                      onClick={() =>
                        router.push(`/${workspaceSlug}/settings/inboxes/${createdResult.id}`)
                      }
                      className="text-xs h-9 gap-1.5 font-medium"
                    >
                      <Settings className="size-3.5" data-icon="inline-start" />
                      Cấu hình chi tiết
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsGuard>
  );
}
