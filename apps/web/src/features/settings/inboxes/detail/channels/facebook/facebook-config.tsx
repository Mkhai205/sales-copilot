'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  DEFAULT_COMMENT_GUARD_PRIVATE_REPLY,
  DEFAULT_COMMENT_GUARD_PUBLIC_REPLY,
  type InboxDetailDto,
} from '@sales-copilot/shared-contracts';
import { useQueryClient } from '@tanstack/react-query';
import { inboxKeys } from '@/lib/query-keys';
import { facebookApi } from '../../../api/facebook';
import { useUpdateInbox } from '../../../hooks/use-inboxes';
import { useFacebookOAuthPopup } from '../../../hooks/use-facebook-oauth-popup';
import { FacebookConnectionCard } from './facebook-connection-card';
import { FacebookCommentGuardCard } from './facebook-comment-guard-card';
import { FacebookDisconnectDialog } from './facebook-disconnect-dialog';

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

  const channelSettings = (inbox.channel?.settings as Record<string, any>) || {};
  const isConnected = Boolean(inbox.channel?.isConnected);
  const pageId = inbox.channel?.providerAccountId || channelSettings.pageId || '109283746581920';
  const pageName = channelSettings.pageName || inbox.name || 'Sales Copilot Flagship Store';
  const lastSyncAt = channelSettings.lastSyncAt;

  // ── Handle OAuth Connect / Re-authorize ────────────────────────────────────
  const handleReauthorizeSession = React.useCallback(
    async (sessId: string) => {
      if (!inbox.channel?.id) return;
      setIsSyncingSession(true);
      const channelId = inbox.channel.id;
      try {
        await facebookApi.reauthorizePage(workspaceId, channelId, sessId);
        toast.success('Đồng bộ và kết nối Fanpage Facebook thành công!', {
          id: `fb-reauth-${channelId}`,
        });
        queryClient.invalidateQueries({ queryKey: inboxKeys.detail(workspaceId, inbox.id) });
      } catch (err: any) {
        toast.error(err.message || 'Không thể đồng bộ Fanpage Facebook', {
          id: `fb-reauth-${channelId}`,
        });
      } finally {
        setIsSyncingSession(false);
      }
    },
    [workspaceId, inbox.channel?.id, inbox.id, queryClient],
  );

  const { openOAuthPopup, isConnecting: isReauthorizing } = useFacebookOAuthPopup({
    workspaceId,
    onSuccess: newSessionId => {
      handleReauthorizeSession(newSessionId);
    },
    onError: err => {
      toast.error(err || 'Không thể khởi tạo liên kết Facebook OAuth');
    },
  });

  const handleStartFacebookOAuth = openOAuthPopup;

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
      <FacebookConnectionCard
        isConnected={isConnected}
        isSyncingSession={isSyncingSession}
        lastSyncError={channelSettings.lastSyncError}
        pageName={pageName}
        pageId={pageId}
        lastSyncAt={lastSyncAt}
        isReauthorizing={isReauthorizing}
        onStartOAuth={handleStartFacebookOAuth}
        onOpenDisconnect={setIsDisconnectOpen}
      />

      {/* ─── CARD 2: VỆ SĨ BÌNH LUẬN (COMMENT GUARD) ──────────────────────── */}
      <FacebookCommentGuardCard
        commentGuardEnabled={commentGuardEnabled}
        onCommentGuardEnabledChange={setCommentGuardEnabled}
        publicReplyEnabled={publicReplyEnabled}
        onPublicReplyEnabledChange={setPublicReplyEnabled}
        privateReplyTemplate={privateReplyTemplate}
        onPrivateReplyTemplateChange={setPrivateReplyTemplate}
        publicReplyTemplate={publicReplyTemplate}
        onPublicReplyTemplateChange={setPublicReplyTemplate}
        onSave={handleSaveCommentGuard}
        isUpdating={isUpdating}
      />

      {/* ─── DIALOG: NGẮT KẾT NỐI FACEBOOK FANPAGE ────────────────────────── */}
      <FacebookDisconnectDialog
        isOpen={isDisconnectOpen}
        onOpenChange={setIsDisconnectOpen}
        pageName={pageName}
        isUpdating={isUpdating}
        onDisconnect={handleDisconnect}
      />
    </div>
  );
}
