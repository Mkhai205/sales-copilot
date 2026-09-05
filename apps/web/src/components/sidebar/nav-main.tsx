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
import { useSettingsRbac } from '@/features/settings';
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

const DEFAULT_SETTINGS_SUB_ITEMS = [
  {
    title: 'General',
    segment: 'general',
    icon: Settings,
  },
  {
    title: 'Inboxes',
    segment: 'inboxes',
    icon: Inbox,
  },
  {
    title: 'Teams',
    segment: 'teams',
    icon: Users2,
  },
  {
    title: 'Members',
    segment: 'members',
    icon: UserCheck,
  },
  {
    title: 'Labels',
    segment: 'labels',
    icon: Tag,
  },
  {
    title: 'Canned Responses',
    segment: 'canned-responses',
    icon: FileText,
  },
  {
    title: 'Automation Rules',
    segment: 'automation-rules',
    icon: Zap,
  },
  {
    title: 'Webhooks',
    segment: 'webhooks',
    icon: Webhook,
  },
];

import { useI18n } from '@/lib/i18n';

export function NavMain({ workspaceSlug }: NavMainProps) {
  const pathname = usePathname();
  const { accessibleNavItems } = useSettingsRbac(workspaceSlug);
  const { t } = useI18n();

  const isConversationsActive =
    pathname === `/${workspaceSlug}/conversations` ||
    pathname.startsWith(`/${workspaceSlug}/conversations/`);

  const isContactsActive =
    pathname === `/${workspaceSlug}/contacts` || pathname.startsWith(`/${workspaceSlug}/contacts/`);

  const isSettingsActive = pathname.startsWith(`/${workspaceSlug}/settings`);

  const getSubItemTitle = React.useCallback(
    (segment: string, fallback: string) => {
      switch (segment) {
        case 'general':
          return t('settings.nav.general');
        case 'inboxes':
          return t('settings.nav.inboxes');
        case 'teams':
          return t('settings.nav.teams');
        case 'members':
          return t('settings.nav.members');
        case 'labels':
          return t('settings.nav.labels');
        case 'canned-responses':
          return t('settings.nav.cannedResponses');
        case 'automation-rules':
          return t('settings.nav.automationRules');
        case 'webhooks':
          return t('settings.nav.webhooks');
        case 'audit-logs':
          return t('settings.nav.auditLogs');
        default:
          return fallback;
      }
    },
    [t],
  );

  const displaySettingsItems = React.useMemo(() => {
    const rawItems =
      accessibleNavItems && accessibleNavItems.length > 0
        ? accessibleNavItems
        : DEFAULT_SETTINGS_SUB_ITEMS;

    return rawItems.map(item => ({
      title: getSubItemTitle(item.segment, item.title),
      url: `/${workspaceSlug}/settings/${item.segment}`,
      icon: item.icon,
    }));
  }, [accessibleNavItems, getSubItemTitle, workspaceSlug]);

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{t('nav.platform')}</SidebarGroupLabel>
      <SidebarMenu>
        {/* Conversations */}
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            isActive={isConversationsActive}
            tooltip={t('nav.conversations')}
          >
            <Link href={`/${workspaceSlug}/conversations`}>
              <MessageSquare className="size-4" />
              <span>{t('nav.conversations')}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Contacts */}
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isContactsActive} tooltip={t('nav.contacts')}>
            <Link href={`/${workspaceSlug}/contacts`}>
              <Users className="size-4" />
              <span>{t('nav.contacts')}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {/* Settings Collapsible Group */}
        <Collapsible asChild defaultOpen={isSettingsActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isSettingsActive} tooltip={t('nav.settings')}>
                <Settings className="size-4" />
                <span>{t('nav.settings')}</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {displaySettingsItems.map(subItem => {
                  const isSubActive =
                    pathname === subItem.url || pathname.startsWith(`${subItem.url}/`);

                  return (
                    <SidebarMenuSubItem key={subItem.url}>
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
