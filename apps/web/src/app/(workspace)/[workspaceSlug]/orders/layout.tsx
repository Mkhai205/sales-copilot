import * as React from 'react';
import { CommerceModuleLayout } from '@/features/commerce';

interface OrdersLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function OrdersLayout({ children, params }: OrdersLayoutProps) {
  const { workspaceSlug } = await params;
  return <CommerceModuleLayout workspaceSlug={workspaceSlug}>{children}</CommerceModuleLayout>;
}
