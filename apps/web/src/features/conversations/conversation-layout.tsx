'use client';

import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ConversationEmptyState } from './conversation-empty-state';
import { ConversationList } from './conversation-list';
import { MessageThread } from './message-thread';
import { DetailPanelPlaceholder } from './detail-panel-placeholder';

interface ConversationLayoutProps {
  workspaceSlug: string;
  conversationId?: string;
}

export function ConversationLayout({ workspaceSlug, conversationId }: ConversationLayoutProps) {
  const [isDetailOpen, setIsDetailOpen] = React.useState(true);

  return (
    <div className="flex h-full w-full flex-1 overflow-hidden">
      <ResizablePanelGroup
        orientation="horizontal"
        id="sales-copilot-conversation-panels"
        className="h-full w-full"
      >
        {/* Left Column: Conversation List */}
        <ResizablePanel
          id="conversation-list-panel"
          defaultSize="25%"
          minSize="20%"
          maxSize="35%"
          className=""
        >
          <ConversationList workspaceSlug={workspaceSlug} activeConversationId={conversationId} />
        </ResizablePanel>

        <ResizableHandle withHandle className="hover:bg-primary/50 transition-colors" />

        {/* Center Column: Message Thread or Empty State */}
        <ResizablePanel
          id="message-thread-panel"
          defaultSize={isDetailOpen && conversationId ? '50%' : '75%'}
          minSize="30%"
          className=""
        >
          {conversationId ? (
            <MessageThread
              conversationId={conversationId}
              workspaceSlug={workspaceSlug}
              isDetailOpen={isDetailOpen}
              onToggleDetail={() => setIsDetailOpen(prev => !prev)}
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
              className=""
            >
              <DetailPanelPlaceholder onClose={() => setIsDetailOpen(false)} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
