import * as React from 'react';
import { CommerceModuleLayout } from '@/features/commerce';

interface InventoryLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function InventoryLayout({ children, params }: InventoryLayoutProps) {
  const { workspaceSlug } = await params;
  return <CommerceModuleLayout workspaceSlug={workspaceSlug}>{children}</CommerceModuleLayout>;
}
