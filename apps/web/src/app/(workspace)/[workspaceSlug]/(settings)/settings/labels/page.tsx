import { LabelsSettingsView } from '@/features/settings';

export default async function LabelsSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <LabelsSettingsView workspaceSlug={workspaceSlug} />;
}
