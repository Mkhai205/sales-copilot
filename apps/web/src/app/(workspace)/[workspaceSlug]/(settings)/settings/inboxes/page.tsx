import { InboxesSettingsView } from '@/features/settings/inboxes/inboxes-settings-view';

export default async function InboxesSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <InboxesSettingsView workspaceSlug={workspaceSlug} />;
}
