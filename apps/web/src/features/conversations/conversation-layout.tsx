'use client';

import * as React from 'react';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { ConversationEmptyState } from './conversation-empty-state';
import { ConversationListPlaceholder } from './conversation-list-placeholder';
import { MessageThreadPlaceholder } from './message-thread-placeholder';
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
          className="min-w-[280px]"
        >
          <ConversationListPlaceholder
            workspaceSlug={workspaceSlug}
            activeConversationId={conversationId}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className="hover:bg-primary/50 transition-colors" />

        {/* Center Column: Message Thread or Empty State */}
        <ResizablePanel
          id="message-thread-panel"
          defaultSize={isDetailOpen && conversationId ? '50%' : '75%'}
          minSize="30%"
          className="min-w-[360px]"
        >
          {conversationId ? (
            <MessageThreadPlaceholder
              conversationId={conversationId}
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
              className="min-w-[260px]"
            >
              <DetailPanelPlaceholder onClose={() => setIsDetailOpen(false)} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
