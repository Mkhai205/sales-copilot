'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { InboxDetailLayout, useInbox, useInboxes } from '@/features/omnichannel';
import { SettingsGuard, useSettingsRbac } from '@/features/identity';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export default function InboxDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      <InboxDetailPageContent />
    </React.Suspense>
  );
}

function InboxDetailPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceSlug = (params?.workspaceSlug as string) || '';
  const inboxId = (params?.inboxId as string) || '';
  const initialTab = searchParams.get('tab') || undefined;

  const { currentWorkspace, isLoading: isLoadingWorkspace } = useSettingsRbac(workspaceSlug);

  // Preload/sync inboxes list in cache for seamless navigation
  useInboxes(currentWorkspace?.id);

  const {
    data: inbox,
    isLoading: isLoadingInbox,
    isError,
  } = useInbox(currentWorkspace?.id, inboxId);

  const isLoading = isLoadingWorkspace || (isLoadingInbox && !inbox);

  return (
    <SettingsGuard workspaceSlug={workspaceSlug} segment="inboxes">
      {isLoading ? (
        <div className="flex flex-col gap-6 w-full">
          <div className="flex items-center gap-3">
            <Skeleton className="size-12 rounded-xl" />
            <div className="flex flex-col gap-2 flex-1">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <Skeleton className="h-10 w-96 rounded-lg" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      ) : isError || !inbox ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20 max-w-3xl">
          <ShieldAlert className="size-10 text-muted-foreground/50 mb-3" />
          <h2 className="text-sm font-semibold text-foreground">Không tìm thấy hộp thư</h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Hộp thư này không tồn tại hoặc bạn không có quyền truy cập trong không gian làm việc
            này.
          </p>
          <Button
            size="sm"
            onClick={() => router.push(`/${workspaceSlug}/settings/inboxes`)}
            className="mt-4 h-8 gap-1.5 text-xs font-medium"
          >
            <ArrowLeft className="size-3.5" data-icon="inline-start" />
            Quay lại danh sách Hộp thư
          </Button>
        </div>
      ) : (
        <InboxDetailLayout
          inbox={inbox}
          workspaceId={currentWorkspace!.id}
          workspaceSlug={workspaceSlug}
          initialTab={initialTab}
        />
      )}
    </SettingsGuard>
  );
}
