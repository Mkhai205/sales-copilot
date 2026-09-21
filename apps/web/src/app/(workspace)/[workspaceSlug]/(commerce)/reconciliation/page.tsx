import { ReconciliationView } from '@/features/commerce';

interface ReconciliationPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ReconciliationPage({ params }: ReconciliationPageProps) {
  const { workspaceSlug } = await params;

  return <ReconciliationView workspaceSlug={workspaceSlug} />;
}
