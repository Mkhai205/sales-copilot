'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { ChannelType } from '@sales-copilot/shared-contracts';

import { SettingsGuard, useSettingsRbac } from '@/features/settings';
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

const CHANNEL_CARDS = [
  {
    type: ChannelType.FACEBOOK_MESSENGER,
    key: 'facebook',
    title: 'Facebook Messenger',
    description:
      'Connect Facebook Fanpages via 1-click OAuth to receive and reply to customer messages.',
    badge: 'Popular',
    logoSrc: '/channels/messenger.png',
  },
  {
    type: ChannelType.WEB_CHAT,
    key: 'web_chat',
    title: 'Website Live Chat',
    description: 'Embed an interactive customer live chat widget on your website or web store.',
    logoSrc: '/channels/website.png',
  },
  {
    type: ChannelType.TELEGRAM,
    key: 'telegram',
    title: 'Telegram Bot',
    description: 'Connect a Telegram bot token to handle customer messages directly from Telegram.',
    logoSrc: '/channels/telegram.png',
  },
  {
    type: ChannelType.ZALO,
    key: 'zalo',
    title: 'Zalo Official Account',
    description:
      'Engage Vietnamese customers by integrating your Zalo OA via OA ID and Secret Key.',
    logoSrc: '/channels/zalo.png',
  },
  {
    type: ChannelType.EMAIL,
    key: 'email',
    title: 'Email Support',
    description:
      'Connect a shared mailbox via SMTP / IMAP to handle customer emails as conversations.',
    logoSrc: '/channels/email.png',
  },
];

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

function NewInboxPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const workspaceSlug = (params?.workspaceSlug as string) || '';
  const { currentWorkspace } = useSettingsRbac(workspaceSlug);

  const initialChannelParam = searchParams.get('channel');
  const sessionIdParam = searchParams.get('sessionId');

  // Selected Channel State
  const [selectedChannelKey, setSelectedChannelKey] = React.useState<string | null>(
    initialChannelParam || null,
  );

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
  const [telegramBotToken, setTelegramBotToken] = React.useState('');
  const [webChatDomain, setWebChatDomain] = React.useState('');
  const [zaloOaId, setZaloOaId] = React.useState('');
  const [zaloSecretKey, setZaloSecretKey] = React.useState('');
  const [emailAddress, setEmailAddress] = React.useState('');
  const [isSubmittingGeneric, setIsSubmittingGeneric] = React.useState(false);

  const selectedChannel = CHANNEL_CARDS.find(c => c.key === selectedChannelKey);

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
      toast.error(err.message || 'Failed to discover Facebook Fanpages');
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

      // In-place Full Redirect (Option A)
      window.location.href = authUrl;
    } catch (err: any) {
      toast.error(err.message || 'Failed to initiate Facebook OAuth authorization');
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
      toast.success(
        `Successfully connected ${count} Facebook Fanpage${count > 1 ? 's' : ''} to Sales Copilot!`,
      );

      // Invalidate inboxes query & navigate back to inboxes list
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });
      router.push(`/${workspaceSlug}/settings/inboxes`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect selected Facebook Pages');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const handleConnectManualFb = async () => {
    if (!currentWorkspace?.id || !manualFbPageId.trim() || !manualFbToken.trim()) {
      toast.error('Page ID and Page Access Token are required');
      return;
    }

    setIsSubmittingManualFb(true);
    try {
      await facebookApi.connectPage(currentWorkspace.id, {
        pageId: manualFbPageId.trim(),
        pageName: manualFbPageName.trim() || `Facebook Page (${manualFbPageId.trim()})`,
        pageAccessToken: manualFbToken.trim(),
        userAccessToken: manualFbToken.trim(),
        inboxName: manualFbPageName.trim() || undefined,
      });

      toast.success('Facebook Page connected successfully!');
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });
      router.push(`/${workspaceSlug}/settings/inboxes`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to connect Facebook Page manually');
    } finally {
      setIsSubmittingManualFb(false);
    }
  };

  // ─── Other Channels Handler ─────────────────────────────────────────────────

  const handleCreateGenericInbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace?.id || !selectedChannel) return;

    setIsSubmittingGeneric(true);
    try {
      let credentials: Record<string, unknown> = {};
      let defaultName = genericInboxName.trim();
      let providerAccountId: string | undefined;

      switch (selectedChannel.type) {
        case ChannelType.TELEGRAM: {
          if (!telegramBotToken.trim()) {
            toast.error('Telegram Bot Token is required');
            setIsSubmittingGeneric(false);
            return;
          }
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
          if (!zaloOaId.trim() || !zaloSecretKey.trim()) {
            toast.error('Zalo OA ID and Secret Key are required');
            setIsSubmittingGeneric(false);
            return;
          }
          credentials = { oaId: zaloOaId.trim(), secretKey: zaloSecretKey.trim() };
          providerAccountId = zaloOaId.trim();
          if (!defaultName) defaultName = 'Zalo Official Account';
          break;
        }
        case ChannelType.EMAIL: {
          if (!emailAddress.trim()) {
            toast.error('Email address is required');
            setIsSubmittingGeneric(false);
            return;
          }
          credentials = { emailAddress: emailAddress.trim() };
          providerAccountId = emailAddress.trim();
          if (!defaultName) defaultName = `Email (${emailAddress.trim()})`;
          break;
        }
      }

      await inboxesApi.create(currentWorkspace.id, {
        name: defaultName,
        channelType: selectedChannel.type,
        channelCredentials: credentials,
        providerAccountId,
      });

      toast.success(`${selectedChannel.title} inbox created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['inboxes', currentWorkspace.id] });
      router.push(`/${workspaceSlug}/settings/inboxes`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create inbox');
    } finally {
      setIsSubmittingGeneric(false);
    }
  };

  const eligiblePages = pages.filter(p => !p.isAlreadyConnected);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="inboxes">
      <div className="flex flex-col gap-6 max-w-4xl pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedChannelKey) {
                setSelectedChannelKey(null);
                router.replace(`/${workspaceSlug}/settings/inboxes/new`);
              } else {
                router.push(`/${workspaceSlug}/settings/inboxes`);
              }
            }}
            className="w-fit -ml-2 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            {selectedChannelKey ? 'Back to Channel Selection' : 'Back to Inboxes'}
          </Button>

          <div>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">
              {selectedChannel ? `Connect ${selectedChannel.title}` : 'Set up a new Inbox'}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedChannel
                ? selectedChannel.description
                : 'Choose a communication channel to start conversing with your customers in Sales Copilot.'}
            </p>
          </div>
        </div>

        {/* ─── STEP 1: CHANNEL SELECTION GRID ───────────────────────────────────── */}
        {!selectedChannelKey && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHANNEL_CARDS.map(channel => (
              <Card
                key={channel.key}
                onClick={() => {
                  setSelectedChannelKey(channel.key);
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
                        className="size-7 object-contain"
                      />
                    </div>
                    {channel.badge && (
                      <Badge variant="secondary" className="text-[10px] font-medium">
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
                  <span>Get Started</span>
                  <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ─── STEP 2: FACEBOOK MESSENGER FLOW ──────────────────────────────────── */}
        {selectedChannelKey === 'facebook' && (
          <div className="flex flex-col gap-6">
            {/* View A: No sessionId -> OAuth Connect Card */}
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
                          className="size-7 object-contain"
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base font-semibold">
                          Log in with Facebook
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Grant Sales Copilot permission to access your Fanpages and manage
                          messages.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-5 pt-2">
                    <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs leading-relaxed text-muted-foreground flex flex-col gap-2">
                      <div className="flex items-center gap-2 font-medium text-foreground">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        <span>Secure OAuth Direct Connection (Option A)</span>
                      </div>
                      <p>
                        When you click the button below, you will be redirected to Meta’s official
                        authorization page. You can choose which Fanpages to manage. Upon approval,
                        Meta will safely redirect you back here with your Fanpages ready to connect.
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
                            Connecting to Facebook...
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
                            Continue with Facebook
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Collapsible Manual Connect Fallback for Dev/Testing */}
                <Collapsible open={isManualFbOpen} onOpenChange={setIsManualFbOpen}>
                  <Card className="border-border bg-card/20">
                    <CardHeader className="py-3">
                      <CollapsibleTrigger asChild>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between text-left text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <span>Looking for manual credential entry (Page ID & Access Token)?</span>
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
                              placeholder="e.g. 104829104812"
                              className="h-8 text-xs"
                            />
                          </Field>
                          <Field>
                            <FieldLabel htmlFor="manual-page-name" className="text-xs">
                              Page Name (Optional)
                            </FieldLabel>
                            <Input
                              id="manual-page-name"
                              value={manualFbPageName}
                              onChange={e => setManualFbPageName(e.target.value)}
                              placeholder="e.g. My Awesome Fanpage"
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
                              Connecting...
                            </>
                          ) : (
                            'Connect Manually'
                          )}
                        </Button>
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              </div>
            ) : (
              /* View B: With sessionId -> Discovered Fanpages & Multi-select */
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      Select Facebook Pages to Connect
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Choose which Fanpages you want to import as Inboxes in Sales Copilot.
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
                    Switch Account / Refresh
                  </Button>
                </div>

                {isLoadingPages ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-12 rounded-xl border border-border bg-card/30 text-center">
                    <Spinner className="size-6 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Fetching your Facebook Fanpages from Meta...
                    </p>
                  </div>
                ) : pages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-10 rounded-xl border border-dashed border-border bg-card/20 text-center">
                    <p className="text-xs text-muted-foreground">
                      No Facebook Pages found for this account. Ensure you have admin access to at
                      least one Fanpage and granted the necessary permissions.
                    </p>
                    <Button size="sm" onClick={handleStartFacebookOAuth} className="text-xs h-8">
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {/* Multi-select Header Toolbar */}
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
                          Select all eligible pages ({eligiblePages.length})
                        </label>
                      </div>

                      <span className="text-xs text-muted-foreground">
                        {selectedPageIds.length} of {eligiblePages.length} selected
                      </span>
                    </div>

                    {/* Pages List */}
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
                                Already Linked
                              </Badge>
                            ) : isSelected ? (
                              <Check className="size-4 text-primary shrink-0" />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Member Auto-Assignment Smart Option */}
                    <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3.5 mt-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium text-foreground">
                          Auto-assign workspace agents
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Automatically grant all active workspace members access to these inboxes.
                        </span>
                      </div>
                      <Switch checked={assignAllMembers} onCheckedChange={setAssignAllMembers} />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedChannelKey(null);
                          router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                        }}
                        className="text-xs h-9"
                      >
                        Cancel
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
                            Connecting Inboxes...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="size-3.5" data-icon="inline-start" />
                            Connect {selectedPageIds.length} Selected Page
                            {selectedPageIds.length === 1 ? '' : 's'}
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

        {/* ─── STEP 2: OTHER CHANNELS FORMS ─────────────────────────────────────── */}
        {selectedChannelKey && selectedChannelKey !== 'facebook' && selectedChannel && (
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
                    className="size-7 object-contain"
                  />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Configure {selectedChannel.title}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Fill in the required details to create this inbox.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleCreateGenericInbox} className="flex flex-col gap-4">
                <FieldGroup className="gap-3.5">
                  {/* Optional Custom Inbox Name */}
                  <Field>
                    <FieldLabel htmlFor="inbox-name" className="text-xs">
                      Inbox Name
                    </FieldLabel>
                    <Input
                      id="inbox-name"
                      value={genericInboxName}
                      onChange={e => setGenericInboxName(e.target.value)}
                      placeholder={`e.g. My ${selectedChannel.title}`}
                      className="h-8 text-xs"
                    />
                    <FieldDescription className="text-[11px]">
                      Leave empty to use the channel default name.
                    </FieldDescription>
                  </Field>

                  {/* Telegram Specific */}
                  {selectedChannel.type === ChannelType.TELEGRAM && (
                    <Field>
                      <FieldLabel htmlFor="telegram-token" className="text-xs">
                        Telegram Bot Token <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="telegram-token"
                        type="password"
                        required
                        value={telegramBotToken}
                        onChange={e => setTelegramBotToken(e.target.value)}
                        placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                        className="h-8 text-xs"
                      />
                      <FieldDescription className="text-[11px]">
                        Obtain your token by messaging @BotFather on Telegram.
                      </FieldDescription>
                    </Field>
                  )}

                  {/* Web Chat Specific */}
                  {selectedChannel.type === ChannelType.WEB_CHAT && (
                    <Field>
                      <FieldLabel htmlFor="webchat-domain" className="text-xs">
                        Website Domain / URL (Optional)
                      </FieldLabel>
                      <Input
                        id="webchat-domain"
                        value={webChatDomain}
                        onChange={e => setWebChatDomain(e.target.value)}
                        placeholder="e.g. https://mycompany.com"
                        className="h-8 text-xs"
                      />
                    </Field>
                  )}

                  {/* Zalo Specific */}
                  {selectedChannel.type === ChannelType.ZALO && (
                    <>
                      <Field>
                        <FieldLabel htmlFor="zalo-oa-id" className="text-xs">
                          Zalo Official Account ID <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          id="zalo-oa-id"
                          required
                          value={zaloOaId}
                          onChange={e => setZaloOaId(e.target.value)}
                          placeholder="e.g. 182736451928"
                          className="h-8 text-xs"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="zalo-secret" className="text-xs">
                          Zalo OA Secret Key <span className="text-destructive">*</span>
                        </FieldLabel>
                        <Input
                          id="zalo-secret"
                          type="password"
                          required
                          value={zaloSecretKey}
                          onChange={e => setZaloSecretKey(e.target.value)}
                          placeholder="Enter your Zalo OA Secret Key"
                          className="h-8 text-xs"
                        />
                      </Field>
                    </>
                  )}

                  {/* Email Specific */}
                  {selectedChannel.type === ChannelType.EMAIL && (
                    <Field>
                      <FieldLabel htmlFor="email-address" className="text-xs">
                        Support Email Address <span className="text-destructive">*</span>
                      </FieldLabel>
                      <Input
                        id="email-address"
                        type="email"
                        required
                        value={emailAddress}
                        onChange={e => setEmailAddress(e.target.value)}
                        placeholder="e.g. support@company.com"
                        className="h-8 text-xs"
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
                      router.replace(`/${workspaceSlug}/settings/inboxes/new`);
                    }}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingGeneric}
                    className="text-xs h-8 font-medium"
                  >
                    {isSubmittingGeneric ? (
                      <>
                        <Spinner className="size-3.5" data-icon="inline-start" />
                        Creating Inbox...
                      </>
                    ) : (
                      'Create Inbox'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </SettingsGuard>
  );
}
