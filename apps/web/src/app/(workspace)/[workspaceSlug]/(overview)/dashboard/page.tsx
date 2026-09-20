import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api/client';
import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';
import { DashboardView } from '@/features/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  let currentWorkspace: UserWorkspaceDto | undefined;

  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 401) {
      redirect('/login');
    }

    if (res.ok) {
      const json = (await res.json()) as { success: boolean; data?: UserWorkspaceDto[] };
      currentWorkspace = json.data?.find(w => w.slug === workspaceSlug);
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }

  if (!currentWorkspace) {
    redirect('/login');
  }

  if (currentWorkspace.role === 'AGENT') {
    redirect(`/${workspaceSlug}/conversations`);
  }

  return (
    <DashboardView
      workspaceId={currentWorkspace.id}
      workspaceSlug={workspaceSlug}
      workspaceName={currentWorkspace.name}
    />
  );
}
