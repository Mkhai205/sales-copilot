'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  RefreshCw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { facebookApi, type FacebookPageInfo } from '@/lib/api/facebook';

interface FacebookOAuthConnectProps {
  workspaceId: string;
  selectedPage?: FacebookPageInfo;
  sessionId?: string;
  onPageSelect: (page: FacebookPageInfo, sessionId: string) => void;
  onClearSelection: () => void;
  manualCredentials: Record<string, string>;
  onManualCredentialChange: (key: string, value: string) => void;
}

export function FacebookOAuthConnect({
  workspaceId,
  selectedPage,
  sessionId,
  onPageSelect,
  onClearSelection,
  manualCredentials,
  onManualCredentialChange,
}: FacebookOAuthConnectProps) {
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);
  const [isLoadingPages, setIsLoadingPages] = React.useState(false);
  const [currentSessionId, setCurrentSessionId] = React.useState<string | undefined>(sessionId);
  const [pages, setPages] = React.useState<FacebookPageInfo[]>([]);
  const [isManualOpen, setIsManualOpen] = React.useState(
    Boolean(manualCredentials.pageId || manualCredentials.pageAccessToken),
  );

  // Synchronize external sessionId
  React.useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSessionId(sessionId);
      loadPages(sessionId);
    }
  }, [sessionId]);

  const loadPages = async (activeSessionId: string) => {
    setIsLoadingPages(true);
    try {
      const res = await facebookApi.discoverPages(workspaceId, activeSessionId);
      setPages(res.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to discover Facebook Pages');
    } finally {
      setIsLoadingPages(false);
    }
  };

  const handleStartOAuth = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);

    try {
      localStorage.removeItem('facebook_oauth_result');
      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const res = await facebookApi.getAuthUrl(workspaceId, origin);
      const authUrl = res.data.authUrl;

      // Open OAuth popup window
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'fb-oauth-dialog',
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`,
      );

      if (!popup) {
        toast.error('Popup blocked by browser. Please allow popups for this site and try again.');
        setIsAuthenticating(false);
        return;
      }

      const onAuthSuccess = (newSessionId: string) => {
        cleanup();
        setIsAuthenticating(false);
        setCurrentSessionId(newSessionId);
        toast.success('Facebook authorization successful!');
        loadPages(newSessionId);
      };

      const onAuthError = (errorMsg: string) => {
        cleanup();
        setIsAuthenticating(false);
        toast.error(errorMsg || 'Facebook authorization failed');
      };

      // 1. PostMessage listener
      const handleMessage = (event: MessageEvent) => {
        if (!event.data || typeof event.data !== 'object') return;
        if (event.data.type === 'FACEBOOK_OAUTH_SUCCESS' && event.data.sessionId) {
          onAuthSuccess(event.data.sessionId);
        } else if (event.data.type === 'FACEBOOK_OAUTH_ERROR') {
          onAuthError(event.data.error);
        }
      };

      // 2. Storage event listener (same-origin fallback)
      const handleStorage = (event: StorageEvent) => {
        if (event.key === 'facebook_oauth_result' && event.newValue) {
          try {
            const parsed = JSON.parse(event.newValue);
            if (parsed.type === 'FACEBOOK_OAUTH_SUCCESS' && parsed.sessionId) {
              onAuthSuccess(parsed.sessionId);
            } else if (parsed.type === 'FACEBOOK_OAUTH_ERROR') {
              onAuthError(parsed.error);
            }
          } catch {
            // ignore
          }
        }
      };

      // 3. BroadcastChannel listener
      let bc: BroadcastChannel | null = null;
      if (typeof BroadcastChannel !== 'undefined') {
        bc = new BroadcastChannel('facebook_oauth_channel');
        bc.onmessage = event => {
          if (!event.data || typeof event.data !== 'object') return;
          if (event.data.type === 'FACEBOOK_OAUTH_SUCCESS' && event.data.sessionId) {
            onAuthSuccess(event.data.sessionId);
          } else if (event.data.type === 'FACEBOOK_OAUTH_ERROR') {
            onAuthError(event.data.error);
          }
        };
      }

      const cleanup = () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('storage', handleStorage);
        if (bc) {
          bc.close();
          bc = null;
        }
        clearInterval(checkPopupClosed);
      };

      window.addEventListener('message', handleMessage);
      window.addEventListener('storage', handleStorage);

      // Heartbeat timer to detect popup closure or storage updates
      const checkPopupClosed = setInterval(() => {
        // Also check localStorage directly in case storage event missed
        const stored = localStorage.getItem('facebook_oauth_result');
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.type === 'FACEBOOK_OAUTH_SUCCESS' && parsed.sessionId) {
              onAuthSuccess(parsed.sessionId);
              return;
            } else if (parsed.type === 'FACEBOOK_OAUTH_ERROR') {
              onAuthError(parsed.error);
              return;
            }
          } catch {
            // ignore
          }
        }

        if (popup.closed) {
          cleanup();
          setIsAuthenticating(false);
        }
      }, 1000);
    } catch (err: any) {
      setIsAuthenticating(false);
      toast.error(err.message || 'Failed to initialize Facebook OAuth');
    }
  };

  const handleSelectPage = (page: FacebookPageInfo) => {
    if (page.isAlreadyConnected || !currentSessionId) return;
    onPageSelect(page, currentSessionId);
  };

  const handleSwitchAccount = () => {
    onClearSelection();
    setCurrentSessionId(undefined);
    setPages([]);
    handleStartOAuth();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ─── 1. Selected Page Card ────────────────────────────────────────── */}
      {selectedPage && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-3" />
                </span>
                <CardTitle className="text-xs font-semibold text-primary">
                  Connected Facebook Page
                </CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                Change Page
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
              <div className="flex items-center gap-3">
                <Avatar className="size-10">
                  {selectedPage.avatarUrl && (
                    <AvatarImage src={selectedPage.avatarUrl} alt={selectedPage.pageName} />
                  )}
                  <AvatarFallback className="text-xs font-semibold">
                    {selectedPage.pageName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-xs font-medium text-foreground">{selectedPage.pageName}</h4>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    ID: {selectedPage.pageId}{' '}
                    {selectedPage.category && `• ${selectedPage.category}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
                Selected
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── 2. Discovered Pages List (when authenticated and no page selected) ── */}
      {!selectedPage && currentSessionId && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xs font-semibold">Select a Facebook Page</CardTitle>
                <CardDescription className="text-[11px]">
                  Choose which Facebook Fanpage you want to connect to this inbox.
                </CardDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSwitchAccount}
                disabled={isAuthenticating}
                className="h-7 text-xs"
              >
                <RefreshCw data-icon="inline-start" className="size-3" />
                Switch Account
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            {isLoadingPages ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Spinner className="size-6 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Discovering Facebook Pages you manage...
                </p>
              </div>
            ) : pages.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <AlertCircle className="size-6 text-muted-foreground" />
                <p className="text-xs font-medium text-foreground">No Facebook Pages Found</p>
                <p className="max-w-xs text-[11px] text-muted-foreground">
                  The logged-in Facebook account does not manage any Fanpages or does not have
                  sufficient permissions.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSwitchAccount}
                  className="mt-2 text-xs"
                >
                  Try Another Account
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                {pages.map(page => {
                  const isConnected = page.isAlreadyConnected;

                  return (
                    <div
                      key={page.pageId}
                      className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${
                        isConnected
                          ? 'border-border/50 bg-muted/40 opacity-70'
                          : 'border-border hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
                      }`}
                      onClick={() => !isConnected && handleSelectPage(page)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {page.avatarUrl && (
                            <AvatarImage src={page.avatarUrl} alt={page.pageName} />
                          )}
                          <AvatarFallback className="text-xs">
                            {page.pageName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-medium text-foreground leading-snug">
                            {page.pageName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {page.category || 'Facebook Page'} • ID: {page.pageId}
                          </p>
                        </div>
                      </div>

                      {isConnected ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Already Connected
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectPage(page);
                          }}
                          className="h-7 text-xs font-medium"
                        >
                          Select
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── 3. Initial OAuth Connect Prompt (when not authenticated & no page selected) ── */}
      {!selectedPage && !currentSessionId && (
        <Card className="border-border">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center gap-3">
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 dark:bg-blue-500/20">
                <Image
                  src="/channels/facebook.png"
                  alt="Facebook"
                  width={24}
                  height={24}
                  className="size-6 object-contain"
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <CardTitle className="text-xs font-semibold">1-Click Facebook OAuth</CardTitle>
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30">
                    <Sparkles className="size-2.5 mr-0.5 text-primary" /> Recommended
                  </Badge>
                </div>
                <CardDescription className="text-[11px] mt-0.5">
                  Connect your Facebook account to automatically discover Fanpages and configure
                  webhooks with zero hassle.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-4">
            <Button
              type="button"
              onClick={handleStartOAuth}
              disabled={isAuthenticating}
              className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-medium h-9"
            >
              {isAuthenticating ? (
                <>
                  <Spinner className="size-4" />
                  Waiting for Facebook login...
                </>
              ) : (
                <>
                  <ExternalLink data-icon="inline-start" className="size-4" />
                  Connect with Facebook
                </>
              )}
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Requires permissions to manage pages and send/receive Messenger conversations.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── 4. Advanced: Manual Credentials Collapsible ───────────────────── */}
      <Collapsible
        open={isManualOpen}
        onOpenChange={setIsManualOpen}
        className="border-t border-border/60 pt-2"
      >
        <div className="flex items-center justify-between py-1">
          <span className="text-[11px] text-muted-foreground font-medium">
            Need custom tokens or offline setup?
          </span>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-[11px] text-muted-foreground"
            >
              {isManualOpen ? 'Hide Manual Setup' : 'Configure Manually'}
              {isManualOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="mt-3 flex flex-col gap-3">
          <FieldGroup className="gap-3 rounded-lg border border-border/70 bg-muted/20 p-3">
            <Field>
              <FieldLabel htmlFor="fb-page-id" className="text-xs">
                Page ID
              </FieldLabel>
              <Input
                id="fb-page-id"
                value={manualCredentials.pageId || ''}
                onChange={e => onManualCredentialChange('pageId', e.target.value)}
                placeholder="e.g. 104829104928401"
                className="text-xs font-mono"
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="fb-access-token" className="text-xs">
                Page Access Token
              </FieldLabel>
              <Input
                id="fb-access-token"
                type="password"
                value={manualCredentials.pageAccessToken || ''}
                onChange={e => onManualCredentialChange('pageAccessToken', e.target.value)}
                placeholder="EAA..."
                className="text-xs font-mono"
              />
              <FieldDescription className="text-[11px]">
                Long-lived Page Access Token generated from Meta Developer Tools.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="fb-app-secret" className="text-xs">
                App Secret (Optional)
              </FieldLabel>
              <Input
                id="fb-app-secret"
                type="password"
                value={manualCredentials.appSecret || ''}
                onChange={e => onManualCredentialChange('appSecret', e.target.value)}
                placeholder="Your Meta App Secret"
                className="text-xs font-mono"
              />
            </Field>
          </FieldGroup>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
