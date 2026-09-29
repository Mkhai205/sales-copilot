'use client';

import * as React from 'react';
import { FileText, Plus, Pencil, Trash2, Copy, Check } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { type CannedResponseDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { useCannedResponses, useDeleteCannedResponse } from '../hooks/use-canned-responses';
import { CannedResponseFormDialog } from './canned-response-form-dialog';
import { CannedResponsesToolbar } from './canned-responses-toolbar';
import { CannedResponseDeleteDialog } from './canned-response-delete-dialog';

interface CannedResponsesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function CannedResponsesList({ workspaceId, currentUserRole }: CannedResponsesListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [responseToEdit, setResponseToEdit] = React.useState<CannedResponseDto | null>(null);
  const [responseToDelete, setResponseToDelete] = React.useState<CannedResponseDto | null>(null);

  const { data: responses } = useCannedResponses(workspaceId);
  const { mutate: deleteResponse, isPending: isDeleting } = useDeleteCannedResponse(workspaceId);
  const { copiedValue, copy } = useCopyToClipboard();

  // OWNER, ADMIN, and AGENT can manage canned responses
  const canManage =
    currentUserRole === WorkspaceRole.OWNER ||
    currentUserRole === WorkspaceRole.ADMIN ||
    currentUserRole === WorkspaceRole.AGENT;

  const filteredResponses = React.useMemo(() => {
    if (!responses) return [];
    if (!searchQuery.trim()) return responses;

    const query = searchQuery.trim().toLowerCase();
    return responses.filter(item => {
      const code = item.shortCode.toLowerCase();
      const content = item.content.toLowerCase();
      return code.includes(query) || content.includes(query);
    });
  }, [responses, searchQuery]);

  const handleConfirmDelete = () => {
    if (!responseToDelete) return;
    deleteResponse(responseToDelete.id, {
      onSuccess: () => setResponseToDelete(null),
    });
  };

  const columns = React.useMemo<ColumnDef<CannedResponseDto, any>[]>(() => {
    const actionsColumn: ColumnDef<CannedResponseDto, any> = {
      header: 'Thao tác',
      meta: { headerClassName: 'w-[105px] text-xs font-semibold text-right' },
      cell: ({ row }) => {
        const item = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => copy(item.content)}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Sao chép tin nhắn"
            >
              {copiedValue === item.content ? (
                <Check className="size-3 text-emerald-500" />
              ) : (
                <Copy className="size-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setResponseToEdit(item)}
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Chỉnh sửa mẫu câu"
            >
              <Pencil className="size-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setResponseToDelete(item)}
              className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Xóa mẫu câu"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        );
      },
    };

    return [
      {
        header: 'Lệnh tắt',
        meta: { headerClassName: 'w-[140px] text-xs font-semibold sm:w-[170px]' },
        cell: ({ row }) => (
          <code className="inline-flex max-w-full items-center truncate rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
            /{row.original.shortCode}
          </code>
        ),
      },
      {
        header: 'Nội dung tin nhắn',
        meta: { headerClassName: 'text-xs font-semibold' },
        cell: ({ row }) => (
          <p
            className="line-clamp-2 text-xs font-normal leading-relaxed text-foreground/90 break-words"
            title={row.original.content}
          >
            {row.original.content}
          </p>
        ),
      },
      {
        header: 'Ngày tạo',
        meta: { headerClassName: 'hidden w-[110px] text-xs font-semibold sm:table-cell' },
        cell: ({ row }) => {
          const item = row.original;
          const createdDate = item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : '—';
          return <span className="text-xs text-muted-foreground">{createdDate}</span>;
        },
      },
      ...(canManage ? [actionsColumn] : []),
    ];
  }, [canManage, copiedValue, copy]);

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <CannedResponsesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredResponses.length}
        canManage={canManage}
        onCreateResponse={() => setCreateDialogOpen(true)}
      />

      <DataTable
        data={filteredResponses}
        columns={columns}
        getRowKey={item => item.id}
        className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs [&_table]:table-fixed [&_thead]:bg-muted/30 [&_thead_tr:hover]:bg-muted/30 [&_th]:text-xs [&_th]:font-semibold [&_tbody_tr:hover]:bg-muted/40 [&_td:nth-child(2)]:whitespace-normal [&_td:nth-child(3)]:hidden sm:[&_td:nth-child(3)]:table-cell"
        emptyState={{
          icon: <FileText className="size-6 text-muted-foreground/50" />,
          title: searchQuery
            ? 'Không tìm thấy tin nhắn mẫu nào phù hợp với tìm kiếm.'
            : 'Chưa có tin nhắn mẫu nào được tạo trong không gian làm việc này.',
          action:
            canManage && !searchQuery ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateDialogOpen(true)}
                className="h-7 gap-1 text-xs"
              >
                <Plus className="size-3" />
                Tạo mẫu câu đầu tiên
              </Button>
            ) : undefined,
        }}
      />

      {/* Create / Edit Dialog */}
      <CannedResponseFormDialog
        open={createDialogOpen || !!responseToEdit}
        onOpenChange={open => {
          if (!open) {
            setCreateDialogOpen(false);
            setResponseToEdit(null);
          }
        }}
        workspaceId={workspaceId}
        responseToEdit={responseToEdit}
      />

      {/* Delete Canned Response AlertDialog */}
      <CannedResponseDeleteDialog
        response={responseToDelete}
        onOpenChange={open => {
          if (!open) setResponseToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
