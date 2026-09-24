import { InboxDetailView } from '@/features/settings/inboxes/inbox-detail-view';

export default async function InboxDetailPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; inboxId: string }>;
}) {
  const { workspaceSlug, inboxId } = await params;
  return <InboxDetailView workspaceSlug={workspaceSlug} inboxId={inboxId} />;
}
