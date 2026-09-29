import { InventoryView } from '@/features/commerce/inventory/inventory-view';

interface InventoryPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function InventoryPage({ params }: InventoryPageProps) {
  const { workspaceSlug } = await params;

  return <InventoryView />;
}
