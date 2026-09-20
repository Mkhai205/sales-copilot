import { SettingsIndexView } from '@/features/settings';

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <SettingsIndexView workspaceSlug={workspaceSlug} />;
}
