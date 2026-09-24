import { SettingsIndexView } from '@/features/settings/layout/settings-index-view';

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <SettingsIndexView workspaceSlug={workspaceSlug} />;
}
