'use client';

import * as React from 'react';
import { ArrowDown, ChevronUp, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from '@/components/ui/message-scroller';
import { Marker, MarkerContent } from '@/components/ui/marker';
import type { AiDebugMetadata } from '@sales-copilot/shared-contracts';
import { AiMessageDebugSheet } from './ai-message-debug-sheet';
import { useConversation } from '../list/hooks/use-conversation';
import { useMessages } from './hooks/use-messages';
import { useResetUnreadMutation } from '../detail/hooks/use-conversation-mutations';
import { useWorkspaceContext } from '@/providers/workspace-provider';
import { MessageThreadHeader } from './message-thread-header';
import { TypingIndicator } from './typing-indicator';
import { ChatComposer } from '../composer/chat-composer';
import { useConversationRoom } from '@/lib/socket/use-conversation-room';
import { ImageLightboxDialog } from './image-lightbox-dialog';
import { MessageItem } from './message-item';
import { MessageThreadLoading } from './message-thread-loading';
import { MessageThreadScrollerController } from './thread-scroll-controller';
import { useLightbox } from './hooks/use-lightbox';

interface MessageThreadProps {
  conversationId: string;
  workspaceSlug?: string;
  workspaceId?: string;
  isDetailOpen?: boolean;
  onToggleDetail?: () => void;
  onOpenPosDrawer?: () => void;
}

export function MessageThread({
  conversationId,
  workspaceSlug,
  workspaceId,
  isDetailOpen = true,
  onToggleDetail = () => {},
  onOpenPosDrawer,
}: MessageThreadProps) {
  useConversationRoom(conversationId);

  const { data: conversation, isLoading: isConversationLoading } = useConversation(conversationId, {
    workspaceId,
  });

  const {
    messages,
    groupedMessages,
    isLoading: isMessagesLoading,
    isEmpty,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMessages(conversationId, {
    workspaceId,
    limit: 50,
  });

  const { lightboxState, openLightbox, closeLightbox } = useLightbox();
  const [selectedAiDebug, setSelectedAiDebug] = React.useState<AiDebugMetadata | null>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const [newUnreadCount, setNewUnreadCount] = React.useState(0);

  const { workspaceId: contextWorkspaceId } = useWorkspaceContext();
  const activeWorkspaceId =
    workspaceId || conversation?.workspaceId || contextWorkspaceId || undefined;

  const resetUnreadMutation = useResetUnreadMutation();
  const unreadCount = conversation?.unreadMessagesCount ?? 0;

  // Mark conversation as read on view/open (BR-4.3)
  React.useEffect(() => {
    if (!conversationId || !activeWorkspaceId || unreadCount <= 0) {
      return;
    }

    resetUnreadMutation.mutate({ workspaceId: activeWorkspaceId, conversationId });
  }, [conversationId, activeWorkspaceId, unreadCount, resetUnreadMutation]);

  const isLoading = isConversationLoading || isMessagesLoading;
  const contact = conversation?.contact;

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Thread Header */}
      <MessageThreadHeader
        conversation={conversation}
        workspaceSlug={workspaceSlug}
        isLoading={isConversationLoading}
        isDetailOpen={Boolean(isDetailOpen)}
        onToggleDetail={() => onToggleDetail?.()}
        onOpenPosDrawer={onOpenPosDrawer}
      />

      {/* Message Stream Area */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <MessageThreadLoading />
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <div className="rounded-full bg-muted p-3">
              <MessageSquare className="size-6 text-muted-foreground/60 stroke-[1.5]" />
            </div>
            <p className="text-xs font-medium text-foreground">No messages yet</p>
            <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
              This conversation doesn&apos;t have any messages. Start the conversation using the
              composer below.
            </p>
          </div>
        ) : (
          <MessageScroller autoScroll defaultScrollPosition="end" className="h-full">
            <MessageThreadScrollerController
              messages={messages}
              conversationId={conversationId}
              viewportRef={viewportRef}
              onAtBottom={() => setNewUnreadCount(0)}
              onNewInboundMessage={() => setNewUnreadCount(prev => prev + 1)}
            />
            <MessageScrollerViewport ref={viewportRef} className="p-4">
              <MessageScrollerContent className="gap-4">
                {hasNextPage && (
                  <MessageScrollerItem messageId="load-older" className="flex justify-center py-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-muted-foreground cursor-pointer"
                      disabled={isFetchingNextPage}
                      onClick={() => fetchNextPage()}
                    >
                      {isFetchingNextPage ? (
                        <Spinner className="size-3" />
                      ) : (
                        <ChevronUp className="size-3.5" />
                      )}
                      Tin nhắn cũ hơn
                    </Button>
                  </MessageScrollerItem>
                )}
                {groupedMessages.map(group => (
                  <React.Fragment key={group.dateKey}>
                    {/* Date Separator */}
                    <MessageScrollerItem
                      messageId={`separator-${group.dateKey}`}
                      className="min-w-0 shrink-0"
                    >
                      <Marker variant="separator" className="my-2">
                        <MarkerContent className="text-[11px] font-medium text-muted-foreground">
                          {group.dateLabel}
                        </MarkerContent>
                      </Marker>
                    </MessageScrollerItem>

                    {/* Messages in this day */}
                    {group.messages.map(message => (
                      <MessageItem
                        key={message.id}
                        message={message}
                        contactName={contact?.name}
                        contactAvatar={contact?.avatarUrl}
                        inboxAvatar={conversation?.inbox?.avatarUrl}
                        inboxName={conversation?.inbox?.name}
                        workspaceId={activeWorkspaceId}
                        onOpenLightbox={openLightbox}
                        onInspectAi={setSelectedAiDebug}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>

            {/* Floating Jump to Latest Button */}
            <MessageScrollerButton
              direction="end"
              variant={newUnreadCount > 0 ? 'default' : 'secondary'}
              size={newUnreadCount > 0 ? 'default' : 'icon-sm'}
              className={cn(
                'transition-all duration-200 z-10',
                newUnreadCount > 0
                  ? 'h-8 px-3 rounded-full shadow-lg border-0 bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'rounded-full size-7 shadow-sm border border-border bg-background/90 backdrop-blur-xs hover:bg-muted',
              )}
              onClick={() => {
                setNewUnreadCount(0);
              }}
            >
              {newUnreadCount > 0 ? (
                <div className="flex items-center gap-1.5 text-xs font-medium">
                  <ArrowDown className="size-3.5 animate-bounce" />
                  <span>{'Tin nhắn mới'}</span>
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                    {newUnreadCount > 9 ? '9+' : newUnreadCount}
                  </span>
                </div>
              ) : (
                <>
                  <ArrowDown className="size-3.5" />
                  <span className="sr-only">Scroll to end</span>
                </>
              )}
            </MessageScrollerButton>
          </MessageScroller>
        )}
      </div>

      {/* Typing Status Indicator */}
      <TypingIndicator conversationId={conversationId} />

      {/* Live Message Composer */}
      <ChatComposer
        conversationId={conversationId}
        workspaceSlug={workspaceSlug}
        workspaceId={activeWorkspaceId}
      />

      {/* Lightbox Carousel Modal */}
      <ImageLightboxDialog
        isOpen={lightboxState.isOpen}
        images={lightboxState.images}
        initialIndex={lightboxState.initialIndex}
        onClose={closeLightbox}
      />

      {/* AI Message Debug Sheet */}
      <AiMessageDebugSheet
        open={Boolean(selectedAiDebug)}
        onOpenChange={open => !open && setSelectedAiDebug(null)}
        aiDebug={selectedAiDebug}
      />
    </div>
  );
}
