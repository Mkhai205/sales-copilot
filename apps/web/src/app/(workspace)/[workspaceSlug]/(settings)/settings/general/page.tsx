import { GeneralSettingsView } from '@/features/settings/general/general-settings-view';

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <GeneralSettingsView workspaceSlug={workspaceSlug} />;
}
