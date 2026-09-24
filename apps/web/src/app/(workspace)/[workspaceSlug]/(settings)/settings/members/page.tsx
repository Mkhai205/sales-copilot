import { MembersSettingsView } from '@/features/settings/members/members-settings-view';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <MembersSettingsView workspaceSlug={workspaceSlug} />;
}
