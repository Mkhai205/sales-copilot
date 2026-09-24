import { ProductsView } from '@/features/commerce/products/products-view';

interface ProductsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { workspaceSlug } = await params;

  return <ProductsView workspaceSlug={workspaceSlug} />;
}
