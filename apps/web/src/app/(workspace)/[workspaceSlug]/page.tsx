import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api/client';
import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';

export const dynamic = 'force-dynamic';

export default async function WorkspaceRootPage({
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

  let isAgent = false;

  try {
    const workspaceRes = await fetch(`${API_BASE}/workspaces`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (workspaceRes.status === 401) {
      redirect('/login');
    }

    if (workspaceRes.ok) {
      const workspaceData = (await workspaceRes.json()) as {
        success: boolean;
        data?: UserWorkspaceDto[];
      };
      const ws = workspaceData.data?.find(w => w.slug === workspaceSlug);
      if (ws && ws.role === 'AGENT') {
        isAgent = true;
      }
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }

  if (isAgent) {
    redirect(`/${workspaceSlug}/conversations`);
  } else {
    redirect(`/${workspaceSlug}/dashboard`);
  }
}
