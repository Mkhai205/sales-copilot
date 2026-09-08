'use client';

import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PosDrawer } from '@/features/pos';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import type { OrderResponseDto } from '@sales-copilot/shared-contracts';
import { ConversationEmptyState } from './conversation-empty-state';
import { ConversationList } from './conversation-list';
import { MessageThread } from './message-thread';
import { DetailPanel } from './detail-panel';
import { useConversation } from './hooks/use-conversation';

interface ConversationLayoutProps {
  workspaceSlug: string;
  conversationId?: string;
}

export function ConversationLayout({ workspaceSlug, conversationId }: ConversationLayoutProps) {
  const [isDetailOpen, setIsDetailOpen] = React.useState(true);
  const [isPosDrawerOpen, setIsPosDrawerOpen] = React.useState(false);
  const [orderToEdit, setOrderToEdit] = React.useState<OrderResponseDto | null>(null);

  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id || workspaces?.[0]?.id;

  const { data: conversation } = useConversation(conversationId, {
    workspaceSlug,
    workspaceId,
  });

  const resolvedWorkspaceId = workspaceId || conversation?.workspaceId;

  const handleOpenPosDrawer = React.useCallback((order?: OrderResponseDto | null) => {
    setOrderToEdit(order || null);
    setIsPosDrawerOpen(true);
  }, []);

  // Global F4 shortcut to toggle POS Drawer
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (!conversationId) return;
        setIsPosDrawerOpen(prev => {
          if (prev) {
            setOrderToEdit(null);
            return false;
          }
          return true;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversationId]);

  return (
    <div className="flex h-full w-full min-h-0 flex-1 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        id="sales-copilot-conversation-panels"
        className="h-full w-full min-h-0"
      >
        {/* Left Column: Conversation List */}
        <ResizablePanel
          id="conversation-list-panel"
          defaultSize="25%"
          minSize="20%"
          maxSize="35%"
          className="min-h-0 overflow-hidden"
        >
          <ConversationList workspaceSlug={workspaceSlug} activeConversationId={conversationId} />
        </ResizablePanel>

        <ResizableHandle withHandle className="hover:bg-primary/50 transition-colors" />

        {/* Center Column: Message Thread or Empty State */}
        <ResizablePanel
          id="message-thread-panel"
          defaultSize={isDetailOpen && conversationId ? '50%' : '75%'}
          minSize="30%"
          className="min-h-0 overflow-hidden"
        >
          {conversationId ? (
            <MessageThread
              conversationId={conversationId}
              workspaceSlug={workspaceSlug}
              workspaceId={resolvedWorkspaceId}
              isDetailOpen={isDetailOpen}
              onToggleDetail={() => setIsDetailOpen(prev => !prev)}
              onOpenPosDrawer={() => handleOpenPosDrawer(null)}
            />
          ) : (
            <ConversationEmptyState />
          )}
        </ResizablePanel>

        {/* Right Column: Contact & Conversation Detail (Collapsible) */}
        {conversationId && isDetailOpen && (
          <>
            <ResizableHandle withHandle className="hover:bg-primary/50 transition-colors" />
            <ResizablePanel
              id="detail-panel"
              defaultSize="25%"
              minSize="20%"
              maxSize="35%"
              className="min-h-0 overflow-hidden"
            >
              <DetailPanel
                conversationId={conversationId}
                workspaceSlug={workspaceSlug}
                workspaceId={resolvedWorkspaceId}
                onClose={() => setIsDetailOpen(false)}
                onOpenPosDrawer={handleOpenPosDrawer}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>

      {/* Slide-over POS Drawer */}
      {resolvedWorkspaceId && (
        <PosDrawer
          isOpen={isPosDrawerOpen}
          onOpenChange={open => {
            setIsPosDrawerOpen(open);
            if (!open) {
              setOrderToEdit(null);
            }
          }}
          workspaceId={resolvedWorkspaceId}
          conversationId={conversationId}
          contactId={conversation?.contactId}
          initialOrder={orderToEdit}
          contactName={conversation?.contact?.name}
          contactPhone={conversation?.contact?.phoneNumber}
        />
      )}
    </div>
  );
}
