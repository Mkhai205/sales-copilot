import { InventoryView } from '@/features/commerce';

interface InventoryPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function InventoryPage({ params }: InventoryPageProps) {
  const { workspaceSlug } = await params;

  return <InventoryView workspaceSlug={workspaceSlug} />;
}
