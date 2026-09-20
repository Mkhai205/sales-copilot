import { CannedResponsesSettingsView } from '@/features/settings';

export default async function CannedResponsesSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <CannedResponsesSettingsView workspaceSlug={workspaceSlug} />;
}
