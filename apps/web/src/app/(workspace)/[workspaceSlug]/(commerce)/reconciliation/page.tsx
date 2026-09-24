import { ReconciliationView } from '@/features/commerce/reconciliation/reconciliation-view';

interface ReconciliationPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ReconciliationPage({ params }: ReconciliationPageProps) {
  const { workspaceSlug } = await params;

  return <ReconciliationView workspaceSlug={workspaceSlug} />;
}
