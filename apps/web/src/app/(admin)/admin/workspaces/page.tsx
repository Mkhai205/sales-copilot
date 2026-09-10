'use client';

import * as React from 'react';
import { Building2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlatformWorkspaces } from '@/features/platform-admin/workspaces/hooks/use-platform-workspaces';
import { WorkspaceFilterToolbar } from '@/features/platform-admin/workspaces/components/workspace-filter-toolbar';
import { WorkspacesTable } from '@/features/platform-admin/workspaces/components/workspaces-table';
import { WorkspaceDetailModal } from '@/features/platform-admin/workspaces/components/workspace-detail-modal';
import { UpdatePlanDialog } from '@/features/platform-admin/workspaces/components/update-plan-dialog';
import { SuspendWorkspaceDialog } from '@/features/platform-admin/workspaces/components/suspend-workspace-dialog';
import type {
  BillingPlanType,
  PlatformWorkspaceListItemDto,
} from '@sales-copilot/shared-contracts';

export default function PlatformWorkspacesPage() {
  const [search, setSearch] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [plan, setPlan] = React.useState<string>('ALL');
  const [status, setStatus] = React.useState<string>('ALL');
  const [page, setPage] = React.useState(1);

  // Debounce search by 300ms
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Dialog / Modal states
  const [detailWorkspaceId, setDetailWorkspaceId] = React.useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);

  const [selectedPlanWorkspace, setSelectedPlanWorkspace] =
    React.useState<PlatformWorkspaceListItemDto | null>(null);
  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);

  const [selectedSuspendWorkspace, setSelectedSuspendWorkspace] =
    React.useState<PlatformWorkspaceListItemDto | null>(null);
  const [suspendDialogOpen, setSuspendDialogOpen] = React.useState(false);

  // Query workspaces
  const queryParams = React.useMemo(() => {
    return {
      page,
      limit: 20,
      search: debouncedSearch.trim() || undefined,
      plan: plan !== 'ALL' ? (plan as BillingPlanType) : undefined,
      status: status !== 'ALL' ? (status as 'ACTIVE' | 'SUSPENDED') : undefined,
    };
  }, [page, debouncedSearch, plan, status]);

  const { data, isLoading, refetch, isRefetching } = usePlatformWorkspaces(queryParams);

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setPlan('ALL');
    setStatus('ALL');
    setPage(1);
  };

  const handleViewDetail = (ws: PlatformWorkspaceListItemDto) => {
    setDetailWorkspaceId(ws.id);
    setDetailModalOpen(true);
  };

  const handleUpdatePlan = (ws: PlatformWorkspaceListItemDto) => {
    setSelectedPlanWorkspace(ws);
    setPlanDialogOpen(true);
  };

  const handleToggleStatus = (ws: PlatformWorkspaceListItemDto) => {
    setSelectedSuspendWorkspace(ws);
    setSuspendDialogOpen(true);
  };

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-6 gap-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Quản trị Workspaces (Tenants)
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Tra cứu, kiểm soát hạn mức Quota, nâng/hạ gói cước và quản lý trạng thái tạm khóa của
            tất cả gian hàng.
          </p>
        </div>

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
      </div>

      {/* Filter Toolbar */}
      <WorkspaceFilterToolbar
        search={search}
        onSearchChange={setSearch}
        plan={plan}
        onPlanChange={p => {
          setPlan(p);
          setPage(1);
        }}
        status={status}
        onStatusChange={s => {
          setStatus(s);
          setPage(1);
        }}
        onReset={handleResetFilters}
      />

      {/* Workspaces Table */}
      <WorkspacesTable
        workspaces={data?.items ?? []}
        isLoading={isLoading}
        meta={data?.meta}
        page={page}
        onPageChange={setPage}
        onViewDetail={handleViewDetail}
        onUpdatePlan={handleUpdatePlan}
        onToggleStatus={handleToggleStatus}
      />

      {/* Detail Quick View Modal */}
      <WorkspaceDetailModal
        workspaceId={detailWorkspaceId}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      {/* Update Plan & Quotas Dialog */}
      <UpdatePlanDialog
        workspace={selectedPlanWorkspace}
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
      />

      {/* Suspend / Activate Alert Dialog */}
      <SuspendWorkspaceDialog
        workspace={selectedSuspendWorkspace}
        open={suspendDialogOpen}
        onOpenChange={setSuspendDialogOpen}
      />
    </div>
  );
}
