'use client';

import * as React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table/data-table';
import { getChannelMeta } from '@/lib/channels';
import type { ContactDto, PaginationMeta } from '@sales-copilot/shared-contracts';
import { Check, Copy, Eye, GitMerge, MoreHorizontal, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateTime } from '@/lib/format-date';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';

export interface ContactsTableProps {
  contacts: ContactDto[];
  isLoading?: boolean;
  meta?: PaginationMeta;
  workspaceSlug: string;
  onSelectContact: (contact: ContactDto) => void;
  onMergeContact: (contact: ContactDto) => void;
  onDeleteContact: (contact: ContactDto) => void;
  onPageChange?: (newPage: number) => void;
}

export function ContactsTable({
  contacts,
  isLoading = false,
  meta,
  onSelectContact,
  onMergeContact,
  onDeleteContact,
  onPageChange,
}: ContactsTableProps) {
  const { copiedValue, copy } = useCopyToClipboard();

  const handleCopy = (e: React.MouseEvent, text: string, label: string) => {
    e.stopPropagation();
    copy(text);
    toast.success(`Đã sao chép ${label}`);
  };

  const columns = React.useMemo<ColumnDef<ContactDto, any>[]>(
    () => [
      {
        header: 'Khách hàng',
        meta: { headerClassName: 'min-w-[220px]' },
        cell: ({ row }) => {
          const contact = row.original;
          const initials = (contact.name || 'K')
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
          return (
            <div className="flex items-center gap-3 min-w-0">
              <Avatar className="size-8 ring-1 ring-border/50 shrink-0">
                <AvatarImage
                  src={contact.avatarUrl || '/avatar-contact-default.svg'}
                  alt={contact.name}
                />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold text-xs text-foreground">{contact.name}</p>
                {contact.identifier && (
                  <p className="truncate text-[11px] text-muted-foreground font-mono">
                    #{contact.identifier}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        header: 'Kênh kết nối',
        meta: { headerClassName: 'w-48' },
        cell: ({ row }) => {
          const identities = row.original.identities || [];
          if (identities.length === 0) {
            return <span className="text-xs text-muted-foreground/60 italic">Chưa liên kết</span>;
          }
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {identities.slice(0, 3).map((id, iIdx) => {
                const meta = getChannelMeta(id.channelType);
                const handle = id.username ? `@${id.username}` : id.externalContactId;
                return (
                  <Tooltip key={id.id || iIdx}>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="px-1.5 py-0.5 text-[10px] gap-1 font-normal bg-background/80 hover:bg-muted"
                      >
                        <img
                          src={meta.iconSrc}
                          alt={meta.label}
                          className="size-3 object-contain shrink-0"
                        />
                        <span className="max-w-[80px] truncate">{meta.label}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs">
                        {meta.label}: {handle}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
              {identities.length > 3 && (
                <Badge variant="secondary" className="px-1 text-[10px] h-5">
                  +{identities.length - 3}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        header: 'Điện thoại',
        meta: { headerClassName: 'w-40' },
        cell: ({ row }) => {
          const contact = row.original;
          if (!contact.phoneNumber) {
            return <span className="text-xs text-muted-foreground/60">-</span>;
          }
          return (
            <div className="flex items-center gap-1 group/phone">
              <span className="truncate text-foreground text-xs">{contact.phoneNumber}</span>
              <Button
                type="button"
                variant="ghost"
                onClick={e => handleCopy(e, contact.phoneNumber!, `phone-${contact.id}`)}
                className="h-auto w-auto opacity-0 group-hover/phone:opacity-100 hover:text-foreground text-muted-foreground p-0.5 transition-opacity"
                title="Sao chép số điện thoại"
              >
                {copiedValue === `phone-${contact.id}` ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          );
        },
      },
      {
        header: 'Email',
        meta: { headerClassName: 'w-48' },
        cell: ({ row }) => {
          const contact = row.original;
          if (!contact.email) {
            return <span className="text-xs text-muted-foreground/60">-</span>;
          }
          return (
            <div className="flex items-center gap-1 group/email">
              <span
                className="truncate max-w-[170px] text-foreground text-xs"
                title={contact.email}
              >
                {contact.email}
              </span>
              <Button
                type="button"
                variant="ghost"
                onClick={e => handleCopy(e, contact.email!, `email-${contact.id}`)}
                className="h-auto w-auto opacity-0 group-hover/email:opacity-100 hover:text-foreground text-muted-foreground p-0.5 transition-opacity"
                title="Sao chép email"
              >
                {copiedValue === `email-${contact.id}` ? (
                  <Check className="size-3 text-success" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          );
        },
      },
      {
        header: 'Ngày tạo',
        meta: { headerClassName: 'w-40' },
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.original.createdAt)}
          </span>
        ),
      },
      {
        header: '',
        meta: { headerClassName: 'w-20 text-right' },
        cell: ({ row }) => {
          const contact = row.original;
          return (
            <div className="flex justify-end" onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <MoreHorizontal className="size-4" />
                    <span className="sr-only">Thao tác</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44 text-xs">
                  <DropdownMenuItem
                    onClick={() => onSelectContact(contact)}
                    className="gap-2 cursor-pointer"
                  >
                    <Eye className="size-3.5 text-muted-foreground" />
                    <span>Xem chi tiết</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onMergeContact(contact)}
                    className="gap-2 cursor-pointer"
                  >
                    <GitMerge className="size-3.5 text-muted-foreground" />
                    <span>Gộp khách hàng</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteContact(contact)}
                    className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Xóa khách hàng</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [copiedValue, handleCopy, onSelectContact, onMergeContact, onDeleteContact],
  );

  return (
    <div className="flex flex-col gap-3">
      <DataTable
        data={contacts}
        columns={columns}
        isLoading={isLoading}
        skeletonRows={6}
        getRowKey={contact => contact.id}
        onRowClick={onSelectContact}
        className="rounded-md border bg-card overflow-hidden shadow-2xs [&_thead]:bg-muted/40 [&_thead]:text-[11px] [&_td]:py-2.5"
        emptyState={{
          icon: (
            <div className="rounded-full bg-muted/50 p-3">
              <Users className="size-6 text-muted-foreground/60" />
            </div>
          ),
          title: 'Không tìm thấy khách hàng nào',
          description: 'Thử thay đổi từ khóa tìm kiếm hoặc lọc theo kênh khác.',
        }}
        pagination={
          meta && onPageChange
            ? {
                page: meta.page ?? 1,
                totalPages: meta.totalPages ?? 1,
                total: meta.total,
                onPageChange,
                isLoading,
              }
            : undefined
        }
      />
    </div>
  );
}
