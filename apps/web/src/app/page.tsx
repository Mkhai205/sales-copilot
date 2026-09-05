import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { UserWorkspaceDto } from '@/lib/api/types';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export default async function Home() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  let targetSlug = 'default-workspace';

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
      if (workspaceData.success && workspaceData.data && workspaceData.data.length > 0) {
        targetSlug = workspaceData.data[0].slug;
      }
    }
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) {
      throw err;
    }
  }

  redirect(`/${targetSlug}/conversations`);
}
