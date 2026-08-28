import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { API_BASE } from '@/lib/api/client';
import type { UserWorkspaceDto } from '@sales-copilot/shared-contracts';

export default async function RootPage() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    redirect('/login');
  }

  // Resolve user's workspace
  try {
    const res = await fetch(`${API_BASE}/workspaces`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.ok) {
      const data = (await res.json()) as {
        success: boolean;
        data: UserWorkspaceDto[];
      };
      if (data.success && data.data?.length > 0) {
        redirect(`/${data.data[0].slug}/conversations`);
      }
    }
  } catch {
    // Fall back to default
  }

  redirect('/default/conversations');
}
