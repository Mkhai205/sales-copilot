import { NewInboxWizardView } from '@/features/settings/inboxes/new-inbox-wizard-view';

export default async function NewInboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <NewInboxWizardView workspaceSlug={workspaceSlug} />;
}
