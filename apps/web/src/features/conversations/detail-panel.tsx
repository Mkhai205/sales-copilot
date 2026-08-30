'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useConversation } from './hooks/use-conversation';
import { ContactInfo } from './contact-info';
import { ConversationActions } from './conversation-actions';
import { LabelManager } from './label-manager';
import { ContactIdentities } from './contact-identities';

interface DetailPanelProps {
  conversationId?: string;
  workspaceSlug?: string;
  workspaceId?: string;
  onClose: () => void;
}

function DetailPanelLoading() {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex flex-col items-center gap-2">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Separator />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <Separator />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-20" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function DetailPanel({
  conversationId,
  workspaceSlug,
  workspaceId,
  onClose,
}: DetailPanelProps) {
  const { conversation, isLoading } = useConversation(conversationId, {
    workspaceSlug,
    workspaceId,
  });

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-card/40 border-l border-border/70">
      {/* Detail Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 bg-background/95 backdrop-blur-xs">
        <h3 className="text-xs font-semibold tracking-tight text-foreground">Details</h3>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
          <span className="sr-only">Close detail panel</span>
        </Button>
      </div>

      {/* Detail Body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading || !conversation ? (
          <DetailPanelLoading />
        ) : (
          <>
            {/* Contact Overview & Attributes */}
            <ContactInfo
              contact={conversation.contact}
              workspaceSlug={workspaceSlug}
              conversationId={conversation.id}
            />

            <Separator className="bg-border/60" />

            {/* Conversation Attributes: Status, Priority, Assignee, Team */}
            <ConversationActions conversation={conversation} workspaceSlug={workspaceSlug} />

            <Separator className="bg-border/60" />

            {/* Labels Manager */}
            <LabelManager conversation={conversation} workspaceSlug={workspaceSlug} />

            <Separator className="bg-border/60" />

            {/* Connected Channel Identities */}
            <ContactIdentities
              contactId={conversation.contactId}
              workspaceSlug={workspaceSlug}
              initialIdentities={conversation.contact?.identities}
            />
          </>
        )}
      </div>
    </div>
  );
}
