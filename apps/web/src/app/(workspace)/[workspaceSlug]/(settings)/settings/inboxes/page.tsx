import { InboxesSettingsView } from '@/features/settings';

export default async function InboxesSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <InboxesSettingsView workspaceSlug={workspaceSlug} />;
}
