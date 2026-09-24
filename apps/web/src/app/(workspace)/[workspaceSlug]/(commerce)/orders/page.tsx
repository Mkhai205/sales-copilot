import { OrdersView } from '@/features/commerce/orders/orders-view';

interface OrdersPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function OrdersPage({ params }: OrdersPageProps) {
  const { workspaceSlug } = await params;

  return <OrdersView workspaceSlug={workspaceSlug} />;
}
