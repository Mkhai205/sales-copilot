import { ConversationLayout } from '@/features/conversations';

interface ConversationDetailPageProps {
  params: Promise<{
    workspaceSlug: string;
    conversationId: string;
  }>;
}

export default async function ConversationDetailPage({ params }: ConversationDetailPageProps) {
  const { workspaceSlug, conversationId } = await params;

  return <ConversationLayout workspaceSlug={workspaceSlug} conversationId={conversationId} />;
}
