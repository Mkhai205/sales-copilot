'use client';

import * as React from 'react';
import { Tag, Plus, Search, Pencil, Trash2, AlertTriangle, X, Eye, EyeOff } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeleteLabel, useLabels } from './hooks/use-labels';
import { LabelFormDialog } from './label-form-dialog';
import { isValidHexColor } from './constants/label-colors';

interface LabelsListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function LabelsList({ workspaceId, currentUserRole }: LabelsListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [labelToEdit, setLabelToEdit] = React.useState<LabelDto | null>(null);
  const [labelToDelete, setLabelToDelete] = React.useState<LabelDto | null>(null);

  const { data: labels, isLoading } = useLabels(workspaceId);
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search labels..."
              className="h-8 pl-8 pr-8 text-xs bg-card/40"
            />
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="absolute right-1 top-1/2 size-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </Button>
            )}
          </div>

          {labels && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {filteredLabels.length} {filteredLabels.length === 1 ? 'label' : 'labels'}
            </Badge>
          )}
        </div>

        {canManage && (
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            Add Label
          </Button>
        )}
      </div>

      {/* Labels Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[240px] text-xs font-semibold">Label</TableHead>
              <TableHead className="text-xs font-semibold">Description</TableHead>
              <TableHead className="w-[140px] text-xs font-semibold">Visibility</TableHead>
              {canManage && (
                <TableHead className="w-[90px] text-right text-xs font-semibold">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Skeleton className="h-6 w-28 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto size-7 rounded-md" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : filteredLabels.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Tag className="size-6 text-muted-foreground/50" />
                    <span>
                      {searchQuery
                        ? 'No labels found matching your search.'
                        : 'No labels created yet in this workspace.'}
                    </span>
                    {canManage && !searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreateDialogOpen(true)}
                        className="mt-1 h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        Create First Label
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredLabels.map(label => {
                const color = isValidHexColor(label.color) ? label.color : '#2563eb';

                return (
                  <TableRow key={label.id} className="hover:bg-muted/40">
                    {/* Label Badge Column */}
                    <TableCell>
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border shadow-2xs"
                        style={{
                          backgroundColor: `${color}18`,
                          borderColor: `${color}40`,
                          color: color,
                        }}
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-medium">{label.title}</span>
                      </div>
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
                          Sidebar
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="gap-1 px-1.5 py-0.2 text-[10px] text-muted-foreground"
                        >
                          <EyeOff className="size-3" />
                          Hidden
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
                            title="Edit label"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setLabelToDelete(label)}
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete label"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
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
      <AlertDialog
        open={!!labelToDelete}
        onOpenChange={open => {
          if (!open) setLabelToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">Delete Label?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-semibold">"{labelToDelete?.title}"</strong>?
              It will be permanently removed from all tagged conversations and sidebar filters. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="text-xs">
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="text-xs font-medium"
            >
              {isDeleting ? (
                <>
                  <Spinner className="size-3.5" data-icon="inline-start" />
                  Deleting...
                </>
              ) : (
                'Delete Label'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
