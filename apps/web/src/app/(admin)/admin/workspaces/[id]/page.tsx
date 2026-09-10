'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Sliders, ShieldBan, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePlatformWorkspaceDetail } from '@/features/platform-admin/workspaces/hooks/use-platform-workspaces';
import { WorkspaceDetailView } from '@/features/platform-admin/workspaces/components/workspace-detail-view';
import { UpdatePlanDialog } from '@/features/platform-admin/workspaces/components/update-plan-dialog';
import { SuspendWorkspaceDialog } from '@/features/platform-admin/workspaces/components/suspend-workspace-dialog';
import type { PlatformWorkspaceListItemDto } from '@sales-copilot/shared-contracts';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const {
    data: workspace,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = usePlatformWorkspaceDetail(id);

  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);
  const [suspendDialogOpen, setSuspendDialogOpen] = React.useState(false);

  // Map detail to list item shape for dialog reuse
  const workspaceListItem: PlatformWorkspaceListItemDto | null = React.useMemo(() => {
    if (!workspace) return null;
    const ownerMember = workspace.members.find(m => m.role === 'OWNER');
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      billingPlan: workspace.billingPlan,
      isSuspended: workspace.isSuspended,
      suspendedReason: workspace.suspendedReason,
      suspendedAt: workspace.suspendedAt,
      owner: ownerMember
        ? { id: ownerMember.userId, email: ownerMember.email, name: ownerMember.name }
        : null,
      memberCount: workspace.members.length,
      channelCount: workspace.usage.currentChannels,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }, [workspace]);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      {/* Breadcrumb & Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin">Super Admin</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/admin/workspaces">Workspaces</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{isLoading ? 'Đang tải...' : workspace?.name || id}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/workspaces')}
              className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            >
              <ArrowLeft className="size-3.5" />
              <span>Quay lại danh sách</span>
            </Button>
          </div>
        </div>

        {/* Action buttons */}
        {workspace && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading || isRefetching}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={`size-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPlanDialogOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              <Sliders className="size-3.5 text-primary" />
              <span>Đổi gói & Quotas</span>
            </Button>

            <Button
              variant={workspace.isSuspended ? 'outline' : 'destructive'}
              size="sm"
              onClick={() => setSuspendDialogOpen(true)}
              className="h-8 text-xs gap-1.5"
            >
              {workspace.isSuspended ? (
                <>
                  <ShieldCheck className="size-3.5 text-emerald-600" />
                  <span>Kích hoạt lại</span>
                </>
              ) : (
                <>
                  <ShieldBan className="size-3.5" />
                  <span>Tạm khóa</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="flex flex-col gap-4 py-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-xs text-destructive">
          Không thể tải thông tin workspace: {error?.message || 'Không tìm thấy'}
        </div>
      ) : workspace ? (
        <WorkspaceDetailView workspace={workspace} />
      ) : null}

      {/* Update Plan Dialog */}
      <UpdatePlanDialog
        workspace={workspaceListItem}
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
      />

      {/* Suspend / Activate Alert Dialog */}
      <SuspendWorkspaceDialog
        workspace={workspaceListItem}
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
      />
    </div>
  );
}
