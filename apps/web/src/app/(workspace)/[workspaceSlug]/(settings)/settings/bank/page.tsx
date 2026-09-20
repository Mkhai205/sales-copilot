import { BankSettingsView } from '@/features/settings';

export default async function BankSettingsPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  return <BankSettingsView workspaceSlug={workspaceSlug} />;
}
