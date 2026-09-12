import { redirect } from 'next/navigation';

interface AnalyticsPageProps {
  params: Promise<{ workspaceSlug: string }>;
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { workspaceSlug } = await params;
  redirect(`/${workspaceSlug}/analytics/overview`);
}
