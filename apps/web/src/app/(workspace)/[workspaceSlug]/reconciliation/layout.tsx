import * as React from 'react';
import { CommerceModuleLayout } from '@/features/commerce';

interface ReconciliationLayoutProps {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ReconciliationLayout({
  children,
  params,
}: ReconciliationLayoutProps) {
  const { workspaceSlug } = await params;
  return <CommerceModuleLayout workspaceSlug={workspaceSlug}>{children}</CommerceModuleLayout>;
}
