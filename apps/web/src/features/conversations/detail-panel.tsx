'use client';

import * as React from 'react';
import { X, User, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { PosDetailTab } from '@/features/pos';
import type { OrderResponseDto } from '@sales-copilot/shared-contracts';
import { useI18n } from '@/lib/i18n';
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
  onOpenPosDrawer?: (orderToEdit?: OrderResponseDto | null) => void;
}

function DetailPanelLoading() {
  return (
    <div className="flex flex-col gap-4 p-4">
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
  onOpenPosDrawer,
}: DetailPanelProps) {
  const { t } = useI18n();
  const { conversation, isLoading } = useConversation(conversationId, {
    workspaceSlug,
    workspaceId,
  });

  const { data: workspaces } = useWorkspaces();
  const resolvedWorkspaceId =
    workspaceId ||
    conversation?.workspaceId ||
    (workspaceSlug ? workspaces?.find(w => w.slug === workspaceSlug)?.id : undefined) ||
    workspaces?.[0]?.id;

  return (
    <div className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-card/40 border-l border-border/70">
      {/* Detail Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/80 px-4 bg-background/95 backdrop-blur-xs">
        <h3 className="text-xs font-semibold tracking-tight text-foreground">
          {t('conversations.details.title')}
        </h3>
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

      {isLoading || !conversation ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DetailPanelLoading />
        </div>
      ) : (
        /* 2-Tab Ergonomics Navigation: Contact & POS */
        <Tabs defaultValue="contact" className="flex flex-1 flex-col overflow-hidden min-h-0 gap-0">
          <div className="px-2 pt-2.5 pb-2 border-b border-border/60 bg-muted/20 shrink-0">
            <TabsList className="grid w-full grid-cols-2 h-8 p-0.5">
              <TabsTrigger value="contact" className="text-[11px] gap-1.5 px-2 font-medium">
                <User className="size-3.5 shrink-0" />
                <span className="truncate">{t('conversations.details.tabContact')}</span>
              </TabsTrigger>
              <TabsTrigger value="pos" className="text-[11px] gap-1.5 px-2 font-medium">
                <ShoppingBag className="size-3.5 shrink-0" />
                <span className="truncate">{t('conversations.details.tabPos')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab 1: Khách hàng */}
          <TabsContent
            value="contact"
            className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
          >
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
          </TabsContent>

          {/* Tab 2: Đơn POS */}
          <TabsContent
            value="pos"
            className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
          >
            {resolvedWorkspaceId ? (
              <PosDetailTab
                workspaceId={resolvedWorkspaceId}
                conversationId={conversation.id}
                contactId={conversation.contactId}
                onOpenDrawer={onOpenPosDrawer || (() => {})}
              />
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Đang xác định không gian làm việc...
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
