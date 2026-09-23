import { KnowledgeSettingsView } from '@/features/settings';

export default async function KnowledgeSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <KnowledgeSettingsView workspaceSlug={workspaceSlug} />;
}
