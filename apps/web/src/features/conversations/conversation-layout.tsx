'use client';

import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { usePosRealtimeSync, AiAutofillBanner } from '@/features/pos';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import type { PosDraftSuggestedEventPayload } from '@sales-copilot/shared-contracts';
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
  const [detailTab, setDetailTab] = React.useState<'contact' | 'pos'>('contact');
  const [newOrderTrigger, setNewOrderTrigger] = React.useState<number>(0);
  const [posDraftSuggestion, setPosDraftSuggestion] =
    React.useState<PosDraftSuggestedEventPayload | null>(null);

  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id || workspaces?.[0]?.id;

  const { data: conversation } = useConversation(conversationId, {
    workspaceSlug,
    workspaceId,
  });

  const resolvedWorkspaceId = workspaceId || conversation?.workspaceId;

  // Clear suggestion on conversation switch
  React.useEffect(() => {
    setPosDraftSuggestion(null);
  }, [conversationId]);

  // Real-time synchronization for POS order changes, bank reconciliation, and chat receipts
  usePosRealtimeSync({
    workspaceId: resolvedWorkspaceId,
    conversationId,
    onDraftSuggested: payload => {
      setPosDraftSuggestion(payload);
    },
  });

  const handleStartNewOrder = React.useCallback(() => {
    setIsDetailOpen(true);
    setDetailTab('pos');
    setNewOrderTrigger(prev => prev + 1);
  }, []);

  // Global F4 shortcut to open/switch to POS order creation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F4') {
        e.preventDefault();
        if (!conversationId) return;
        handleStartNewOrder();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversationId, handleStartNewOrder]);

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
          maxSize="30%"
          className="min-h-0 overflow-hidden"
        >
          <ConversationList workspaceSlug={workspaceSlug} activeConversationId={conversationId} />
        </ResizablePanel>

        <ResizableHandle withHandle className="hover:bg-primary/50 transition-colors" />

        {/* Center Column: Message Thread or Empty State */}
        <ResizablePanel
          id="message-thread-panel"
          defaultSize={isDetailOpen && conversationId ? '45%' : '75%'}
          minSize="30%"
          className="min-h-0 overflow-hidden"
        >
          {conversationId ? (
            <div className="flex flex-col h-full w-full min-h-0">
              {posDraftSuggestion && (
                <div className="p-2 border-b bg-background shrink-0">
                  <AiAutofillBanner
                    suggestion={posDraftSuggestion}
                    onApply={() => {
                      setIsDetailOpen(true);
                      setDetailTab('pos');
                    }}
                    onDismiss={() => setPosDraftSuggestion(null)}
                  />
                </div>
              )}
              <div className="flex-1 min-h-0">
                <MessageThread
                  conversationId={conversationId}
                  workspaceSlug={workspaceSlug}
                  workspaceId={resolvedWorkspaceId}
                  isDetailOpen={isDetailOpen}
                  onToggleDetail={() => setIsDetailOpen(prev => !prev)}
                  onOpenPosDrawer={handleStartNewOrder}
                />
              </div>
            </div>
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
              defaultSize="30%"
              minSize="22%"
              maxSize="45%"
              className="min-h-0 overflow-hidden"
            >
              <DetailPanel
                conversationId={conversationId}
                workspaceSlug={workspaceSlug}
                workspaceId={resolvedWorkspaceId}
                activeTab={detailTab}
                onTabChange={setDetailTab}
                newOrderTrigger={newOrderTrigger}
                draftSuggestion={posDraftSuggestion}
                onDismissSuggestion={() => setPosDraftSuggestion(null)}
                onClose={() => setIsDetailOpen(false)}
                onOpenPosDrawer={handleStartNewOrder}
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
