'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Award,
  BarChart3,
  Boxes,
  ChevronRight,
  Inbox,
  LineChart,
  MessageSquare,
  Package,
  PieChart,
  QrCode,
  Settings,
  ShoppingBag,
  Tag,
  Users,
} from 'lucide-react';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSettingsRbac } from '@/features/identity';
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
  const { isAdmin } = useSettingsRbac(workspaceSlug);

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

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{'Nền tảng'}</SidebarGroupLabel>
      <SidebarMenu>
        {/* 1. HỘI THOẠI GROUP */}
        <Collapsible asChild defaultOpen={isConversationsGroupActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isConversationsGroupActive} tooltip={'Hội thoại'}>
                <MessageSquare className="size-4" />
                <span>{'Hội thoại'}</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isConversationsActive}>
                    <Link href={`/${workspaceSlug}/conversations`}>
                      <Inbox className="size-3.5" />
                      <span>{'Hộp thư đến'}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isContactsActive}>
                    <Link href={`/${workspaceSlug}/contacts`}>
                      <Users className="size-3.5" />
                      <span>{'Danh bạ'}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        {/* 2. BÁN HÀNG & Commerce GROUP */}
        <Collapsible asChild defaultOpen={isPosGroupActive} className="group/collapsible">
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton isActive={isPosGroupActive} tooltip={'Quản lý bán hàng'}>
                <ShoppingBag className="size-4" />
                <span>{'Quản lý bán hàng'}</span>
                <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isOrdersActive}>
                    <Link href={`/${workspaceSlug}/orders`}>
                      <Package className="size-3.5" />
                      <span>{'Đơn hàng'}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isProductsActive}>
                    <Link href={`/${workspaceSlug}/products`}>
                      <Tag className="size-3.5" />
                      <span>{'Sản phẩm'}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isInventoryActive}>
                    <Link href={`/${workspaceSlug}/inventory`}>
                      <Boxes className="size-3.5" />
                      <span>{'Tồn kho'}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={isReconciliationActive}>
                    <Link href={`/${workspaceSlug}/reconciliation`}>
                      <QrCode className="size-3.5" />
                      <span>{'Đối soát VietQR'}</span>
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
                  tooltip={'Phân tích & Báo cáo'}
                >
                  <BarChart3 className="size-4" />
                  <span>{'Phân tích & Báo cáo'}</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsOverviewActive}>
                      <Link href={`/${workspaceSlug}/analytics/overview`}>
                        <LineChart className="size-3.5" />
                        <span>{'Tổng quan doanh thu'}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsAgentsActive}>
                      <Link href={`/${workspaceSlug}/analytics/agents`}>
                        <Award className="size-3.5" />
                        <span>{'Hiệu suất nhân viên'}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={isAnalyticsChannelsActive}>
                      <Link href={`/${workspaceSlug}/analytics/channels`}>
                        <PieChart className="size-3.5" />
                        <span>{'Báo cáo theo kênh'}</span>
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {/* 4. CÀI ĐẶT GROUP */}
        <SidebarMenuItem>
          <SidebarMenuButton asChild isActive={isSettingsActive} tooltip={'Cài đặt'}>
            <Link href={`/${workspaceSlug}/settings/general`}>
              <Settings className="size-4" />
              <span>{'Cài đặt'}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
