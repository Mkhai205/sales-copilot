'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight,
  FileText,
  Inbox,
  MessageSquare,
  Settings,
  Tag,
  UserCheck,
  Users,
  Users2,
  Webhook,
  Zap,
} from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';

interface NavMainProps {
  workspaceSlug: string;
}

export function NavMain({ workspaceSlug }: NavMainProps) {
  const pathname = usePathname();

  const isConversationsActive =
    pathname === `/${workspaceSlug}/conversations` ||
    pathname.startsWith(`/${workspaceSlug}/conversations/`);

  const isContactsActive =
    pathname === `/${workspaceSlug}/contacts` || pathname.startsWith(`/${workspaceSlug}/contacts/`);

  const isSettingsActive = pathname.startsWith(`/${workspaceSlug}/settings`);

  const settingsSubItems = [
    {
      title: 'General',
      url: `/${workspaceSlug}/settings`,
      icon: Settings,
      exact: true,
    },
    {
      title: 'Inboxes',
      url: `/${workspaceSlug}/settings/inboxes`,
      icon: Inbox,
    },
    {
      title: 'Teams',
      url: `/${workspaceSlug}/settings/teams`,
      icon: Users2,
    },
    {
      title: 'Members',
      url: `/${workspaceSlug}/settings/members`,
      icon: UserCheck,
    },
    {
      title: 'Labels',
      url: `/${workspaceSlug}/settings/labels`,
      icon: Tag,
    },
    {
      title: 'Canned Responses',
      url: `/${workspaceSlug}/settings/canned-responses`,
      icon: FileText,
    },
    {
      title: 'Automation Rules',
      url: `/${workspaceSlug}/settings/automation-rules`,
      icon: Zap,
    },
    {
      title: 'Webhooks',
      url: `/${workspaceSlug}/settings/webhooks`,
      icon: Webhook,
    },
  ];

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>
      <SidebarMenu>
        {/* Conversations */}
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isConversationsActive} tooltip="Conversations">
            <Link href={`/${workspaceSlug}/conversations`}>
              <MessageSquare className="size-4" />
              <span>Conversations</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Contacts */}
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isContactsActive} tooltip="Contacts">
            <Link href={`/${workspaceSlug}/contacts`}>
              <Users className="size-4" />
              <span>Contacts</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Settings Collapsible Group */}
        <Collapsible asChild defaultOpen={isSettingsActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isSettingsActive} tooltip="Settings">
                <Settings className="size-4" />
                <span>Settings</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {settingsSubItems.map(subItem => {
                  const isSubActive = subItem.exact
                    ? pathname === subItem.url
                    : pathname.startsWith(subItem.url);

                  return (
                    <SidebarMenuSubItem key={subItem.title}>
                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                        <Link href={subItem.url}>
                          <subItem.icon className="size-3.5" />
                          <span>{subItem.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroup>
  );
}
