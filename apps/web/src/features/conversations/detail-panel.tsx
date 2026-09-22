'use client';

import * as React from 'react';
import { User, ShoppingBag, Bot } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaces, useInbox } from '@/features/settings';
import { CommerceDetailTab } from '@/features/commerce';

import type { OrderResponseDto } from '@sales-copilot/shared-contracts';
import { useConversation } from './hooks/use-conversation';
import { useMessages } from './hooks/use-messages';
import { ContactInfo, ContactIdentities } from './contacts';
import { ConversationActions } from './conversation-actions';
import { LabelManager } from './label-manager';

interface DetailPanelProps {
  conversationId?: string;
  workspaceSlug?: string;
  workspaceId?: string;
  activeTab?: 'contact' | 'commerce';
  onTabChange?: (tab: 'contact' | 'commerce') => void;
  newOrderTrigger?: number;
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

function formatAiCost(usd: number): string {
  if (usd <= 0) return '$0.00';
  if (usd < 0.001) return '< $0.001';
  return `$${usd.toFixed(4)}`;
}

function formatTokenCount(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function DetailPanel({
  conversationId,
  workspaceSlug,
  workspaceId,
  activeTab,
  onTabChange,
  newOrderTrigger,
  onOpenPosDrawer,
}: DetailPanelProps) {
  const [internalTab, setInternalTab] = React.useState<'contact' | 'commerce'>(
    activeTab || 'contact',
  );

  React.useEffect(() => {
    if (activeTab) {
      setInternalTab(activeTab);
    }
  }, [activeTab]);

  const handleTabChange = (val: string) => {
    const nextTab = val as 'contact' | 'commerce';
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

  const { data: inbox } = useInbox(
    resolvedWorkspaceId,
    (conversation?.inbox as any)?.settings ? undefined : conversation?.inboxId,
  );
  const inboxSettings = (conversation?.inbox as any)?.settings || inbox?.settings;
  const isAiConfigured =
    Boolean(inboxSettings?.aiCommercePolicy?.enabled) || Boolean(conversation?.isAiPaused);

  const { messages } = useMessages(conversationId || '', {
    workspaceSlug,
    workspaceId: resolvedWorkspaceId,
    limit: 50,
    enabled: Boolean(conversationId && isAiConfigured),
  });

  const aiMessagesCount = React.useMemo(() => {
    if (!messages) return 0;
    return messages.filter(m => {
      if (!m.metadata) return false;
      if (typeof m.metadata === 'object') {
        return (m.metadata as any).isAiGenerated === true;
      }
      if (typeof m.metadata === 'string') {
        try {
          return JSON.parse(m.metadata)?.isAiGenerated === true;
        } catch {
          return false;
        }
      }
      return false;
    }).length;
  }, [messages]);

  const fallbackAiMetrics = React.useMemo(() => {
    if (!messages) return null;
    let cost = 0;
    let tokens = 0;
    let inTokens = 0;
    let outTokens = 0;
    let count = 0;

    for (const m of messages) {
      const meta =
        typeof m.metadata === 'string'
          ? (() => {
              try {
                return JSON.parse(m.metadata);
              } catch {
                return {};
              }
            })()
          : (m.metadata as any) || {};

      if (meta?.isAiGenerated) {
        count++;
        if (meta.aiDebug?.estimatedCostUsd) {
          cost += meta.aiDebug.estimatedCostUsd;
        }
        if (meta.aiDebug?.usage) {
          inTokens += meta.aiDebug.usage.input || 0;
          outTokens += meta.aiDebug.usage.output || 0;
          tokens += meta.aiDebug.usage.total || 0;
        } else if (meta.aiTokenUsage) {
          const pTokens = meta.aiTokenUsage.promptTokens || 0;
          const cTokens = meta.aiTokenUsage.completionTokens || 0;
          inTokens += pTokens;
          outTokens += cTokens;
          tokens += meta.aiTokenUsage.totalTokens || pTokens + cTokens;
          cost += (pTokens * 0.15 + cTokens * 0.6) / 1_000_000;
        }
      }
    }
    return { cost, tokens, inTokens, outTokens, count };
  }, [messages]);

  const resolvedAiMetrics = React.useMemo(() => {
    const raw = (conversation?.customAttributes as any)?.aiUsage;
    if (raw && typeof raw.totalCostUsd === 'number') {
      return {
        cost: raw.totalCostUsd,
        tokens: raw.totalTokens || 0,
        inTokens: raw.inputTokens || 0,
        outTokens: raw.outputTokens || 0,
        count: raw.aiMessagesCount || aiMessagesCount,
      };
    }
    return fallbackAiMetrics;
  }, [conversation?.customAttributes, fallbackAiMetrics, aiMessagesCount]);

  return (
    <Tabs
      value={internalTab}
      onValueChange={handleTabChange}
      className="flex h-full w-full min-h-0 flex-1 flex-col overflow-hidden bg-card/40 border-l border-border/70 gap-0"
    >
      {/* Detail Header: Top Tabs [Khách hàng | Đơn hàng] */}
      <div className="flex h-14 shrink-0 items-center border-b border-border/80 px-3 bg-background/95 backdrop-blur-xs">
        <TabsList className="grid w-full grid-cols-2 h-8 p-0.5">
          <TabsTrigger
            value="contact"
            className="text-[11px] gap-1.5 px-2 font-medium cursor-pointer"
          >
            <User className="size-3.5 shrink-0" />
            <span className="truncate">{'Khách hàng'}</span>
          </TabsTrigger>
          <TabsTrigger
            value="commerce"
            className="text-[11px] gap-1.5 px-2 font-medium cursor-pointer"
          >
            <ShoppingBag className="size-3.5 shrink-0" />
            <span className="truncate">Đơn hàng</span>
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

            {/* AI Activity Card */}
            {(isAiConfigured ||
              aiMessagesCount > 0 ||
              (resolvedAiMetrics && resolvedAiMetrics.count > 0)) && (
              <>
                <Separator className="bg-border/60" />
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Bot className="size-3.5 text-primary" />
                      <span>{'Hoạt động AI'}</span>
                    </div>
                    {conversation.isAiPaused ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-amber-500 border-amber-500/30 bg-amber-500/10 py-0 px-1.5 font-normal"
                      >
                        {'Đã tiếp quản bởi nhân viên'}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10 py-0 px-1.5 font-normal"
                      >
                        {'Đang hoạt động'}
                      </Badge>
                    )}
                  </div>

                  {/* Observability Metrics: Cost & Tokens */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border/60">
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">
                        {'Chi phí ước tính'}
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {resolvedAiMetrics ? formatAiCost(resolvedAiMetrics.cost) : '$0.00'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">
                        {'Token tiêu thụ'}
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {resolvedAiMetrics ? formatTokenCount(resolvedAiMetrics.tokens) : '0'}
                        {resolvedAiMetrics && resolvedAiMetrics.tokens > 0 && (
                          <span className="text-[10px] font-normal text-muted-foreground ml-1">
                            ({formatTokenCount(resolvedAiMetrics.inTokens)} in /{' '}
                            {formatTokenCount(resolvedAiMetrics.outTokens)} out)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/40">
                    <span>{`AI xử lý: ${resolvedAiMetrics?.count ?? aiMessagesCount} tin nhắn`}</span>
                  </div>
                </div>
              </>
            )}

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

          {/* Tab 2: Đơn hàng */}
          <TabsContent
            value="commerce"
            className="min-h-0 flex-1 overflow-y-auto p-4 flex flex-col gap-4 m-0"
          >
            {resolvedWorkspaceId ? (
              <CommerceDetailTab
                workspaceId={resolvedWorkspaceId}
                conversationId={conversation.id}
                contactId={conversation.contactId}
                contactName={conversation.contact?.name}
                contactPhone={conversation.contact?.phoneNumber}
                newOrderTrigger={newOrderTrigger}
                onOpenDrawer={onOpenPosDrawer || (() => {})}
              />
            ) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {'Đang xác định không gian làm việc...'}
              </div>
            )}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
