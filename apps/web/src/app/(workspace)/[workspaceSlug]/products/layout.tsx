import * as React from 'react';
import { CommerceModuleLayout } from '@/features/commerce';

interface ProductsLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ProductsLayout({ children, params }: ProductsLayoutProps) {
  const { workspaceSlug } = await params;
  return <CommerceModuleLayout workspaceSlug={workspaceSlug}>{children}</CommerceModuleLayout>;
}
