import { GeneralSettingsView } from '@/features/settings';

export default async function GeneralSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <GeneralSettingsView workspaceSlug={workspaceSlug} />;
}
