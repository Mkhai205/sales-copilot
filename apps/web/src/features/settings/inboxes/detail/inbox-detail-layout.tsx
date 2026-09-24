'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Bot, Clock, Globe, Settings, Users } from 'lucide-react';
import type { InboxDetailDto } from '@sales-copilot/shared-contracts';
import { getChannelMeta } from '@/lib/channels';
import { InboxAvatar } from '@/components/inbox-avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex flex-col gap-6 w-full pb-12">
      {/* Top Header & Navigation */}
      <div className="flex flex-col gap-4 border-b border-border pb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/${workspaceSlug}/settings/inboxes`)}
          className="w-fit -ml-2 h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" data-icon="inline-start" />
          Quay lại danh sách Hộp thư
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <InboxAvatar
              avatarUrl={inbox.avatarUrl}
              channelType={inbox.channelType}
              name={inbox.name}
              size="lg"
            />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg font-semibold tracking-tight text-foreground truncate">
                  {inbox.name}
                </h1>
                <Badge
                  variant="outline"
                  className="px-2 py-0.5 text-[11px] font-medium border-border/70"
                >
                  {meta.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span className="font-mono text-[11px]">ID: {inbox.id.slice(0, 8)}</span>
                <span>•</span>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-emerald-500">
                    <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
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

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="px-2.5 py-1 text-xs font-normal">
              {inbox.memberCount ?? 0} nhân sự phụ trách
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col gap-6">
        <TabsList className="w-full justify-start overflow-x-auto h-auto p-1 bg-muted/50 border border-border rounded-lg">
          <TabsTrigger value="general" className="gap-2 text-xs py-2 px-3">
            <Settings className="size-3.5" />
            Cài đặt chung
          </TabsTrigger>
          <TabsTrigger value="collaborators" className="gap-2 text-xs py-2 px-3">
            <Users className="size-3.5" />
            Đội ngũ & Phân bổ
          </TabsTrigger>
          <TabsTrigger value="configuration" className="gap-2 text-xs py-2 px-3">
            <Globe className="size-3.5" />
            Cấu hình & Tích hợp
          </TabsTrigger>
          <TabsTrigger value="business-hours" className="gap-2 text-xs py-2 px-3">
            <Clock className="size-3.5" />
            Giờ làm việc
          </TabsTrigger>
          <TabsTrigger value="ai-agent" className="gap-2 text-xs py-2 px-3">
            <Bot className="size-3.5" />
            AI Agent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <TabGeneralSettings
            inbox={inbox}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
          />
        </TabsContent>

        <TabsContent value="collaborators" className="mt-0">
          <TabCollaborators inbox={inbox} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="configuration" className="mt-0">
          <TabConfiguration inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
        </TabsContent>

        <TabsContent value="business-hours" className="mt-0">
          <TabBusinessHours inbox={inbox} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="ai-agent" className="mt-0">
          <TabAiSettings inbox={inbox} workspaceId={workspaceId} workspaceSlug={workspaceSlug} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
