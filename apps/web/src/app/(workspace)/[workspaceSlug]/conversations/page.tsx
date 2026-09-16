import { ConversationLayout } from '@/features/conversations';

interface ConversationsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ConversationsPage({ params }: ConversationsPageProps) {
  const { workspaceSlug } = await params;

  return <ConversationLayout workspaceSlug={workspaceSlug} />;
}
