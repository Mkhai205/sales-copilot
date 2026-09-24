'use client';

import * as React from 'react';
import { FileText, Plus, Pencil, Trash2, Copy, Check } from 'lucide-react';
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
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const { data: responses } = useCannedResponses(workspaceId);
  const { mutate: deleteResponse, isPending: isDeleting } = useDeleteCannedResponse(workspaceId);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

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
      <CannedResponsesToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filteredCount={filteredResponses.length}
        canManage={canManage}
        onCreateResponse={() => setCreateDialogOpen(true)}
      />

      {/* Canned Responses Table */}
      <div className="rounded-xl border border-border bg-card/40 overflow-hidden shadow-2xs">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[140px] text-xs font-semibold sm:w-[170px]">
                Lệnh tắt
              </TableHead>
              <TableHead className="text-xs font-semibold">Nội dung tin nhắn</TableHead>
              <TableHead className="hidden w-[110px] text-xs font-semibold sm:table-cell">
                Ngày tạo
              </TableHead>
              {canManage && (
                <TableHead className="w-[105px] text-xs font-semibold text-right">
                  Thao tác
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResponses.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={canManage ? 4 : 3}
                  className="h-36 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <FileText className="size-6 text-muted-foreground/50" />
                    <span>
                      {searchQuery
                        ? 'Không tìm thấy tin nhắn mẫu nào phù hợp với tìm kiếm.'
                        : 'Chưa có tin nhắn mẫu nào được tạo trong không gian làm việc này.'}
                    </span>
                    {canManage && !searchQuery && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCreateDialogOpen(true)}
                        className="mt-1 h-7 gap-1 text-xs"
                      >
                        <Plus className="size-3" />
                        Tạo mẫu câu đầu tiên
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredResponses.map(item => {
                const createdDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('vi-VN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—';

                return (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    {/* Shortcode Column */}
                    <TableCell>
                      <code className="inline-flex max-w-full items-center truncate rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                        /{item.shortCode}
                      </code>
                    </TableCell>

                    {/* Content Column */}
                    <TableCell className="max-w-0 whitespace-normal">
                      <p
                        className="line-clamp-2 text-xs font-normal leading-relaxed text-foreground/90 break-words"
                        title={item.content}
                      >
                        {item.content}
                      </p>
                    </TableCell>

                    {/* Created Date Column */}
                    <TableCell className="hidden text-xs text-muted-foreground sm:table-cell">
                      {createdDate}
                    </TableCell>

                    {/* Actions Column */}
                    {canManage && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleCopy(item.id, item.content)}
                            className="size-7 text-muted-foreground hover:text-foreground"
                            title="Sao chép tin nhắn"
                          >
                            {copiedId === item.id ? (
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
