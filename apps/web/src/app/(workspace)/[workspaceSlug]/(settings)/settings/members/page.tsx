import { MembersSettingsView } from '@/features/settings';

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <MembersSettingsView workspaceSlug={workspaceSlug} />;
}
