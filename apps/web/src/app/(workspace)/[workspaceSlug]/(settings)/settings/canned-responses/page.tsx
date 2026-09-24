import { CannedResponsesSettingsView } from '@/features/settings/canned-responses/canned-responses-settings-view';

export default async function CannedResponsesSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <CannedResponsesSettingsView workspaceSlug={workspaceSlug} />;
}
