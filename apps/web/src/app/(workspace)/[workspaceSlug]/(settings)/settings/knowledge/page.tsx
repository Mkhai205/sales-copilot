import { KnowledgeSettingsView } from '@/features/settings/knowledge/knowledge-settings-view';

export default async function KnowledgeSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <KnowledgeSettingsView workspaceSlug={workspaceSlug} />;
}
