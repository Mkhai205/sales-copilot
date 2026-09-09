'use client';

import * as React from 'react';
import { X, User, ShoppingBag, Sparkles, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaces } from '@/features/workspaces/use-workspaces';
import { PosDetailTab } from '@/features/pos';
import { SalesEvidenceTab } from '@/features/sales';
import {
  ReplyDraftCard,
  ActionCard,
  BattlecardCard,
  useCopilotSuggestions,
  useGenerateSuggestions,
} from '@/features/copilot';
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

function SalesAiTabContent({
  workspaceId,
  conversationId,
}: {
  workspaceId?: string;
  conversationId?: string;
}) {
  const { data: suggestions = [], isLoading } = useCopilotSuggestions({
    workspaceId: workspaceId || '',
    conversationId: conversationId || '',
    enabled: Boolean(workspaceId && conversationId),
  });

  const { mutate: generateSuggestions, isPending: isGenerating } = useGenerateSuggestions(
    workspaceId || '',
    conversationId || '',
  );

  const replyDrafts = suggestions.filter(s => s.suggestionType === 'REPLY_DRAFT');
  const actions = suggestions.filter(s => s.suggestionType === 'NEXT_BEST_ACTION');
  const battlecards = suggestions.filter(s => s.suggestionType === 'BATTLECARD');

  if (!workspaceId || !conversationId) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        Không có dữ liệu hội thoại cho Sales AI
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Gợi ý thông minh</span>
          {suggestions.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[9px] font-bold">
              {suggestions.length}
            </Badge>
          )}
        </div>
        <Button
          size="icon-xs"
          variant="outline"
          onClick={() => generateSuggestions({ force: true })}
          disabled={isGenerating || isLoading}
          className="size-6"
          title="Làm mới đề xuất"
        >
          <RefreshCw className={isGenerating ? 'size-3 animate-spin' : 'size-3'} />
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          Đang tải đề xuất từ Sales AI...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground rounded-lg border border-dashed border-border/80 bg-muted/20 p-4">
          <Sparkles className="size-7 stroke-[1.5] text-muted-foreground/40 mb-1.5" />
          <p className="text-xs font-medium text-foreground">Chưa có gợi ý nào</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[220px]">
            Copilot sẽ tự động phân tích tin nhắn và đề xuất bản thảo hoặc hành động tiếp theo.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {replyDrafts.map(suggestion => (
            <ReplyDraftCard
              key={suggestion.id}
              suggestion={suggestion}
              workspaceId={workspaceId}
              conversationId={conversationId}
            />
          ))}
          {actions.map(suggestion => (
            <ActionCard
              key={suggestion.id}
              suggestion={suggestion}
              workspaceId={workspaceId}
              conversationId={conversationId}
            />
          ))}
          {battlecards.map(suggestion => (
            <BattlecardCard
              key={suggestion.id}
              suggestion={suggestion}
              workspaceId={workspaceId}
              conversationId={conversationId}
            />
          ))}
        </div>
      )}
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
        /* 4-Tab Ergonomics Navigation: Contact, POS, Sales & BANT, AI */
        <Tabs defaultValue="contact" className="flex flex-1 flex-col overflow-hidden min-h-0 gap-0">
          <div className="px-2 pt-2.5 pb-2 border-b border-border/60 bg-muted/20 shrink-0">
            <TabsList className="grid w-full grid-cols-4 h-8 p-0.5">
              <TabsTrigger value="contact" className="text-[11px] gap-1 px-1">
                <User className="size-3 shrink-0" />
                <span className="truncate">{t('conversations.details.tabContact')}</span>
              </TabsTrigger>
              <TabsTrigger value="pos" className="text-[11px] gap-1 px-1">
                <ShoppingBag className="size-3 shrink-0" />
                <span className="truncate">{t('conversations.details.tabPos')}</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="text-[11px] gap-1 px-1">
                <TrendingUp className="size-3 shrink-0" />
                <span className="truncate">{t('conversations.details.tabSales')}</span>
              </TabsTrigger>
              <TabsTrigger value="ai" className="text-[11px] gap-1 px-1">
                <Sparkles className="size-3 shrink-0" />
                <span className="truncate">{t('conversations.details.tabAi')}</span>
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

          {/* Tab 3: Bán hàng & BANT (Sales Evidence & Lead Score) */}
          <TabsContent
            value="sales"
            className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
          >
            {resolvedWorkspaceId ? (
              <SalesEvidenceTab
                workspaceId={resolvedWorkspaceId}
                conversationId={conversation.id}
                contactId={conversation.contactId}
              />
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Đang xác định không gian làm việc...
              </div>
            )}
          </TabsContent>

          {/* Tab 4: Sales AI (Gợi ý thông minh) */}
          <TabsContent
            value="ai"
            className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
          >
            <SalesAiTabContent workspaceId={resolvedWorkspaceId} conversationId={conversation.id} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
