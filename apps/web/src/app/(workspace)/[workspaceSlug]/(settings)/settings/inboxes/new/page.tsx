import { NewInboxWizardView } from '@/features/settings';

export default async function NewInboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <NewInboxWizardView workspaceSlug={workspaceSlug} />;
}
