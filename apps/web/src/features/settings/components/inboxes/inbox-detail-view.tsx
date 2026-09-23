'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldAlert } from 'lucide-react';
import { SettingsPageLayout } from '../layout';
import { useSettingsRbac } from '../../hooks/use-settings-rbac';
import { useInbox, useInboxes } from '../../hooks/use-inboxes';
import { InboxDetailLayout } from './inbox-detail/inbox-detail-layout';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

export interface InboxDetailViewProps {
  workspaceSlug: string;
  inboxId: string;
}

export function InboxDetailView({ workspaceSlug, inboxId }: InboxDetailViewProps) {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <Spinner className="size-6 text-primary" />
        </div>
      }
    >
      <InboxDetailContent workspaceSlug={workspaceSlug} inboxId={inboxId} />
    </React.Suspense>
  );
}

function InboxDetailContent({
  workspaceSlug,
  inboxId,
}: {
  workspaceSlug: string;
  inboxId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    <SettingsPageLayout
      workspaceSlug={workspaceSlug}
      segment="inboxes"
      hideHeader={true}
      isLoading={isLoading}
      skeletonVariant="detail"
    >
      {isError || !inbox ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card/20 max-w-3xl mx-auto my-auto">
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
    </SettingsPageLayout>
  );
}
