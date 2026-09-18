'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Boxes, Package, QrCode, ShoppingBag, Tag } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
} from '@/components/ui/sidebar';

interface CommerceSidebarProps extends React.ComponentProps<typeof Sidebar> {
  workspaceSlug: string;
}

export function CommerceSidebar({ workspaceSlug, ...props }: CommerceSidebarProps) {
  const pathname = usePathname();

  const isOrdersActive = pathname.startsWith(`/${workspaceSlug}/orders`);
  const isProductsActive = pathname.startsWith(`/${workspaceSlug}/products`);
  const isInventoryActive = pathname.startsWith(`/${workspaceSlug}/inventory`);
  const isReconciliationActive = pathname.startsWith(`/${workspaceSlug}/reconciliation`);

  return (
    <Sidebar collapsible="icon" className="border-r border-border/80" {...props}>
      <SidebarHeader className="flex h-12 flex-row items-center justify-between border-b border-sidebar-border/40 px-3">
        <div className="flex items-center gap-2 font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          <ShoppingBag className="size-4 text-primary" />
          <span className="text-xs font-semibold">Bán hàng</span>
        </div>
        <SidebarTrigger className="size-7" />
      </SidebarHeader>

      <SidebarContent>
        {/* Nhóm Bán hàng & Đơn */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Bán hàng & Đơn
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isOrdersActive} tooltip="Đơn hàng">
                  <Link href={`/${workspaceSlug}/orders`}>
                    <Package className="size-4" />
                    <span>Đơn hàng</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Nhóm Hàng hóa */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Hàng hóa & Kho
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isProductsActive} tooltip="Sản phẩm">
                  <Link href={`/${workspaceSlug}/products`}>
                    <Tag className="size-4" />
                    <span>Sản phẩm</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isInventoryActive} tooltip="Tồn kho">
                  <Link href={`/${workspaceSlug}/inventory`}>
                    <Boxes className="size-4" />
                    <span>Tồn kho</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Nhóm Tài chính */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Tài chính & Thanh toán
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isReconciliationActive}
                  tooltip="Đối soát VietQR"
                >
                  <Link href={`/${workspaceSlug}/reconciliation`}>
                    <QrCode className="size-4" />
                    <span>Đối soát VietQR</span>
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
