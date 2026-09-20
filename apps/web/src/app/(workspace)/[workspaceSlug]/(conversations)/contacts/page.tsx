import { ContactsView } from '@/features/conversations';

interface ContactsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function ContactsPage({ params }: ContactsPageProps) {
  const { workspaceSlug } = await params;

  return <ContactsView workspaceSlug={workspaceSlug} />;
}
