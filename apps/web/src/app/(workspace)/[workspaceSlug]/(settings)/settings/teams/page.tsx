import { TeamsSettingsView } from '@/features/settings/teams/teams-settings-view';

export default async function TeamsSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <TeamsSettingsView workspaceSlug={workspaceSlug} />;
}
