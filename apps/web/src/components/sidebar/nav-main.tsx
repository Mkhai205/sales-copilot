'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award,
  BarChart3,
  Boxes,
  ChevronRight,
  FileText,
  Inbox,
  LineChart,
  MessageSquare,
  Package,
  PieChart,
  QrCode,
  Settings,
  ShoppingBag,
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
import { useI18n } from '@/lib/i18n';

interface NavMainProps {
  workspaceSlug: string;
}

const DEFAULT_SETTINGS_SUB_ITEMS = [
  { title: 'General', segment: 'general', icon: Settings },
  { title: 'Inboxes', segment: 'inboxes', icon: Inbox },
  { title: 'Teams', segment: 'teams', icon: Users2 },
  { title: 'Members', segment: 'members', icon: UserCheck },
  { title: 'Labels', segment: 'labels', icon: Tag },
  { title: 'Canned Responses', segment: 'canned-responses', icon: FileText },
  { title: 'Automation Rules', segment: 'automation-rules', icon: Zap },
  { title: 'Webhooks', segment: 'webhooks', icon: Webhook },
];

export function NavMain({ workspaceSlug }: NavMainProps) {
  const pathname = usePathname();
  const { accessibleNavItems, isAdmin } = useSettingsRbac(workspaceSlug);
  const { t } = useI18n();

  // Active status helpers
  const isConversationsActive =
    pathname === `/${workspaceSlug}/conversations` ||
    pathname.startsWith(`/${workspaceSlug}/conversations/`);

  const isContactsActive =
    pathname === `/${workspaceSlug}/contacts` || pathname.startsWith(`/${workspaceSlug}/contacts/`);

  const isConversationsGroupActive = isConversationsActive || isContactsActive;

  const isOrdersActive = pathname.startsWith(`/${workspaceSlug}/orders`);
  const isProductsActive = pathname.startsWith(`/${workspaceSlug}/products`);
  const isInventoryActive = pathname.startsWith(`/${workspaceSlug}/inventory`);
  const isReconciliationActive = pathname.startsWith(`/${workspaceSlug}/reconciliation`);

  const isPosGroupActive =
    isOrdersActive || isProductsActive || isInventoryActive || isReconciliationActive;

  const isAnalyticsOverviewActive =
    pathname === `/${workspaceSlug}/analytics` ||
    pathname.startsWith(`/${workspaceSlug}/analytics/overview`);
  const isAnalyticsAgentsActive = pathname.startsWith(`/${workspaceSlug}/analytics/agents`);
  const isAnalyticsChannelsActive = pathname.startsWith(`/${workspaceSlug}/analytics/channels`);

  const isAnalyticsGroupActive = pathname.startsWith(`/${workspaceSlug}/analytics`);

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
        {/* 1. HỘI THOẠI GROUP */}
        <Collapsible asChild defaultOpen={isConversationsGroupActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                isActive={isConversationsGroupActive}
                tooltip={t('nav.conversationsGroup')}
              >
                <MessageSquare className="size-4" />
                <span>{t('nav.conversationsGroup')}</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isConversationsActive}>
                    <Link href={`/${workspaceSlug}/conversations`}>
                      <Inbox className="size-3.5" />
                      <span>{t('nav.inbox')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isContactsActive}>
                    <Link href={`/${workspaceSlug}/contacts`}>
                      <Users className="size-3.5" />
                      <span>{t('nav.contacts')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        {/* 2. BÁN HÀNG & POS GROUP */}
        <Collapsible asChild defaultOpen={isPosGroupActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isPosGroupActive} tooltip={t('nav.posGroup')}>
                <ShoppingBag className="size-4" />
                <span>{t('nav.posGroup')}</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isOrdersActive}>
                    <Link href={`/${workspaceSlug}/orders`}>
                      <Package className="size-3.5" />
                      <span>{t('nav.orders')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isProductsActive}>
                    <Link href={`/${workspaceSlug}/products`}>
                      <Tag className="size-3.5" />
                      <span>{t('nav.products')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isInventoryActive}>
                    <Link href={`/${workspaceSlug}/inventory`}>
                      <Boxes className="size-3.5" />
                      <span>{t('nav.inventory')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isReconciliationActive}>
                    <Link href={`/${workspaceSlug}/reconciliation`}>
                      <QrCode className="size-3.5" />
                      <span>{t('nav.reconciliation')}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        {/* 3. PHÂN TÍCH & BÁO CÁO GROUP (Admin / Owner Only) */}
        {isAdmin && (
          <Collapsible asChild defaultOpen={isAnalyticsGroupActive} className="group/collapsible">
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  isActive={isAnalyticsGroupActive}
                  tooltip={t('nav.analyticsGroup')}
                >
                  <BarChart3 className="size-4" />
                  <span>{t('nav.analyticsGroup')}</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsOverviewActive}>
                      <Link href={`/${workspaceSlug}/analytics/overview`}>
                        <LineChart className="size-3.5" />
                        <span>{t('nav.analyticsOverview')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsAgentsActive}>
                      <Link href={`/${workspaceSlug}/analytics/agents`}>
                        <Award className="size-3.5" />
                        <span>{t('nav.analyticsAgents')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsChannelsActive}>
                      <Link href={`/${workspaceSlug}/analytics/channels`}>
                        <PieChart className="size-3.5" />
                        <span>{t('nav.analyticsChannels')}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {/* 4. CÀI ĐẶT GROUP */}
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
