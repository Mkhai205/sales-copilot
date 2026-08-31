'use client';

import * as React from 'react';
import { FileText, Plus, Search, Pencil, Trash2, AlertTriangle, X, Sparkles } from 'lucide-react';
import { type CannedResponseDto, WorkspaceRole } from '@sales-copilot/shared-contracts';
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
import { useCannedResponses, useDeleteCannedResponse } from './hooks/use-canned-responses';
import { CannedResponseFormDialog } from './canned-response-form-dialog';

interface CannedResponsesListProps {
  workspaceId: string;
  currentUserRole?: WorkspaceRole;
}

export function CannedResponsesList({ workspaceId, currentUserRole }: CannedResponsesListProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [responseToEdit, setResponseToEdit] = React.useState<CannedResponseDto | null>(null);
  const [responseToDelete, setResponseToDelete] = React.useState<CannedResponseDto | null>(null);

  const { data: responses, isLoading } = useCannedResponses(workspaceId);
  const { mutate: deleteResponse, isPending: isDeleting } = useDeleteCannedResponse(workspaceId);

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
              placeholder="Search by shortcode or content..."
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

          {responses && (
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
            >
              {filteredResponses.length} {filteredResponses.length === 1 ? 'response' : 'responses'}
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
            Add Response
          </Button>
        )}
      </div>

      {/* Canned Responses Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[180px] text-xs font-semibold">Shortcode</TableHead>
              <TableHead className="text-xs font-semibold">Message Content</TableHead>
              <TableHead className="w-[120px] text-xs font-semibold">Created</TableHead>
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
                    <Skeleton className="h-6 w-24 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-64 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20 rounded-md" />
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <Skeleton className="ml-auto size-7 rounded-md" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : filteredResponses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="size-6 text-muted-foreground/50" />
                    <span>
                      {searchQuery
                        ? 'No canned responses found matching your search.'
                        : 'No canned responses created yet in this workspace.'}
                    </span>
                    {canManage && !searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreateDialogOpen(true)}
                        className="mt-1 h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        Create First Response
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredResponses.map(item => {
                const createdDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    {/* Shortcode Column */}
                    <TableCell>
                      <code className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        /{item.shortCode}
                      </code>
                    </TableCell>

                    {/* Content Column */}
                    <TableCell>
                      <p className="text-xs text-foreground/90 line-clamp-2 font-normal leading-relaxed">
                        {item.content}
                      </p>
                    </TableCell>

                    {/* Created Date Column */}
                    <TableCell className="text-xs text-muted-foreground">{createdDate}</TableCell>

                    {/* Actions Column */}
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setResponseToEdit(item)}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Edit response"
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setResponseToDelete(item)}
                            className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="Delete response"
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
      <AlertDialog
        open={!!responseToDelete}
        onOpenChange={open => {
          if (!open) setResponseToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <AlertTriangle className="size-4" />
            </AlertDialogMedia>
            <AlertDialogTitle className="text-sm font-semibold">
              Delete Canned Response?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to delete{' '}
              <strong className="text-foreground font-mono font-semibold">
                /{responseToDelete?.shortCode}
              </strong>
              ? Agents will no longer be able to insert this response template in conversations.
              This action cannot be undone.
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
                'Delete Response'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
