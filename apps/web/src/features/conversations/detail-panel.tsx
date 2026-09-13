'use client';

import * as React from 'react';
import { User, ShoppingBag } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { PosDetailTab } from '@/features/pos';
import type {
  OrderResponseDto,
  PosDraftSuggestedEventPayload,
} from '@sales-copilot/shared-contracts';
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
  activeTab?: 'contact' | 'pos';
  onTabChange?: (tab: 'contact' | 'pos') => void;
  newOrderTrigger?: number;
  draftSuggestion?: PosDraftSuggestedEventPayload | null;
  onDismissSuggestion?: () => void;
  onClose?: () => void;
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
  activeTab,
  onTabChange,
  newOrderTrigger,
  draftSuggestion,
  onDismissSuggestion,
  onOpenPosDrawer,
}: DetailPanelProps) {
  const { t } = useI18n();
  const [internalTab, setInternalTab] = React.useState<'contact' | 'pos'>(activeTab || 'contact');

  React.useEffect(() => {
    if (activeTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (val: string) => {
    const nextTab = val as 'contact' | 'pos';
    setInternalTab(nextTab);
    onTabChange?.(nextTab);
  };

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
    <Tabs
      value={internalTab}
      onValueChange={handleTabChange}
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-card/40 border-l border-border/70 gap-0"
    >
      {/* Detail Header: Top Tabs [Khách hàng | Đơn POS] */}
      <div className="flex h-14 shrink-0 items-center border-b border-border/80 px-3 bg-background/95 backdrop-blur-xs">
        <TabsList className="grid w-full grid-cols-2 h-8 p-0.5">
          <TabsTrigger
            value="contact"
            className="text-[11px] gap-1.5 px-2 font-medium cursor-pointer"
          >
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{t('conversations.details.tabContact')}</span>
          </TabsTrigger>
          <TabsTrigger value="pos" className="text-[11px] gap-1.5 px-2 font-medium cursor-pointer">
            <ShoppingBag className="size-3.5 shrink-0" />
            <span className="truncate">{t('conversations.details.tabPos')}</span>
          </TabsTrigger>
        </TabsList>
      </div>

      {isLoading || !conversation ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DetailPanelLoading />
        </div>
      ) : (
        <>
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
                contactName={conversation.contact?.name}
                contactPhone={conversation.contact?.phoneNumber}
                draftSuggestion={draftSuggestion}
                onDismissSuggestion={onDismissSuggestion}
                newOrderTrigger={newOrderTrigger}
                onOpenDrawer={onOpenPosDrawer || (() => {})}
              />
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Đang xác định không gian làm việc...
              </div>
            )}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
