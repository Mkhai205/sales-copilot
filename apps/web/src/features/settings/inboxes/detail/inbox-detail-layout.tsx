'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Clock, Globe, Settings, Users } from 'lucide-react';
import type { InboxDetailDto } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { InboxAvatar } from '@/components/inbox-avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TabGeneralSettings } from './tab-general-settings';
import { TabCollaborators } from './tab-collaborators';
import { TabConfiguration } from './tab-configuration';
import { TabBusinessHours } from './tab-business-hours';
import { TabAiSettings } from './tab-ai-settings';

interface InboxDetailLayoutProps {
  inbox: InboxDetailDto;
  workspaceId: string;
  workspaceSlug: string;
  initialTab?: string;
}

const VALID_INBOX_TABS = [
  'general',
  'collaborators',
  'configuration',
  'business-hours',
  'ai-agent',
] as const;
type InboxTabKey = (typeof VALID_INBOX_TABS)[number];

function sanitizeTab(tab?: string): InboxTabKey {
  if (tab && VALID_INBOX_TABS.includes(tab as InboxTabKey)) {
    return tab as InboxTabKey;
  }
  return 'general';
}

export function InboxDetailLayout({
  inbox,
  workspaceId,
  workspaceSlug,
  initialTab = 'general',
}: InboxDetailLayoutProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<string>(sanitizeTab(initialTab));

  React.useEffect(() => {
    const valid = sanitizeTab(initialTab);
    if (valid !== activeTab) {
      setActiveTab(valid);
    }
  }, [initialTab]);

  const handleTabChange = (newTab: string) => {
    const valid = sanitizeTab(newTab);
    setActiveTab(valid);
    router.replace(`/${workspaceSlug}/settings/inboxes/${inbox.id}?tab=${valid}`, {
      scroll: false,
    });
  };

  const meta = getChannelMeta(inbox.channelType);
  const isConnected = inbox.channel?.isConnected ?? true;

  return (
    <div className="flex flex-col gap-4 w-full pb-12">
      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink
                  onClick={() => router.push(`/${workspaceSlug}/settings/inboxes`)}
                  className="cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Hộp thư & Kênh liên lạc
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-xs font-medium text-foreground">
                  {inbox.name}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <InboxAvatar
              avatarUrl={inbox.avatarUrl}
              channelType={inbox.channelType}
              name={inbox.name}
              size="lg"
              className="rounded-lg border shadow-xs shrink-0"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight text-foreground truncate">
                  {inbox.name}
                </h1>
                <Badge
                  variant="outline"
                  className="px-2 py-0.5 text-[11px] font-medium border-border/80 bg-muted/30"
                >
                  <img
                    src={meta.iconSrc}
                    alt={meta.label}
                    className="size-3 object-contain inline-block mr-1"
                  />
                  {meta.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="font-mono text-[11px] text-muted-foreground/80">
                  ID: {inbox.id.slice(0, 8)}
                </span>
                <span className="text-border">•</span>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Đang kết nối
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <span className="size-2 rounded-full bg-muted-foreground/50" />
                    Chưa kết nối
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Underline Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-4">
        <div className="border-b border-border">
          <TabsList
            variant="line"
            className="h-10 w-full justify-start gap-4 sm:gap-6 bg-transparent p-0 rounded-none overflow-x-auto"
          >
            <TabsTrigger
              value="general"
              className="gap-2 text-xs h-10 px-1 font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold"
            >
              <Settings className="size-3.5" />
              Cài đặt chung
            </TabsTrigger>
            <TabsTrigger
              value="collaborators"
              className="gap-2 text-xs h-10 px-1 font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold"
            >
              <Users className="size-3.5" />
              Đội ngũ & Phân bổ
            </TabsTrigger>
            <TabsTrigger
              value="configuration"
              className="gap-2 text-xs h-10 px-1 font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold"
            >
              <Globe className="size-3.5" />
              Cấu hình & Tích hợp
            </TabsTrigger>
            <TabsTrigger
              value="business-hours"
              className="gap-2 text-xs h-10 px-1 font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold"
            >
              <Clock className="size-3.5" />
              Giờ làm việc
            </TabsTrigger>
            <TabsTrigger
              value="ai-agent"
              className="gap-2 text-xs h-10 px-1 font-medium text-muted-foreground hover:text-foreground data-[state=active]:text-foreground data-[state=active]:font-semibold"
            >
              <Bot className="size-3.5" />
              AI Agent
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general">
          <TabGeneralSettings
            inbox={inbox}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
          />
        </TabsContent>

        <TabsContent value="collaborators">
          <TabCollaborators inbox={inbox} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="configuration">
          <TabConfiguration inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
        </TabsContent>

        <TabsContent value="business-hours">
          <TabBusinessHours inbox={inbox} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="ai-agent">
          <TabAiSettings inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
