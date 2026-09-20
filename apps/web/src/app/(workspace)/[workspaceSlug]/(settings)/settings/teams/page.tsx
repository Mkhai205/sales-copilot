import { TeamsSettingsView } from '@/features/settings';

export default async function TeamsSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <TeamsSettingsView workspaceSlug={workspaceSlug} />;
}
