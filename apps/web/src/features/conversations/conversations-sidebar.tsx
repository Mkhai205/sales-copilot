'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Inbox, MessageSquare, User, Users, UserX } from 'lucide-react';
import Image from 'next/image';
import { getChannelMeta } from '@/lib/channels';

function InboxChannelIcon({
  avatarUrl,
  channelType,
  name,
}: {
  avatarUrl?: string | null;
  channelType?: string | null;
  name: string;
}) {
  const meta = getChannelMeta(channelType);
  const [error, setError] = React.useState(false);

  const src = !error && avatarUrl?.trim() ? avatarUrl.trim() : meta.iconSrc;

  return (
    <div className="relative flex size-4 shrink-0 items-center justify-center overflow-hidden rounded-xs">
      <Image
        src={src}
        alt={name}
        width={16}
        height={16}
        unoptimized
        onError={() => setError(true)}
        className="size-full object-contain rounded-xs"
      />
    </div>
  );
}

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { useInboxes } from '@/features/omnichannel';
import { useWorkspaces } from '@/features/identity';
import { useConversationCounts } from './hooks/use-conversation-counts';
import { useConversationFilters } from './hooks/use-conversation-filters';
import { ConversationStatus } from '@sales-copilot/shared-contracts';

interface ConversationsSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceSlug: string;
}

export function ConversationsSidebar({ workspaceSlug, ...props }: ConversationsSidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { filters } = useConversationFilters();

  const { data: workspaces } = useWorkspaces();
  const currentWorkspace = workspaces?.find(w => w.slug === workspaceSlug);
  const workspaceId = currentWorkspace?.id;

  const { data: inboxes } = useInboxes(workspaceId);

  const effectiveStatus =
    filters.status !== 'ALL' ? (filters.status as ConversationStatus) : undefined;
  const { counts } = useConversationCounts({
    workspaceSlug,
    status: effectiveStatus,
  });

  const isConversationsPage = pathname.startsWith(`/${workspaceSlug}/conversations`);
  const isContactsPage = pathname.startsWith(`/${workspaceSlug}/contacts`);

  const currentAssignment = searchParams.get('assignment') || 'mine';
  const currentInboxId = searchParams.get('inboxId');

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80" {...props}>
      <SidebarHeader className="flex h-12 flex-row items-center justify-between border-b border-sidebar-border/40 px-3">
        <div className="flex items-center gap-2 font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          <MessageSquare className="size-4 text-primary" />
          <span className="text-xs font-semibold">Hội thoại</span>
        </div>
        <SidebarTrigger className="size-7" />
      </SidebarHeader>

      <SidebarContent>
        {/* Nhóm Hộp thư đến */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Hộp thư đến
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isConversationsPage && currentAssignment === 'mine' && !currentInboxId}
                  tooltip="Của tôi"
                >
                  <Link href={`/${workspaceSlug}/conversations?assignment=mine`}>
                    <User className="size-4" />
                    <span>Của tôi</span>
                  </Link>
                </SidebarMenuButton>
                {counts?.mine !== undefined && counts.mine > 0 && (
                  <SidebarMenuBadge>{counts.mine}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={
                    isConversationsPage && currentAssignment === 'unassigned' && !currentInboxId
                  }
                  tooltip="Chưa phân công"
                >
                  <Link href={`/${workspaceSlug}/conversations?assignment=unassigned`}>
                    <UserX className="size-4" />
                    <span>Chưa phân công</span>
                  </Link>
                </SidebarMenuButton>
                {counts?.unassigned !== undefined && counts.unassigned > 0 && (
                  <SidebarMenuBadge>{counts.unassigned}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isConversationsPage && currentAssignment === 'all' && !currentInboxId}
                  tooltip="Tất cả hội thoại"
                >
                  <Link href={`/${workspaceSlug}/conversations?assignment=all`}>
                    <Inbox className="size-4" />
                    <span>Tất cả hội thoại</span>
                  </Link>
                </SidebarMenuButton>
                {counts?.all !== undefined && counts.all > 0 && (
                  <SidebarMenuBadge>{counts.all}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Nhóm Kênh kết nối */}
        {inboxes && inboxes.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
              Kênh kết nối
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {inboxes.map(inbox => {
                  const isInboxActive = isConversationsPage && currentInboxId === inbox.id;
                  return (
                    <SidebarMenuItem key={inbox.id}>
                      <SidebarMenuButton asChild isActive={isInboxActive} tooltip={inbox.name}>
                        <Link href={`/${workspaceSlug}/conversations?inboxId=${inbox.id}`}>
                          <InboxChannelIcon
                            avatarUrl={inbox.avatarUrl}
                            channelType={inbox.channelType}
                            name={inbox.name}
                          />
                          <span className="truncate">{inbox.name}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Nhóm Khách hàng */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Khách hàng
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isContactsPage} tooltip="Danh bạ & Khách hàng">
                  <Link href={`/${workspaceSlug}/contacts`}>
                    <Users className="size-4" />
                    <span>Danh bạ</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
