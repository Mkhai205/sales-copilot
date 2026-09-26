import { NewInboxView } from '@/features/settings/inboxes/new/new-inbox-view';

export default async function NewInboxPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <NewInboxView workspaceSlug={workspaceSlug} />;
}
