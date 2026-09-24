'use client';

import * as React from 'react';
import { Tag, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { type LabelDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDeleteLabel, useLabels } from '../hooks/use-labels';
import { LabelFormDialog } from './label-form-dialog';
import { LabelsToolbar } from './labels-toolbar';
import { LabelBadgePreview } from './label-badge-preview';
import { LabelDeleteDialog } from './label-delete-dialog';

interface LabelsListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function LabelsList({ workspaceId, currentUserRole }: LabelsListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [labelToEdit, setLabelToEdit] = React.useState<LabelDto | null>(null);
  const [labelToDelete, setLabelToDelete] = React.useState<LabelDto | null>(null);

  const { data: labels } = useLabels(workspaceId);
  const { mutate: deleteLabel, isPending: isDeleting } = useDeleteLabel(workspaceId);

  const canManage =
    currentUserRole === WorkspaceRole.OWNER || currentUserRole === WorkspaceRole.ADMIN;

  const filteredLabels = React.useMemo(() => {
    if (!labels) return [];
    if (!searchQuery.trim()) return labels;

    const query = searchQuery.trim().toLowerCase();
    return labels.filter(label => {
      const title = label.title.toLowerCase();
      const desc = label.description?.toLowerCase() || '';
      return title.includes(query) || desc.includes(query);
    });
  }, [labels, searchQuery]);

  const handleConfirmDelete = () => {
    if (!labelToDelete) return;
    deleteLabel(labelToDelete.id, {
      onSuccess: () => setLabelToDelete(null),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <LabelsToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredLabels.length}
        canManage={canManage}
        onCreateLabel={() => setCreateDialogOpen(true)}
      />

      {/* Labels Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[240px] text-xs font-semibold">Tên nhãn</TableHead>
              <TableHead className="text-xs font-semibold">Mô tả</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold">Hiển thị</TableHead>
              {canManage && (
                <TableHead className="w-[90px] text-right text-xs font-semibold">
                  Thao tác
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLabels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="size-6 text-muted-foreground/50" />
                    <span>
                      {searchQuery
                        ? 'Không tìm thấy nhãn nào phù hợp với tìm kiếm.'
                        : 'Chưa có nhãn nào được tạo trong không gian làm việc này.'}
                    </span>
                    {canManage && !searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreateDialogOpen(true)}
                        className="mt-1 h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        Tạo nhãn đầu tiên
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLabels.map(label => (
                <TableRow key={label.id} className="hover:bg-muted/40">
                  {/* Label Badge Column */}
                  <TableCell>
                    <LabelBadgePreview title={label.title} color={label.color} />
                  </TableCell>

                  {/* Description Column */}
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                    {label.description || '—'}
                  </TableCell>

                  {/* Visibility Column */}
                  <TableCell>
                    {label.showOnSidebar ? (
                      <Badge
                        variant="outline"
                        className="gap-1 px-1.5 py-0.2 text-[10px] text-primary border-primary/30 bg-primary/5"
                      >
                        <Eye className="size-3" />
                        Thanh bên
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="gap-1 px-1.5 py-0.2 text-[10px] text-muted-foreground"
                      >
                        <EyeOff className="size-3" />
                        Tạm ẩn
                      </Badge>
                    )}
                  </TableCell>

                  {/* Actions Column */}
                  {canManage && (
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setLabelToEdit(label)}
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Chỉnh sửa nhãn"
                        >
                          <Pencil className="size-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setLabelToDelete(label)}
                          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          title="Xóa nhãn"
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create / Edit Dialog */}
      <LabelFormDialog
        open={createDialogOpen || !!labelToEdit}
        onOpenChange={open => {
          if (!open) {
            setCreateDialogOpen(false);
            setLabelToEdit(null);
          }
        }}
        workspaceId={workspaceId}
        labelToEdit={labelToEdit}
      />

      {/* Delete Label AlertDialog */}
      <LabelDeleteDialog
        label={labelToDelete}
        onOpenChange={open => {
          if (!open) setLabelToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
}
